/**
 * Obsidian tab hosting the review screen (Review.svelte).
 *
 * prompt:
 *   5. ok, what gui can we get?
 */
import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { mount, unmount } from 'svelte';
import type KnowEdgePlugin from '../main';
import type { SessionStep } from '@know-edge/core';
import Review from '@know-edge/ui/Review.svelte';
import { obsidianRender } from './ui_glue';

export const REVIEW_VIEW = 'know-edge-review';

export class ReviewView extends ItemView
{
  private ui: Record<string, any> | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: KnowEdgePlugin)
  {
    super(leaf);
  }

  getViewType(): string { return REVIEW_VIEW; }
  getDisplayText(): string { return 'Know-edge review'; }
  getIcon(): string { return 'brain'; }

  setSteps(steps: SessionStep[]): void
  {
    if (this.ui) unmount(this.ui);
    this.contentEl.empty();
    this.ui = mount(Review, {
      target: this.contentEl,
      props: {
        render: obsidianRender(this.app, this),
        steps,
        onRate: (step: SessionStep, rating: number) => this.plugin.engine.rate(step, rating),
      },
    });
  }

  async onClose(): Promise<void>
  {
    if (this.ui) unmount(this.ui);
    this.ui = null;
  }
}
