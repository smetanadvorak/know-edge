/**
 * Obsidian tab listing decks with due / new counts. click a deck to review it.
 *
 * prompt:
 *   5. ok, what gui can we get?
 *   deck is one file.
 */
import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { mount, unmount } from 'svelte';
import type KnowEdgePlugin from '../main';
import DeckList from '@know-edge/ui/DeckList.svelte';

export const DECKS_VIEW = 'know-edge-decks';

export class DeckListView extends ItemView
{
  private ui: Record<string, any> | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: KnowEdgePlugin)
  {
    super(leaf);
  }

  getViewType(): string { return DECKS_VIEW; }
  getDisplayText(): string { return 'Know-edge decks'; }
  getIcon(): string { return 'layers'; }

  async onOpen(): Promise<void>
  {
    await this.refresh();
  }

  async refresh(): Promise<void>
  {
    const decks = await this.plugin.engine.allDeckStats();
    if (this.ui) unmount(this.ui);
    this.contentEl.empty();
    this.ui = mount(DeckList, {
      target: this.contentEl,
      props: { decks, onOpen: (path: string) => this.plugin.reviewPath(path) },
    });
  }

  async onClose(): Promise<void>
  {
    if (this.ui) unmount(this.ui);
    this.ui = null;
  }
}
