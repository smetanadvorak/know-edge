<!--
  Deck list: one row per deck file with due units, due items, new items.

  prompt:
    5. ok, what gui can we get?  (deck list view with due / new counts)
    deck is one file.
    (deck list: loading / failed state instead of "No decks" while loading; readable GitHub error messages) The first thing that opens is Decks and it takes some time to load, and while its loading it is saying "No Decks". Better to show loading indication and say not Decks after some time if none loaded. Also is there error message if something went wrong with fetching from git?
-->
<script lang="ts">
  import type { DeckStats } from '@know-edge/core';

  let { decks, onOpen, status = 'ready' }: {
    decks: DeckStats[];
    onOpen: (path: string) => void;
    // 'failed': the error itself is shown by the host
    status?: 'loading' | 'ready' | 'failed';
  } = $props();
</script>

<div class="ke-decks">
  {#if status === 'loading'}
    <div class="ke-done">Loading decks…</div>
  {:else if status === 'failed'}
    <div class="ke-done">Could not load decks.</div>
  {:else if decks.length === 0}
    <div class="ke-done">No decks found.</div>
  {:else}
    <table>
      <thead>
        <tr><th>Deck</th><th>Due units</th><th>Due items</th><th>New</th></tr>
      </thead>
      <tbody>
        {#each decks as deck (deck.path)}
          <tr class="ke-deck-row" onclick={() => onOpen(deck.path)}>
            <td>{deck.path}</td>
            <td>{deck.due_units}</td>
            <td>{deck.due_items}</td>
            <td>{deck.new_items}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
