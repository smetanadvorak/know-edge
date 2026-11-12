<!--
  Deck editor panel: tree of the open deck file with add child / add sibling / move / edit / delete.
  clicking a node opens the inline editor. the node under the editor cursor is highlighted.
  after saving a new card the form stays open as a child of that card (to type a whole thread).
  cmd/ctrl+enter saves, escape cancels.

  prompt:
    Can we establish rathern an interface for createion?
    1. let's go with b directly
    2. yes. (pre-select from editor cursor)
    3. yes. (after save, keep the form open with the new card as parent)
    (web: own empty message when there is no deck) then let's add this featrure.
-->
<script lang="ts">
  import type { Readable } from 'svelte/store';
  import { itemLabel, refMatches, refOf, type Deck, type Draft, type EditorActions, type Item, type Ref } from '@know-edge/core';

  type Editing =
    | { mode: 'edit'; ref: Ref }
    | { mode: 'child'; parent: Ref | null }
    | { mode: 'sibling'; ref: Ref };

  let { deck, selected, actions, setIcon, emptyText = 'Open a markdown file.' }: {
    deck: Readable<Deck | null>;
    selected: Readable<number | null>;
    actions: EditorActions;
    // puts a named (lucide) icon into an element
    setIcon: (el: HTMLElement, name: string) => void;
    // shown when no deck is bound
    emptyText?: string;
  } = $props();

  function icon(node: HTMLElement, name: string)
  {
    setIcon(node, name);
    return { update: (n: string) => setIcon(node, n) };
  }

  let editing = $state<Editing | null>(null);
  let draft = $state<Draft>(emptyDraft());

  // close the form when another file is bound
  let last_path = '';
  $effect(() =>
  {
    const path = $deck?.path ?? '';
    if (path !== last_path)
    {
      last_path = path;
      editing = null;
    }
  });

  function emptyDraft(): Draft
  {
    return { label: '', question: '', answer: '' };
  }

  function startEdit(item: Item)
  {
    editing = { mode: 'edit', ref: refOf(item) };
    draft = { label: item.title, question: item.question, answer: item.answer };
  }

  function startChild(parent: Item | null)
  {
    editing = { mode: 'child', parent: parent ? refOf(parent) : null };
    draft = emptyDraft();
  }

  function startSibling(item: Item)
  {
    editing = { mode: 'sibling', ref: refOf(item) };
    draft = emptyDraft();
  }

  function cancel()
  {
    editing = null;
  }

  async function save()
  {
    if (!editing || !draft.question.trim()) return;
    const values = { ...draft };
    if (editing.mode === 'edit')
    {
      if (await actions.update(editing.ref, values)) editing = null;
      return;
    }
    const new_id = editing.mode === 'child'
      ? await actions.addChild(editing.parent, values)
      : await actions.addSibling(editing.ref, values);
    if (!new_id) return;
    // continue the thread under the new card
    editing = { mode: 'child', parent: { id: new_id, line: -1 } };
    draft = emptyDraft();
  }

  function onFormKey(e: KeyboardEvent)
  {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
    {
      e.preventDefault();
      save();
    }
    else if (e.key === 'Escape')
    {
      e.preventDefault();
      cancel();
    }
  }

  function isEdited(item: Item): boolean
  {
    return editing?.mode === 'edit' && refMatches(editing.ref, item);
  }

  function hasChildForm(item: Item): boolean
  {
    return editing?.mode === 'child' && editing.parent !== null && refMatches(editing.parent, item);
  }

  function hasSiblingForm(item: Item): boolean
  {
    return editing?.mode === 'sibling' && refMatches(editing.ref, item);
  }

  function focus(node: HTMLElement)
  {
    node.focus();
  }

  function act(e: MouseEvent, fn: () => void)
  {
    e.stopPropagation();
    fn();
  }
</script>

{#snippet form()}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="ke-ed-form" onkeydown={onFormKey}>
    <input type="text" placeholder="Label (optional)" bind:value={draft.label} />
    <textarea placeholder="Question" rows="3" bind:value={draft.question} use:focus></textarea>
    <textarea placeholder="Answer" rows="4" bind:value={draft.answer}></textarea>
    <div class="ke-ed-form-buttons">
      <button class="mod-cta" disabled={!draft.question.trim()} onclick={save}>Save</button>
      <button onclick={cancel}>Cancel</button>
    </div>
  </div>
{/snippet}

{#snippet node_view(item: Item)}
  <li>
    {#if isEdited(item)}
      {@render form()}
    {:else}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="ke-ed-row" class:ke-selected={$selected === item.line} onclick={() => startEdit(item)}>
        <span class="ke-level">L{item.level}</span>
        <span class="ke-ed-label" class:ke-ed-structural={!item.question}>{itemLabel(item) || '(empty)'}</span>
        <span class="ke-ed-actions">
          <button class="clickable-icon" aria-label="Add child" use:icon={'corner-down-right'} onclick={(e) => act(e, () => startChild(item))}></button>
          <button class="clickable-icon" aria-label="Add sibling" use:icon={'plus'} onclick={(e) => act(e, () => startSibling(item))}></button>
          <button class="clickable-icon" aria-label="Move up" use:icon={'arrow-up'} onclick={(e) => act(e, () => actions.move(refOf(item), -1))}></button>
          <button class="clickable-icon" aria-label="Move down" use:icon={'arrow-down'} onclick={(e) => act(e, () => actions.move(refOf(item), 1))}></button>
          <button class="clickable-icon" aria-label="Delete" use:icon={'trash-2'} onclick={(e) => act(e, () => actions.remove(refOf(item), itemLabel(item)))}></button>
        </span>
      </div>
    {/if}
    {#if item.children.length || hasChildForm(item)}
      <ul>
        {#each item.children as child (child.id ?? 'l' + child.line)}
          {@render node_view(child)}
        {/each}
        {#if hasChildForm(item)}
          <li>{@render form()}</li>
        {/if}
      </ul>
    {/if}
  </li>
  {#if hasSiblingForm(item)}
    <li>{@render form()}</li>
  {/if}
{/snippet}

<div class="ke-editor">
  {#if !$deck}
    <div class="ke-done">{emptyText}</div>
  {:else}
    <div class="ke-ed-header">
      <span class="ke-deck">{$deck.path}</span>
      <button onclick={() => startChild(null)}>New multicard</button>
    </div>
    <ul class="ke-ed-tree">
      {#each $deck.roots as root (root.id ?? 'l' + root.line)}
        {@render node_view(root)}
      {/each}
      {#if editing?.mode === 'child' && editing.parent === null}
        <li>{@render form()}</li>
      {/if}
    </ul>
  {/if}
</div>
