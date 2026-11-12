/**
 * Generate block ids for items and write missing ones into a deck file.
 * ids are random, 6 chars base36, unique across all decks of the vault.
 *
 * prompt:
 *   4. if id is per file and fsrs needs id per item, then the obsidian id is no sufficient?
 *      or it is actually a block ID existing multiple in a file?
 */
import { parseDeck, walk } from './parser';

export function newId(existing: Set<string>): string
{
  let id = '';
  while (id.length !== 6 || existing.has(id))
  {
    id = Math.random().toString(36).slice(2, 8);
  }
  existing.add(id);
  return id;
}

export function addMissingIds(text: string, existing: Set<string>): { text: string; added: number }
{
  const deck = parseDeck('', text);
  const lines = text.split('\n');
  let added = 0;
  walk(deck.roots, (item) =>
  {
    if (item.id !== null) return;
    lines[item.line] = lines[item.line].replace(/\s*$/, '') + ' ^' + newId(existing);
    added++;
  });
  return { text: lines.join('\n'), added };
}

export function collectIds(text: string, into: Set<string>): void
{
  walk(parseDeck('', text).roots, (item) =>
  {
    if (item.id !== null) into.add(item.id);
  });
}
