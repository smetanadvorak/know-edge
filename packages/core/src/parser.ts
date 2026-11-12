/**
 * Parse a deck markdown file into a tree of items.
 *
 * format:
 *   # title ^id        -> root of a multicard (unit)
 *   ## title ^id       -> follow-up; siblings on the same level are branches
 *   Q: ...             -> question, runs until the A: line (multiline)
 *   A: ...             -> answer, runs until the next heading (multiline)
 *   heading text is optional, the ^id is the item identity.
 *   headings and Q:/A: markers inside code fences are ignored; frontmatter is skipped.
 *
 * prompt:
 *   markdown with chapter structure for the tree is sufficient? Top level # to split between questions,
 *   so that one file is multiple questions.
 *   3. markers
 *   will this allow to have multiline answers/questions?
 *   deck is one file.
 */
import type { Deck, Item } from './types';

const heading_re = /^(#{1,6})(?:\s+(.*?))?\s*$/;
const id_re = /(?:^|\s)\^([A-Za-z0-9-]+)$/;
const fence_re = /^\s*(```|~~~)/;

export function parseDeck(path: string, text: string): Deck
{
  const lines = text.split('\n');
  const roots: Item[] = [];
  const stack: Item[] = [];
  const flat: Item[] = [];
  let current: Item | null = null;
  let mode: 'none' | 'q' | 'a' = 'none';
  let q_lines: string[] = [];
  let a_lines: string[] = [];
  let in_fence = false;

  const flush = () =>
  {
    if (!current) return;
    current.question = q_lines.join('\n').trim();
    current.answer = a_lines.join('\n').trim();
  };

  let start = 0;
  // skip frontmatter
  if (lines[0]?.trim() === '---')
  {
    const end = lines.indexOf('---', 1);
    if (end > 0) start = end + 1;
  }

  for (let i = start; i < lines.length; i++)
  {
    const line = lines[i];

    if (fence_re.test(line)) in_fence = !in_fence;

    const heading = in_fence ? null : heading_re.exec(line);
    if (heading)
    {
      flush();
      const level = heading[1].length;
      let title = heading[2] ?? '';
      let id: string | null = null;
      const id_match = id_re.exec(title);
      if (id_match)
      {
        id = id_match[1];
        title = title.slice(0, id_match.index).trim();
      }
      const item: Item = { id, level, title, question: '', answer: '', line: i, end: lines.length, parent: null, children: [] };
      flat.push(item);

      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      if (stack.length)
      {
        item.parent = stack[stack.length - 1];
        item.parent.children.push(item);
      }
      else
      {
        roots.push(item);
      }
      stack.push(item);

      current = item;
      mode = 'none';
      q_lines = [];
      a_lines = [];
      continue;
    }

    if (!current) continue;

    if (!in_fence && line.startsWith('Q:'))
    {
      mode = 'q';
      q_lines.push(line.slice(2).trimStart());
      continue;
    }
    if (!in_fence && line.startsWith('A:'))
    {
      mode = 'a';
      a_lines.push(line.slice(2).trimStart());
      continue;
    }
    if (mode === 'q') q_lines.push(line);
    else if (mode === 'a') a_lines.push(line);
  }
  flush();

  // subtree end = next heading with the same or lower level
  for (let i = 0; i < flat.length; i++)
  {
    let j = i + 1;
    while (j < flat.length && flat[j].level > flat[i].level) j++;
    flat[i].end = j < flat.length ? flat[j].line : lines.length;
  }

  return { path, roots };
}

export function walk(items: Item[], fn: (item: Item) => void): void
{
  for (const item of items)
  {
    fn(item);
    walk(item.children, fn);
  }
}
