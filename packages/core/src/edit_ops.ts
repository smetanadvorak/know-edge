/**
 * Text operations on a deck file used by the deck editor panel:
 * add child, add sibling, update, delete, move up/down.
 * each op gets the parsed deck and the file lines, mutates the lines in place, returns false if it could not apply.
 * items are found by id, or by heading line when the ref has no id.
 *
 * prompt:
 *   Can we establish rathern an interface for createion?
 *   1. let's go with b directly (deck editor panel: tree, add child / sibling, edit, delete, move up/down,
 *      inline q/a editor, two-way sync with the file)
 */
import { walk } from './parser';
import type { Deck, Item } from './types';

export interface Draft
{
  label: string;
  question: string;
  answer: string;
}

export interface Ref
{
  id: string | null;
  line: number;
}

export interface EditorActions
{
  addChild: (parent: Ref | null, draft: Draft) => Promise<string | null>;
  addSibling: (ref: Ref, draft: Draft) => Promise<string | null>;
  update: (ref: Ref, draft: Draft) => Promise<boolean>;
  remove: (ref: Ref, label: string) => void;
  move: (ref: Ref, dir: -1 | 1) => Promise<boolean>;
}

export function refOf(item: Item): Ref
{
  return { id: item.id, line: item.line };
}

export function refMatches(ref: Ref, item: Item): boolean
{
  return ref.id !== null ? item.id === ref.id : item.line === ref.line;
}

export function findItem(deck: Deck, ref: Ref): Item | null
{
  let found: Item | null = null;
  walk(deck.roots, (item) =>
  {
    if (!found && refMatches(ref, item)) found = item;
  });
  return found;
}

function markerLines(marker: string, text: string): string[]
{
  const parts = text.trim().split('\n');
  parts[0] = (marker + parts[0]).trimEnd();
  return parts;
}

export function itemLines(level: number, id: string, draft: Draft): string[]
{
  const label = draft.label.trim();
  const heading = '#'.repeat(level) + (label ? ' ' + label : '') + ' ^' + id;
  return [heading, ...markerLines('Q: ', draft.question), ...markerLines('A: ', draft.answer)];
}

// replace lines [start, end) with block, keeping one blank line around it
function replaceRange(lines: string[], start: number, end: number, block: string[]): void
{
  const out = block.slice();
  if (start > 0 && lines[start - 1].trim() !== '') out.unshift('');
  if (end >= lines.length || lines[end].trim() !== '') out.push('');
  lines.splice(start, end - start, ...out);
}

export function addChild(deck: Deck, lines: string[], parent_ref: Ref | null, draft: Draft, id: string): boolean
{
  if (parent_ref === null)
  {
    replaceRange(lines, lines.length, lines.length, itemLines(1, id, draft));
    return true;
  }
  const parent = findItem(deck, parent_ref);
  if (!parent || parent.level >= 6) return false;
  replaceRange(lines, parent.end, parent.end, itemLines(parent.level + 1, id, draft));
  return true;
}

export function addSibling(deck: Deck, lines: string[], ref: Ref, draft: Draft, id: string): boolean
{
  const item = findItem(deck, ref);
  if (!item) return false;
  replaceRange(lines, item.end, item.end, itemLines(item.level, id, draft));
  return true;
}

// rewrites the heading and the body up to the first child; other text in the body is dropped
export function updateItem(deck: Deck, lines: string[], ref: Ref, draft: Draft): boolean
{
  const item = findItem(deck, ref);
  if (!item || item.id === null) return false;
  const body_end = item.children.length ? item.children[0].line : item.end;
  replaceRange(lines, item.line, body_end, itemLines(item.level, item.id, draft));
  return true;
}

export function deleteItem(deck: Deck, lines: string[], ref: Ref): boolean
{
  const item = findItem(deck, ref);
  if (!item) return false;
  lines.splice(item.line, item.end - item.line);
  return true;
}

function blockWithBlank(lines: string[], item: Item): string[]
{
  const block = lines.slice(item.line, item.end);
  if (block[block.length - 1].trim() !== '') block.push('');
  return block;
}

export function moveItem(deck: Deck, lines: string[], ref: Ref, dir: -1 | 1): boolean
{
  const item = findItem(deck, ref);
  if (!item) return false;
  const siblings = item.parent ? item.parent.children : deck.roots;
  const other = siblings[siblings.indexOf(item) + dir];
  if (!other) return false;
  const [first, second] = dir < 0 ? [other, item] : [item, other];
  const swapped = [...blockWithBlank(lines, second), ...blockWithBlank(lines, first)];
  lines.splice(first.line, second.end - first.line, ...swapped);
  return true;
}
