/**
 * Shared types: deck tree items, review log entries, session steps.
 *
 * prompt:
 *   group qa threads into single entity ... extend the multicard idea into a tree,
 *   that is being able to have multiple follow-ups on the same level, each potentially starting a subtree.
 *   markdown with chapter structure for the tree ... top level # to split between questions,
 *   so that one file is multiple questions.
 *   2. separate file  3. markers  4. block id per item
 */

export interface Item
{
  id: string | null;
  level: number;
  title: string;
  question: string;
  answer: string;
  // 0-based line index of the heading in the file
  line: number;
  // 0-based line index where the item's subtree ends (exclusive)
  end: number;
  parent: Item | null;
  children: Item[];
}

export interface Deck
{
  path: string;
  roots: Item[];
}

export interface LogEntry
{
  // item id
  id: string;
  // unix time, ms
  t: number;
  // fsrs rating: 1 again, 2 hard, 3 good, 4 easy
  r: number;
}

export interface SessionStep
{
  item: Item;
  unit: Item;
  deck_path: string;
}

export function isCard(item: Item): boolean
{
  return item.id !== null && item.question.length > 0;
}

export function ancestors(item: Item): Item[]
{
  const path: Item[] = [];
  let node = item.parent;
  while (node)
  {
    path.unshift(node);
    node = node.parent;
  }
  return path;
}

export function itemLabel(item: Item, max_len = 50): string
{
  if (item.title) return item.title;
  const first = item.question.split('\n')[0].trim();
  return first.length > max_len ? first.slice(0, max_len) + '…' : first;
}
