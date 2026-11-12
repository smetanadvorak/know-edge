/**
 * Engine: everything the plugin and the web client do with decks and reviews, on top of a Storage.
 * ids, sessions, stats, ratings, deck edits.
 *
 * prompt:
 *   can it have an alternative interfaece for when obsidian is not available? like a webpage?
 *   but based on the same "backend"
 *   git suits me well / a vps / should cover both
 */
import { addChild, addSibling, deleteItem, moveItem, updateItem, type Draft, type Ref } from './edit_ops';
import { addMissingIds, collectIds, newId } from './ids';
import { parseDeck } from './parser';
import { Scheduler } from './scheduler';
import { buildSteps, deckStats, type DeckStats } from './session';
import type { SchedulerParams, Storage } from './storage';
import type { Deck, SessionStep } from './types';

export type EditOp = (deck: Deck, lines: string[], existing: Set<string>) => boolean;

export class Engine
{
  scheduler: Scheduler;

  constructor(public storage: Storage, public params: SchedulerParams)
  {
    this.scheduler = new Scheduler(params.request_retention, params.maximum_interval);
  }

  async loadDeck(path: string): Promise<Deck>
  {
    return parseDeck(path, await this.storage.read(path));
  }

  // ids used in all decks and in the given files
  async allIds(paths: string[]): Promise<Set<string>>
  {
    const existing = new Set<string>();
    const all = new Set([...(await this.storage.deckPaths()), ...paths]);
    for (const path of all) collectIds(await this.storage.read(path), existing);
    return existing;
  }

  // write ids for headings that have none; returns how many were added
  async ensureIds(paths: string[]): Promise<number>
  {
    const existing = await this.allIds(paths);
    let added = 0;
    for (const path of paths)
    {
      await this.storage.modify(path, (text) =>
      {
        const result = addMissingIds(text, existing);
        added += result.added;
        return result.text;
      });
    }
    return added;
  }

  async refreshSchedule(): Promise<void>
  {
    this.scheduler = new Scheduler(this.params.request_retention, this.params.maximum_interval);
    this.scheduler.load(await this.storage.readLogs());
  }

  async buildSession(paths: string[]): Promise<SessionStep[]>
  {
    await this.ensureIds(paths);
    await this.refreshSchedule();
    const now = new Date();
    const steps: SessionStep[] = [];
    for (const path of paths) steps.push(...buildSteps(await this.loadDeck(path), this.scheduler, now));
    return steps;
  }

  async rate(step: SessionStep, rating: number): Promise<void>
  {
    const entry = { id: step.item.id!, t: Date.now(), r: rating };
    await this.storage.appendLog(entry);
    this.scheduler.apply(entry);
  }

  async allDeckStats(): Promise<DeckStats[]>
  {
    await this.refreshSchedule();
    const now = new Date();
    const stats: DeckStats[] = [];
    for (const path of await this.storage.deckPaths()) stats.push(deckStats(await this.loadDeck(path), this.scheduler, now));
    return stats;
  }

  // apply an edit op to a file: missing ids are added first, then the file is re-parsed and the op runs on its lines
  async editFile(path: string, op: EditOp): Promise<boolean>
  {
    const existing = await this.allIds([path]);
    let ok = false;
    await this.storage.modify(path, (text) =>
    {
      const with_ids = addMissingIds(text, existing).text;
      const lines = with_ids.split('\n');
      ok = op(parseDeck(path, with_ids), lines, existing);
      return ok ? lines.join('\n') : with_ids;
    });
    return ok;
  }

  async addChildItem(path: string, parent: Ref | null, draft: Draft): Promise<string | null>
  {
    let id = '';
    const ok = await this.editFile(path, (deck, lines, existing) =>
    {
      id = newId(existing);
      return addChild(deck, lines, parent, draft, id);
    });
    return ok ? id : null;
  }

  async addSiblingItem(path: string, ref: Ref, draft: Draft): Promise<string | null>
  {
    let id = '';
    const ok = await this.editFile(path, (deck, lines, existing) =>
    {
      id = newId(existing);
      return addSibling(deck, lines, ref, draft, id);
    });
    return ok ? id : null;
  }

  updateItem(path: string, ref: Ref, draft: Draft): Promise<boolean>
  {
    return this.editFile(path, (deck, lines) => updateItem(deck, lines, ref, draft));
  }

  deleteItem(path: string, ref: Ref): Promise<boolean>
  {
    return this.editFile(path, (deck, lines) => deleteItem(deck, lines, ref));
  }

  moveItem(path: string, ref: Ref, dir: -1 | 1): Promise<boolean>
  {
    return this.editFile(path, (deck, lines) => moveItem(deck, lines, ref, dir));
  }
}
