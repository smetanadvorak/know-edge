/**
 * Know-edge: Obsidian plugin for spaced repetition (FSRS) with tree-shaped multicards.
 * see the spec (claude/spec.md in the project) for format and scheduling rules.
 *
 * prompt:
 *   I would like to create a personalised spaced learning app similar to Anki. The main limitation of anki is one
 *   card per question, and that the cards get ordered more and more randomly as repetitions go.
 *   For example, I have a question that asks for a definition. A follow up question on that subject, if created as
 *   separate card, would be ordered and scheduled on its own. I would like to be able to, thus, group such qa threads
 *   into single entity that receives a single repetition score, weighted from the components (or min of the
 *   components). We can skip the rest of the multicard if all items below are scheduled later, as a shortcut variant.
 *   I'd like to also extend the multicard idea into a tree, that is being able to have multiple follow-ups on the same
 *   level, each potentially starting a subtree.
 *   The repetition interface should indicate the level and tree structure, without showing all question at a time,
 *   and not showing the tree ahead, only how we got here (make showing the whole tree an option, the ahead part
 *   grayed out until answered).
 *   I'd like to host it myself somewhere where I choose, so that I could use from multiple devices. If there is some
 *   developed infrastructure I can attach to, like obsidian or else, I would like to consider.
 *   The underlying format should be easy and developed with easy serialization and transfer in mind. I guess,
 *   markdown with chapter structure for the tree is sufficient? Top level # to split between questions, so that one
 *   file is multiple questions.
 *   We can develop and test locally at first, and think of deploying online later.
 *
 *   1. fsrs 2. separate file; or db, needs discussion i guess. 3. markers 5. i use obsidian quite regularly
 *   6. whatever is best fit
 *   4. if id is per file and fsrs needs id per item, then the obsidian id is no sufficient? or it is actually a block
 *   ID existing multiple in a file? 5. ok, what gui can we get? 2. ok 3. will this allow to have multiline
 *   answers/questions? Let's say, min of item due dates for now. deck is one file.
 *   only items due with path to them
 *   1. oof. let's ask for now starting from the top. 2. depth first 3. due right away 4. we continue
 *   record it
 *   2. know-edge 3. test vault
 *   Can we establish rathern an interface for createion?
 *   1. let's go with b directly 2. yes. 3. yes
 *   can it have an alternative interfaece for when obsidian is not available? like a webpage?
 *   but based on the same "backend"
 *   git suits me well / a vps / should cover both
 */
import { EditorView } from '@codemirror/view';
import { Notice, Plugin, TFile, editorInfoField } from 'obsidian';
import { Engine, newId } from '@know-edge/core';
import { ObsidianStorage } from './obsidian_storage';
import { DEFAULT_SETTINGS, KnowEdgeSettingTab, type KnowEdgeSettings } from './settings';
import { DECKS_VIEW, DeckListView } from './views/deck_list_view';
import { DeckEditorView, EDITOR_VIEW } from './views/deck_editor_view';
import { REVIEW_VIEW, ReviewView } from './views/review_view';

const DEVICE_KEY = 'know-edge-device';

export default class KnowEdgePlugin extends Plugin
{
  settings: KnowEdgeSettings = { ...DEFAULT_SETTINGS };
  device = '';
  storage!: ObsidianStorage;
  engine!: Engine;

  async onload(): Promise<void>
  {
    await this.loadSettings();
    this.device = this.app.loadLocalStorage(DEVICE_KEY) ?? '';
    if (!this.device)
    {
      this.device = newId(new Set());
      this.app.saveLocalStorage(DEVICE_KEY, this.device);
    }
    this.storage = new ObsidianStorage(this.app, this.settings.deck_folder, this.settings.log_folder, this.device);
    this.engine = new Engine(this.storage, this.settings);

    this.registerView(REVIEW_VIEW, (leaf) => new ReviewView(leaf, this));
    this.registerView(DECKS_VIEW, (leaf) => new DeckListView(leaf, this));
    this.registerView(EDITOR_VIEW, (leaf) => new DeckEditorView(leaf, this));

    this.addRibbonIcon('brain', 'Know-edge decks', () => this.openDecks());
    this.addRibbonIcon('list-tree', 'Know-edge editor', () => this.openEditor());

    // keep the editor panel bound to the open file and in sync with it
    this.registerEvent(this.app.workspace.on('file-open', (file) =>
    {
      for (const view of this.editorViews()) view.bind(file);
    }));
    this.registerEvent(this.app.vault.on('modify', (file) =>
    {
      if (!(file instanceof TFile)) return;
      for (const view of this.editorViews()) if (view.file?.path === file.path) view.bind(file);
    }));
    this.registerEditorExtension(EditorView.updateListener.of((update) =>
    {
      if (!update.docChanged && !update.selectionSet) return;
      const file = update.state.field(editorInfoField, false)?.file;
      if (!file) return;
      const line = update.state.doc.lineAt(update.state.selection.main.head).number - 1;
      for (const view of this.editorViews())
      {
        if (view.file?.path !== file.path) continue;
        if (update.docChanged) view.setText(update.state.doc.toString());
        view.setCursor(line);
      }
    }));

    this.addCommand({
      id: 'open-decks',
      name: 'Open deck list',
      callback: () => this.openDecks(),
    });
    this.addCommand({
      id: 'open-editor',
      name: 'Open deck editor',
      callback: () => this.openEditor(),
    });
    this.addCommand({
      id: 'review-current-file',
      name: 'Review current file',
      checkCallback: (checking) =>
      {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== 'md') return false;
        if (!checking) this.review([file.path]);
        return true;
      },
    });
    this.addCommand({
      id: 'review-all',
      name: 'Review all due',
      callback: async () => this.review(await this.storage.deckPaths()),
    });
    this.addCommand({
      id: 'add-ids-current-file',
      name: 'Add missing IDs to current file',
      checkCallback: (checking) =>
      {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== 'md') return false;
        if (!checking) this.addIds(file.path);
        return true;
      },
    });

    this.addSettingTab(new KnowEdgeSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void>
  {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void>
  {
    await this.saveData(this.settings);
    this.storage.deck_folder = this.settings.deck_folder;
    this.storage.log_folder = this.settings.log_folder;
    this.engine.params = this.settings;
  }

  setDevice(name: string): void
  {
    if (!name) return;
    this.device = name;
    this.app.saveLocalStorage(DEVICE_KEY, name);
    this.storage.device = name;
  }

  async addIds(path: string): Promise<void>
  {
    const added = await this.engine.ensureIds([path]);
    if (added) new Notice(`Know-edge: added ${added} id(s)`);
  }

  async review(paths: string[]): Promise<void>
  {
    const steps = await this.engine.buildSession(paths);
    const view = await this.openView(REVIEW_VIEW);
    (view as ReviewView).setSteps(steps);
  }

  async reviewPath(path: string): Promise<void>
  {
    await this.review([path]);
  }

  // show a notice when a deck edit could not be applied
  async edited<T>(result: Promise<T>): Promise<T>
  {
    const value = await result;
    if (!value) new Notice('Know-edge: edit not applied (item not found, no sibling to swap, or depth > 6)');
    return value;
  }

  editorViews(): DeckEditorView[]
  {
    return this.app.workspace.getLeavesOfType(EDITOR_VIEW)
      .map((leaf) => leaf.view)
      .filter((view): view is DeckEditorView => view instanceof DeckEditorView);
  }

  async openEditor(): Promise<void>
  {
    const workspace = this.app.workspace;
    const leaf = workspace.getLeavesOfType(EDITOR_VIEW)[0] ?? workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: EDITOR_VIEW, active: true });
    await workspace.revealLeaf(leaf);
  }

  async openDecks(): Promise<void>
  {
    const view = await this.openView(DECKS_VIEW);
    await (view as DeckListView).refresh();
  }

  private async openView(type: string)
  {
    const workspace = this.app.workspace;
    const leaf = workspace.getLeavesOfType(type)[0] ?? workspace.getLeaf('tab');
    await leaf.setViewState({ type, active: true });
    await workspace.revealLeaf(leaf);
    return leaf.view;
  }
}
