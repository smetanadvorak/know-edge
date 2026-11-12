<!--
  Web app shell: deck list, review, deck editor, settings.
  same engine and ui components as the obsidian plugin, storage = the vault repo on GitHub.
  reviews are committed in batches; unsynced count is shown in the header.

  prompt:
    can it have an alternative interfaece for when obsidian is not available? like a webpage?
    but based on the same "backend"
    git suits me well / should cover both
    if sync via github, can i host there too?
    1. yes  3. let's batch
    how is token handled and stored?
    yes (encrypt the token with a passphrase + "forget token" button)
-->
<script lang="ts">
  import { Engine, parseDeck, type Deck, type DeckStats, type EditorActions, type SessionStep } from '@know-edge/core';
  import DeckEditor from '@know-edge/ui/DeckEditor.svelte';
  import DeckList from '@know-edge/ui/DeckList.svelte';
  import Review from '@know-edge/ui/Review.svelte';
  import { writable } from 'svelte/store';
  import { isConfigured, loadConfig, saveConfig, type WebConfig } from './config';
  import { GitHubStorage } from './github_storage';
  import { render, setIcon } from './render';
  import SettingsForm from './SettingsForm.svelte';
  import { decryptToken, encryptToken } from './token_crypto';
  import UnlockForm from './UnlockForm.svelte';

  type Page = 'decks' | 'review' | 'editor' | 'settings' | 'unlock';

  let config = $state(loadConfig());
  let page = $state<Page>('settings');
  let busy = $state(false);
  let error = $state('');
  let pending = $state(0);
  let connected = $state(false);

  // decrypted token, memory only
  let token = '';
  let storage: GitHubStorage | null = null;
  let engine: Engine | null = null;

  let decks = $state.raw<DeckStats[]>([]);
  let steps = $state.raw<SessionStep[]>([]);
  let session_id = $state(0);

  let deck_paths = $state.raw<string[]>([]);
  let editor_path = $state('');
  const editor_deck = writable<Deck | null>(null);
  // no text cursor in the web app, nothing is pre-selected
  const editor_selected = writable<number | null>(null);

  async function run(fn: () => Promise<void>): Promise<void>
  {
    error = '';
    busy = true;
    try
    {
      await fn();
    }
    catch (e)
    {
      error = e instanceof Error ? e.message : String(e);
    }
    finally
    {
      busy = false;
    }
  }

  function connect(): void
  {
    storage = new GitHubStorage(config, token);
    storage.onPendingChange = (count) => (pending = count);
    storage.onError = (e) => (error = e instanceof Error ? e.message : String(e));
    pending = storage.pendingCount;
    engine = new Engine(storage, config);
    connected = true;
  }

  function sync(): Promise<void>
  {
    return run(() => storage!.flush());
  }

  async function showDecks(): Promise<void>
  {
    page = 'decks';
    await run(async () =>
    {
      await storage!.refresh();
      decks = await engine!.allDeckStats();
    });
  }

  async function review(paths: string[] | null): Promise<void>
  {
    await run(async () =>
    {
      await storage!.refresh();
      steps = await engine!.buildSession(paths ?? (await storage!.deckPaths()));
      session_id += 1;
      page = 'review';
    });
  }

  async function rate(step: SessionStep, rating: number): Promise<void>
  {
    await run(async () =>
    {
      await engine!.rate(step, rating);
      // end of session: commit what is buffered
      if (step === steps[steps.length - 1]) await storage!.flush();
    });
  }

  async function showEditor(): Promise<void>
  {
    page = 'editor';
    await run(async () =>
    {
      await storage!.refresh();
      deck_paths = await storage!.deckPaths();
      if (!deck_paths.includes(editor_path)) editor_path = deck_paths[0] ?? '';
      await loadEditorDeck();
    });
  }

  async function loadEditorDeck(): Promise<void>
  {
    editor_deck.set(editor_path ? parseDeck(editor_path, await storage!.read(editor_path)) : null);
  }

  // run a deck edit, then reload the deck in the editor
  async function edit<T>(fn: () => Promise<T>): Promise<T>
  {
    let value = undefined as T;
    await run(async () =>
    {
      value = await fn();
      if (!value) error = 'Edit not applied (item not found, no sibling to swap, or depth > 6)';
      await loadEditorDeck();
    });
    return value;
  }

  const actions: EditorActions = {
    addChild: (parent, draft) => edit(() => engine!.addChildItem(editor_path, parent, draft)),
    addSibling: (ref, draft) => edit(() => engine!.addSiblingItem(editor_path, ref, draft)),
    update: (ref, draft) => edit(() => engine!.updateItem(editor_path, ref, draft)),
    move: (ref, dir) => edit(() => engine!.moveItem(editor_path, ref, dir)),
    remove: (ref, label) =>
    {
      if (confirm(`Delete "${label}" and all its follow-ups?`)) edit(() => engine!.deleteItem(editor_path, ref));
    },
  };

  async function saveSettings(new_config: WebConfig, new_token: string | null, passphrase: string | null): Promise<void>
  {
    if (new_token && passphrase)
    {
      new_config.token_enc = await encryptToken(new_token, passphrase);
      token = new_token;
    }
    config = new_config;
    saveConfig(config);
    if (!token)
    {
      page = 'unlock';
      return;
    }
    connect();
    showDecks();
  }

  async function unlock(passphrase: string): Promise<void>
  {
    error = '';
    busy = true;
    const plain = await decryptToken(config.token_enc!, passphrase);
    busy = false;
    if (plain === null)
    {
      error = 'Wrong passphrase';
      return;
    }
    token = plain;
    connect();
    showDecks();
    // commit reviews left over from a previous visit
    if (pending) sync();
  }

  function forgetToken(): void
  {
    if (pending && !confirm(`${pending} review(s) are not synced yet. They stay in this browser and are committed after a new token is set. Forget the token?`)) return;
    config.token_enc = null;
    saveConfig(config);
    token = '';
    storage = null;
    engine = null;
    connected = false;
    page = 'settings';
  }

  // try to commit buffered reviews when the tab is hidden
  document.addEventListener('visibilitychange', () =>
  {
    if (document.hidden && storage?.pendingCount) storage.flush().catch((e) => (error = String(e)));
  });

  if (isConfigured(config)) page = 'unlock';
</script>

<header class="ke-web-header">
  <strong>Know-edge</strong>
  {#if connected}
    <button class:ke-active={page === 'decks'} onclick={showDecks}>Decks</button>
    <button onclick={() => review(null)}>Review all</button>
    <button class:ke-active={page === 'editor'} onclick={showEditor}>Editor</button>
  {/if}
  {#if page !== 'unlock'}
    <button class:ke-active={page === 'settings'} onclick={() => (page = 'settings')}>Settings</button>
  {/if}
  <span class="ke-web-status">
    {#if busy}<span>working…</span>{/if}
    {#if pending}
      <span>{pending} unsynced</span>
      <button onclick={sync}>Sync now</button>
    {/if}
  </span>
</header>

{#if error}
  <div class="ke-web-error">{error}</div>
{/if}

<main>
  {#if page === 'unlock'}
    <UnlockForm onUnlock={unlock} />
  {:else if page === 'settings'}
    {#key config.token_enc}
      <SettingsForm {config} onSave={saveSettings} onForget={forgetToken} />
    {/key}
  {:else if page === 'decks'}
    <DeckList {decks} onOpen={(path: string) => review([path])} />
  {:else if page === 'review'}
    {#key session_id}
      <Review {render} {steps} onRate={rate} />
    {/key}
  {:else if page === 'editor'}
    <div class="ke-web-deck-select">
      <select bind:value={editor_path} onchange={() => run(loadEditorDeck)}>
        {#each deck_paths as path (path)}
          <option value={path}>{path}</option>
        {/each}
      </select>
    </div>
    <DeckEditor deck={editor_deck} selected={editor_selected} {actions} {setIcon} />
  {/if}
</main>
