/**
 * Side panel hosting the deck editor (DeckEditor.svelte), bound to the open markdown file.
 * the plugin feeds it file text (from the editor or from disk) and the editor cursor line.
 *
 * prompt:
 *   Can we establish rathern an interface for createion?
 *   1. let's go with b directly  2. yes. (pre-select from editor cursor)  3. yes.
 */
import { ItemView, Modal, Setting, TFile, type App, type WorkspaceLeaf } from 'obsidian';
import { mount, unmount } from 'svelte';
import { get, writable } from 'svelte/store';
import { parseDeck, walk, type Deck, type Draft, type Item, type Ref } from '@know-edge/core';
import DeckEditor from '@know-edge/ui/DeckEditor.svelte';
import type KnowEdgePlugin from '../main';
import { setIcon } from './ui_glue';

export const EDITOR_VIEW = 'know-edge-editor';

class ConfirmModal extends Modal
{
  constructor(app: App, private message: string, private on_confirm: () => void)
  {
    super(app);
  }

  onOpen(): void
  {
    this.contentEl.createEl('p', { text: this.message });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText('Delete').setWarning().onClick(() =>
      {
        this.close();
        this.on_confirm();
      }))
      .addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()));
  }

  onClose(): void
  {
    this.contentEl.empty();
  }
}

export class DeckEditorView extends ItemView
{
  file: TFile | null = null;
  private ui: Record<string, any> | null = null;
  private deck = writable<Deck | null>(null);
  private selected = writable<number | null>(null);

  constructor(leaf: WorkspaceLeaf, private plugin: KnowEdgePlugin)
  {
    super(leaf);
  }

  getViewType(): string { return EDITOR_VIEW; }
  getDisplayText(): string { return 'Know-edge editor'; }
  getIcon(): string { return 'list-tree'; }

  async onOpen(): Promise<void>
  {
    const plugin = this.plugin;
    this.ui = mount(DeckEditor, {
      target: this.contentEl,
      props: {
        deck: this.deck,
        selected: this.selected,
        setIcon,
        actions: {
          addChild: (parent: Ref | null, draft: Draft) => plugin.edited(plugin.engine.addChildItem(this.file!.path, parent, draft)),
          addSibling: (ref: Ref, draft: Draft) => plugin.edited(plugin.engine.addSiblingItem(this.file!.path, ref, draft)),
          update: (ref: Ref, draft: Draft) => plugin.edited(plugin.engine.updateItem(this.file!.path, ref, draft)),
          move: (ref: Ref, dir: -1 | 1) => plugin.edited(plugin.engine.moveItem(this.file!.path, ref, dir)),
          remove: (ref: Ref, label: string) =>
            new ConfirmModal(this.app, `Delete "${label}" and all its follow-ups?`, () => plugin.edited(plugin.engine.deleteItem(this.file!.path, ref))).open(),
        },
      },
    });
    await this.bind(this.app.workspace.getActiveFile());
  }

  async bind(file: TFile | null): Promise<void>
  {
    if (!file || file.extension !== 'md') return;
    this.file = file;
    this.setText(await this.app.vault.read(file));
  }

  setText(text: string): void
  {
    if (this.file) this.deck.set(parseDeck(this.file.path, text));
  }

  // highlight the deepest item whose subtree contains the cursor line
  setCursor(line: number): void
  {
    const deck = get(this.deck);
    let found: Item | null = null;
    if (deck)
    {
      walk(deck.roots, (item) =>
      {
        if (item.line <= line && line < item.end) found = item;
      });
    }
    this.selected.set(found ? (found as Item).line : null);
  }

  async onClose(): Promise<void>
  {
    if (this.ui) unmount(this.ui);
    this.ui = null;
  }
}
