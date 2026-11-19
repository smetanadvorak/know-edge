/**
 * Storage implementation on a GitHub repo (the vault), through the GitHub REST API, from the browser.
 * - file list and blob shas come from the git tree of the branch; file texts are cached by blob sha
 * - modify(): edits are applied to a local copy right away and kept as a list of ops per file;
 *   they are committed EDIT_DELAY_MS after the last edit (or with flushEdits()): read latest sha,
 *   replay the ops on it, PUT with that sha; on conflict re-read and retry once. one commit per file.
 *   pending edits live in memory only (ops are functions), so a closed tab loses unsaved ones.
 * - review log: entries are buffered (and kept in local storage so a closed tab loses nothing),
 *   then committed in batches to <log_folder>/log-<device>.jsonl
 * all GitHub calls run one at a time.
 *
 * prompt:
 *   if sync via github, can i host there too?
 *   1. yes  3. let's batch
 *   how is token handled and stored?  yes (token passed in from memory, never stored here)
 *   (new deck button in the web editor) then let's add this featrure.
 *   (deck list: loading / failed state instead of "No decks" while loading; readable GitHub error messages) The first thing that opens is Decks and it takes some time to load, and while its loading it is saying "No Decks". Better to show loading indication and say not Decks after some time if none loaded. Also is there error message if something went wrong with fetching from git?
 *   (web: deck edits batched, committed 5 s after the last edit or with a save button) batch the actions instead of committing each action separately, add a button that saves right away, otherwise save after some time passed since last action (5 seconds?)
 */
import type { LogEntry, Storage } from '@know-edge/core';
import type { WebConfig } from './config';

const FLUSH_COUNT = 10;
const FLUSH_DELAY_MS = 120_000;
const EDIT_DELAY_MS = 5_000;

interface Cached
{
  sha: string;
  text: string;
}

// unsaved edits of one file: ops in order, and their result on the last known text
interface PendingEdits
{
  ops: ((text: string) => string)[];
  text: string;
}

function encodeBase64(text: string): string
{
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function decodeBase64(b64: string): string
{
  const bin = atob(b64.replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function encodePath(path: string): string
{
  return path.split('/').map(encodeURIComponent).join('/');
}

// readable message for a failed GitHub call
async function githubError(res: Response, what: string): Promise<Error>
{
  const body = await res.text();
  switch (res.status)
  {
    case 401:
      return new Error('GitHub rejected the token (401). It may be expired or revoked: set a new one in Settings.');
    case 403:
      if (/rate limit/i.test(body)) return new Error('GitHub rate limit reached (403). Try again later.');
      return new Error(`The token has no access (403) ${what}. Check its repository access and the Contents read/write permission.`);
    case 404:
      return new Error(`Not found on GitHub (404) ${what}. Check owner, repository and branch in Settings, and that the token can access the repository.`);
    case 409:
      if (/empty/i.test(body)) return new Error('The repository is empty: push at least one commit first.');
  }
  return new Error(`GitHub ${res.status} ${what}: ${body}`);
}

function folderPrefix(folder: string): string
{
  return folder.replace(/^\/+|\/+$/g, '') + '/';
}

export class GitHubStorage implements Storage
{
  // path -> blob sha, for the whole branch
  private tree = new Map<string, string>();
  private cache = new Map<string, Cached>();
  private pending: LogEntry[];
  private queue: Promise<unknown> = Promise.resolve();
  private flush_timer: ReturnType<typeof setTimeout> | null = null;
  private edits = new Map<string, PendingEdits>();
  private edit_timer: ReturnType<typeof setTimeout> | null = null;
  // called when the number of unsynced reviews changes
  onPendingChange: (count: number) => void = () => {};
  // called when the number of edits not yet committed changes
  onEditsChange: (count: number) => void = () => {};
  // called when a background flush fails
  onError: (error: unknown) => void = () => {};

  constructor(private config: WebConfig, private token: string)
  {
    const raw = localStorage.getItem(this.pendingKey);
    this.pending = raw ? JSON.parse(raw) : [];
  }

  get pendingCount(): number
  {
    return this.pending.length;
  }

  get editCount(): number
  {
    let count = 0;
    for (const e of this.edits.values()) count += e.ops.length;
    return count;
  }

  private get pendingKey(): string
  {
    return `know-edge-pending:${this.config.owner}/${this.config.repo}:${this.config.device}`;
  }

  private get ownLogPath(): string
  {
    return folderPrefix(this.config.log_folder) + `log-${this.config.device}.jsonl`;
  }

  private savePending(): void
  {
    localStorage.setItem(this.pendingKey, JSON.stringify(this.pending));
    this.onPendingChange(this.pending.length);
  }

  // run github calls one at a time
  private serial<T>(fn: () => Promise<T>): Promise<T>
  {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async api(path: string, init: RequestInit = {}): Promise<Response>
  {
    const { owner, repo } = this.config;
    const token = this.token;
    try
    {
      return await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
        ...init,
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
    }
    catch
    {
      // fetch only throws when no response came back at all
      throw new Error('Cannot reach GitHub (offline, or the request was blocked by the browser or an extension).');
    }
  }

  private async json(path: string): Promise<any>
  {
    const res = await this.api(path);
    if (!res.ok) throw await githubError(res, `on ${path}`);
    return res.json();
  }

  // reload the file list (one request); texts with an unchanged sha stay cached
  refresh(): Promise<void>
  {
    return this.serial(async () =>
    {
      const data = await this.json(`/git/trees/${encodeURIComponent(this.config.branch)}?recursive=1`);
      this.tree.clear();
      for (const entry of data.tree) if (entry.type === 'blob') this.tree.set(entry.path, entry.sha);
    });
  }

  private async ensureTree(): Promise<void>
  {
    if (!this.tree.size) await this.refresh();
  }

  private async load(path: string, sha: string): Promise<Cached>
  {
    const cached = this.cache.get(path);
    if (cached && cached.sha === sha) return cached;
    const data = await this.json(`/git/blobs/${sha}`);
    const file = { sha, text: decodeBase64(data.content) };
    this.cache.set(path, file);
    this.tree.set(path, sha);
    return file;
  }

  // latest version on the branch, null if the file does not exist
  private async latest(path: string): Promise<Cached | null>
  {
    const res = await this.api(`/contents/${encodePath(path)}?ref=${encodeURIComponent(this.config.branch)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw await githubError(res, `reading ${path}`);
    const data = await res.json();
    return this.load(path, data.sha);
  }

  private async put(path: string, text: string, sha: string | null, message: string): Promise<boolean>
  {
    const body: Record<string, string> = { message, content: encodeBase64(text), branch: this.config.branch };
    if (sha) body.sha = sha;
    const res = await this.api(`/contents/${encodePath(path)}`, { method: 'PUT', body: JSON.stringify(body) });
    // 409 / 422: the file changed since we read it
    if (res.status === 409 || res.status === 422) return false;
    if (!res.ok) throw await githubError(res, `writing ${path}`);
    const data = await res.json();
    this.cache.set(path, { sha: data.content.sha, text });
    this.tree.set(path, data.content.sha);
    return true;
  }

  async deckPaths(): Promise<string[]>
  {
    await this.ensureTree();
    const prefix = folderPrefix(this.config.deck_folder);
    return [...this.tree.keys()].filter((p) => p.startsWith(prefix) && p.endsWith('.md')).sort();
  }

  async read(path: string): Promise<string>
  {
    const edited = this.edits.get(path);
    if (edited) return edited.text;
    await this.ensureTree();
    const sha = this.tree.get(path);
    if (!sha) throw new Error(`File not found in repo: ${path}`);
    return this.serial(async () => (await this.load(path, sha)).text);
  }

  // create a new file; fails if it already exists
  create(path: string, text: string): Promise<void>
  {
    return this.serial(async () =>
    {
      if (!(await this.put(path, text, null, `know-edge: create ${path}`))) throw new Error(`File already exists: ${path}`);
    });
  }

  // fn must give the same result when replayed on a newer text (it is re-run at commit time)
  async modify(path: string, fn: (text: string) => string): Promise<void>
  {
    if (!this.edits.has(path))
    {
      const current = await this.serial(() => this.latest(path));
      // another edit may have started this file while we were reading
      if (!this.edits.has(path)) this.edits.set(path, { ops: [], text: current?.text ?? '' });
    }
    const pending = this.edits.get(path)!;
    const text = fn(pending.text);
    if (text === pending.text) return;
    pending.ops.push(fn);
    pending.text = text;
    this.onEditsChange(this.editCount);
    if (this.edit_timer) clearTimeout(this.edit_timer);
    this.edit_timer = setTimeout(() => this.flushEdits().catch((e) => this.onError(e)), EDIT_DELAY_MS);
  }

  // commit all unsaved edits, one commit per file
  flushEdits(): Promise<void>
  {
    if (this.edit_timer) clearTimeout(this.edit_timer);
    this.edit_timer = null;
    return this.serial(async () =>
    {
      for (const [path, pending] of [...this.edits])
      {
        // edits made while this commit runs stay for the next one
        const ops = pending.ops.slice();
        let written: string | null = null;
        for (let attempt = 0; attempt < 2 && written === null; attempt++)
        {
          const current = await this.latest(path);
          const old_text = current?.text ?? '';
          const text = ops.reduce((t, op) => op(t), old_text);
          if (text === old_text) written = text;
          else if (await this.put(path, text, current?.sha ?? null, `know-edge: ${ops.length} edit(s) to ${path}`)) written = text;
        }
        if (written === null) throw new Error(`Could not write ${path}: it keeps changing on GitHub`);
        pending.ops.splice(0, ops.length);
        if (pending.ops.length) pending.text = pending.ops.reduce((t, op) => op(t), written);
        else this.edits.delete(path);
        this.onEditsChange(this.editCount);
      }
    });
  }

  async readLogs(): Promise<LogEntry[]>
  {
    await this.refresh();
    const prefix = folderPrefix(this.config.log_folder);
    const entries: LogEntry[] = [];
    for (const [path, sha] of [...this.tree])
    {
      if (!path.startsWith(prefix) || !path.endsWith('.jsonl')) continue;
      const text = await this.serial(async () => (await this.load(path, sha)).text);
      for (const line of text.split('\n'))
      {
        if (line.trim()) entries.push(JSON.parse(line) as LogEntry);
      }
    }
    entries.push(...this.pending);
    entries.sort((a, b) => a.t - b.t);
    return entries;
  }

  async appendLog(entry: LogEntry): Promise<void>
  {
    this.pending.push(entry);
    this.savePending();
    if (this.pending.length >= FLUSH_COUNT) await this.flush();
    else this.scheduleFlush();
  }

  private scheduleFlush(): void
  {
    if (this.flush_timer) clearTimeout(this.flush_timer);
    this.flush_timer = setTimeout(() => this.flush().catch((e) => this.onError(e)), FLUSH_DELAY_MS);
  }

  // commit buffered reviews to this device's log file
  flush(): Promise<void>
  {
    if (this.flush_timer) clearTimeout(this.flush_timer);
    this.flush_timer = null;
    return this.serial(async () =>
    {
      if (!this.pending.length) return;
      const batch = this.pending.slice();
      const lines = batch.map((e) => JSON.stringify(e) + '\n').join('');
      for (let attempt = 0; attempt < 2; attempt++)
      {
        const current = await this.latest(this.ownLogPath);
        const message = `know-edge: ${batch.length} review(s) from ${this.config.device}`;
        if (await this.put(this.ownLogPath, (current?.text ?? '') + lines, current?.sha ?? null, message))
        {
          this.pending.splice(0, batch.length);
          this.savePending();
          return;
        }
      }
      throw new Error('Could not write the review log: it keeps changing on GitHub');
    });
  }
}
