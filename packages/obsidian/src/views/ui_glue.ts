/**
 * Obsidian implementations of the render / icon hooks used by the shared ui components.
 *
 * prompt:
 *   5. ok, what gui can we get?  (q/a rendered with obsidian's markdown renderer)
 *   can it have an alternative interfaece for when obsidian is not available? like a webpage?
 *   but based on the same "backend"
 */
import { MarkdownRenderer, setIcon, type App, type Component } from 'obsidian';

export function obsidianRender(app: App, owner: Component)
{
  return (el: HTMLElement, text: string, source: string) =>
  {
    el.empty();
    MarkdownRenderer.render(app, text, el, source, owner);
  };
}

export { setIcon };
