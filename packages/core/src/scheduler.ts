/**
 * FSRS state per item, rebuilt by replaying the review log.
 * an item with no review is new and due right away.
 *
 * prompt:
 *   1. fsrs
 *   3. new items: due right away
 *   record it (rating of path items is recorded as an early review)
 */
import { createEmptyCard, fsrs, generatorParameters, type Card, type FSRS, type Grade } from 'ts-fsrs';
import type { LogEntry } from './types';

export class Scheduler
{
  private f: FSRS;
  private cards = new Map<string, Card>();

  constructor(request_retention: number, maximum_interval: number)
  {
    // fuzz off: replay must give the same result on every device
    this.f = fsrs(generatorParameters({ request_retention, maximum_interval, enable_fuzz: false }));
  }

  load(entries: LogEntry[]): void
  {
    this.cards.clear();
    for (const entry of entries) this.apply(entry);
  }

  apply(entry: LogEntry): void
  {
    const now = new Date(entry.t);
    const card = this.cards.get(entry.id) ?? createEmptyCard(now);
    this.cards.set(entry.id, this.f.next(card, now, entry.r as Grade).card);
  }

  // null means the item was never reviewed
  dueDate(id: string): Date | null
  {
    return this.cards.get(id)?.due ?? null;
  }

  isNew(id: string): boolean
  {
    return !this.cards.has(id);
  }

  isDue(id: string, now: Date): boolean
  {
    const due = this.dueDate(id);
    return due === null || due <= now;
  }
}
