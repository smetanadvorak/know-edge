<!--
  Deck list: one row per deck file with due units, due items, new items.

  prompt:
    5. ok, what gui can we get?  (deck list view with due / new counts)
    deck is one file.
-->
<script lang="ts">
  import type { DeckStats } from '@know-edge/core';

  let { decks, onOpen }: { decks: DeckStats[]; onOpen: (path: string) => void } = $props();
</script>

<div class="ke-decks">
  {#if decks.length === 0}
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
