/**
 * Obsidian tab hosting the review screen (Review.svelte).
 *
 * prompt:
 *   5. ok, what gui can we get?
 *   (edit the current card during review: "Edit card" button, inline form, keeps the session) I'd like to be able to edit cards during reviewing. For example, by button "Edit card".
 */
import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { mount, unmount } from 'svelte';
import type KnowEdgePlugin from '../main';
import { refOf, type Draft, type SessionStep } from '@know-edge/core';
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
        onEdit: (step: SessionStep, draft: Draft) => this.plugin.edited(this.plugin.engine.updateItem(step.deck_path, refOf(step.item), draft)),
      },
    });
  }

  async onClose(): Promise<void>
  {
    if (this.ui) unmount(this.ui);
    this.ui = null;
  }
}
