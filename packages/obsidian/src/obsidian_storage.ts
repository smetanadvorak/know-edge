/**
 * Storage implementation on the Obsidian vault.
 * review log: append-only, one jsonl file per device: <log_folder>/log-<device>.jsonl.
 * the log folder is a normal (non-dot) folder, because some sync tools skip dot folders.
 *
 * prompt:
 *   2. separate file; or db, needs discussion i guess.
 *   (agreed: append-only review log, one file per device, state rebuilt by replay)
 *   can it have an alternative interfaece for when obsidian is not available? like a webpage?
 *   but based on the same "backend"
 */
import { normalizePath, TFile, type App } from 'obsidian';
import type { LogEntry, Storage } from '@know-edge/core';

export class ObsidianStorage implements Storage
{
  constructor(private app: App, public deck_folder: string, public log_folder: string, public device: string) {}

  get ownLogPath(): string
  {
    return normalizePath(`${this.log_folder}/log-${this.device}.jsonl`);
  }

  async deckPaths(): Promise<string[]>
  {
    const prefix = normalizePath(this.deck_folder) + '/';
    return this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(prefix)).map((f) => f.path);
  }

  private file(path: string): TFile
  {
    const file = this.app.vault.getFileByPath(path);
    if (!file) throw new Error(`know-edge: file not found: ${path}`);
    return file;
  }

  async read(path: string): Promise<string>
  {
    return this.app.vault.cachedRead(this.file(path));
  }

  async modify(path: string, fn: (text: string) => string): Promise<void>
  {
    await this.app.vault.process(this.file(path), fn);
  }

  async readLogs(): Promise<LogEntry[]>
  {
    const adapter = this.app.vault.adapter;
    const folder = normalizePath(this.log_folder);
    if (!(await adapter.exists(folder))) return [];

    const entries: LogEntry[] = [];
    const listing = await adapter.list(folder);
    for (const file_path of listing.files)
    {
      if (!file_path.endsWith('.jsonl')) continue;
      const text = await adapter.read(file_path);
      for (const line of text.split('\n'))
      {
        if (line.trim()) entries.push(JSON.parse(line) as LogEntry);
      }
    }
    entries.sort((a, b) => a.t - b.t);
    return entries;
  }

  async appendLog(entry: LogEntry): Promise<void>
  {
    const adapter = this.app.vault.adapter;
    const folder = normalizePath(this.log_folder);
    if (!(await adapter.exists(folder))) await adapter.mkdir(folder);
    const line = JSON.stringify(entry) + '\n';
    if (await adapter.exists(this.ownLogPath)) await adapter.append(this.ownLogPath, line);
    else await adapter.write(this.ownLogPath, line);
  }
}
