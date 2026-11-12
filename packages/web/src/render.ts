/**
 * Web implementations of the render / icon hooks used by the shared ui components:
 * markdown-it + katex for markdown, lucide for icons.
 * obsidian-only syntax (![[embeds]], [[wikilinks]]) is not handled.
 *
 * prompt:
 *   can it have an alternative interfaece for when obsidian is not available? like a webpage?
 *   but based on the same "backend"
 */
import markdown_it_katex from '@vscode/markdown-it-katex';
import { ArrowDown, ArrowUp, CornerDownRight, Plus, Trash2, createElement, type IconNode } from 'lucide';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ linkify: true }).use(markdown_it_katex);

export function render(el: HTMLElement, text: string, _source: string): void
{
  el.innerHTML = md.render(text);
}

const icons: Record<string, IconNode> = {
  'corner-down-right': CornerDownRight,
  plus: Plus,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'trash-2': Trash2,
};

export function setIcon(el: HTMLElement, name: string): void
{
  el.replaceChildren(createElement(icons[name], { width: 16, height: 16 }));
}
