<!--
  Deck editor panel: tree of the open deck file with add child / add sibling / move / indent / outdent / edit / delete.
  clicking a node opens the inline editor. the node under the editor cursor is highlighted.
  after saving a new card the form stays open as a sibling of that card.
  new card form: arrows (or ctrl+left / ctrl+right) move where the card lands, closer to the root or deeper.
  shift/cmd/ctrl+enter saves, escape cancels.

  prompt:
    Can we establish rathern an interface for createion?
    1. let's go with b directly
    2. yes. (pre-select from editor cursor)
    3. yes. (after save, keep the form open with the new card as parent)
    (web: own empty message when there is no deck) then let's add this featrure.
    (change the level of an item: indent / outdent buttons; new card form continues as a sibling) I'd like to be able to change the level of an item. By default, new card is sibling, not child.
    (new card placement in the form: buttons + keys) add controls that adjust where new card is to be landed: sibling of current or child, etc.
    shift enter to save as it is now, ctlr left - move closer to root, ctrl right - move towards the child.
-->
<script lang="ts">
  import type { Readable } from 'svelte/store';
  import { findItem, itemLabel, refMatches, refOf, type Deck, type Draft, type EditorActions, type Item, type Ref } from '@know-edge/core';

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

  // where the new card would land, one step closer to the root (-1) or deeper (1); null if not possible
  function placementStep(e: Editing, dir: -1 | 1): Editing | null
  {
    if (!$deck || e.mode === 'edit') return null;
    if (e.mode === 'sibling')
    {
      const item = findItem($deck, e.ref);
      if (!item) return null;
      if (dir > 0) return item.level < 6 ? { mode: 'child', parent: refOf(item) } : null;
      return item.parent ? { mode: 'sibling', ref: refOf(item.parent) } : null;
    }
    if (e.parent === null)
    {
      // new multicard at the end of the file: deeper = child of the last root
      const last = $deck.roots[$deck.roots.length - 1];
      return dir > 0 && last ? { mode: 'child', parent: refOf(last) } : null;
    }
    const parent = findItem($deck, e.parent);
    if (!parent) return null;
    if (dir < 0) return { mode: 'sibling', ref: refOf(parent) };
    const last = parent.children[parent.children.length - 1];
    return last && last.level < 6 ? { mode: 'child', parent: refOf(last) } : null;
  }

  function movePlacement(dir: -1 | 1)
  {
    const next = editing && placementStep(editing, dir);
    if (next) editing = next;
  }

  function placementText(e: Editing): string
  {
    if (!$deck || e.mode === 'edit') return '';
    if (e.mode === 'child' && e.parent === null) return 'New multicard';
    const ref = e.mode === 'child' ? e.parent! : e.ref;
    const item = findItem($deck, ref);
    const label = item ? itemLabel(item) || '(empty)' : '?';
    return (e.mode === 'child' ? 'Child of: ' : 'Sibling of: ') + label;
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
    // continue with a sibling of the new card
    editing = { mode: 'sibling', ref: { id: new_id, line: -1 } };
    draft = emptyDraft();
  }

  function onFormKey(e: KeyboardEvent)
  {
    if (e.key === 'Enter' && (e.shiftKey || e.metaKey || e.ctrlKey))
    {
      e.preventDefault();
      save();
    }
    else if (e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && editing?.mode !== 'edit')
    {
      e.preventDefault();
      movePlacement(e.key === 'ArrowLeft' ? -1 : 1);
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
    {#if editing && editing.mode !== 'edit'}
      <div class="ke-ed-placement">
        <button class="clickable-icon" aria-label="Closer to root (Ctrl+Left)" disabled={!placementStep(editing, -1)} use:icon={'arrow-left'} onclick={() => movePlacement(-1)}></button>
        <button class="clickable-icon" aria-label="Deeper (Ctrl+Right)" disabled={!placementStep(editing, 1)} use:icon={'arrow-right'} onclick={() => movePlacement(1)}></button>
        <span class="ke-ed-placement-text">{placementText(editing)}</span>
      </div>
    {/if}
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
          <button class="clickable-icon" aria-label="Outdent" use:icon={'arrow-left'} onclick={(e) => act(e, () => actions.shift(refOf(item), -1))}></button>
          <button class="clickable-icon" aria-label="Indent" use:icon={'arrow-right'} onclick={(e) => act(e, () => actions.shift(refOf(item), 1))}></button>
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
