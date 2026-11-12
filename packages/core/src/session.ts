/**
 * Build the list of review steps for a deck.
 * for each unit (root heading): take the due items plus the path from the root to each of them,
 * then walk the unit depth-first in file order. each item is asked once per session.
 * unit due date = min of its items' due dates.
 *
 * prompt:
 *   only items due with path to them
 *   1. let's ask for now starting from the top. 2. depth first 3. due right away 4. we continue
 *   Let's say, min of item due dates for now
 */
import { walk } from './parser';
import type { Scheduler } from './scheduler';
import { isCard, type Deck, type Item, type SessionStep } from './types';

export function buildSteps(deck: Deck, scheduler: Scheduler, now: Date): SessionStep[]
{
  const steps: SessionStep[] = [];
  for (const unit of deck.roots)
  {
    const needed = new Set<Item>();
    walk([unit], (item) =>
    {
      if (!isCard(item) || !scheduler.isDue(item.id!, now)) return;
      let node: Item | null = item;
      while (node && !needed.has(node))
      {
        needed.add(node);
        node = node.parent;
      }
    });
    if (needed.size === 0) continue;

    walk([unit], (item) =>
    {
      if (needed.has(item) && isCard(item)) steps.push({ item, unit, deck_path: deck.path });
    });
  }
  return steps;
}

export function unitDue(unit: Item, scheduler: Scheduler): Date | null
{
  let min: Date | null = null;
  let has_new = false;
  walk([unit], (item) =>
  {
    if (!isCard(item)) return;
    const due = scheduler.dueDate(item.id!);
    if (due === null) has_new = true;
    else if (!min || due < min) min = due;
  });
  // a new item makes the unit due now
  return has_new ? new Date(0) : min;
}

export interface DeckStats
{
  path: string;
  due_units: number;
  due_items: number;
  new_items: number;
}

export function deckStats(deck: Deck, scheduler: Scheduler, now: Date): DeckStats
{
  const stats: DeckStats = { path: deck.path, due_units: 0, due_items: 0, new_items: 0 };
  for (const unit of deck.roots)
  {
    const due = unitDue(unit, scheduler);
    if (due && due <= now) stats.due_units++;
  }
  walk(deck.roots, (item) =>
  {
    if (!isCard(item)) return;
    if (scheduler.isNew(item.id!)) stats.new_items++;
    else if (scheduler.isDue(item.id!, now)) stats.due_items++;
  });
  return stats;
}
