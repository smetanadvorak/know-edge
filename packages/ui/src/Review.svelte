<!--
  Review screen: path so far (breadcrumb + level), current question, show answer, rating buttons.
  optional tree panel of the current unit.
  "Edit card" opens an inline form (label, Q, A) for the current item; the edited text is shown for the rest of the session.
  shift/cmd/ctrl+enter saves, escape cancels.

  prompt:
    The repetition interface should indicate the level and tree structure, without showing all question at a time,
    and not showing the tree ahead, only how we got here (make showing the whole tree an option,
    the ahead part grayed out until answered).
    1. let's ask for now starting from the top. 2. depth first 4. we continue
    I'd like the question and answer be centered. also question text appears twice on card.
    Can there be also a bit more separation between them? Maybe present question in a div and answer in another div below?
    (edit the current card during review: "Edit card" button, inline form, keeps the session) I'd like to be able to edit cards during reviewing. For example, by button "Edit card".
-->
<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { ancestors, itemLabel, type Draft, type SessionStep } from '@know-edge/core';
  import TreeNode from './TreeNode.svelte';

  let { render, steps, onRate, onEdit }: {
    // renders markdown text into an element (obsidian renderer or markdown-it in the web client)
    render: (el: HTMLElement, text: string, source: string) => void;
    steps: SessionStep[];
    onRate: (step: SessionStep, rating: number) => Promise<void>;
    // saves the current item's label / question / answer; true if applied
    onEdit: (step: SessionStep, draft: Draft) => Promise<boolean>;
  } = $props();

  let index = $state(0);
  let revealed = $state(false);
  let show_tree = $state(false);
  const answered = new SvelteSet<string>();
  // texts saved during this session, by item id (the parsed steps are not reloaded)
  let edits = $state<Record<string, Draft>>({});
  let editing = $state(false);
  let draft = $state<Draft>({ label: '', question: '', answer: '' });

  function markdown(node: HTMLElement, args: { text: string; source: string })
  {
    render(node, args.text, args.source);
    return { update: (a: { text: string; source: string }) => render(node, a.text, a.source) };
  }

  const step = $derived(steps[index]);
  const path = $derived(step ? ancestors(step.item) : []);
  const shown = $derived(step ? edits[step.item.id!] ?? { label: step.item.title, question: step.item.question, answer: step.item.answer } : null);

  const ratings = [
    { value: 1, label: 'Again' },
    { value: 2, label: 'Hard' },
    { value: 3, label: 'Good' },
    { value: 4, label: 'Easy' },
  ];

  async function rate(rating: number)
  {
    await onRate(step, rating);
    answered.add(step.item.id!);
    revealed = false;
    editing = false;
    index += 1;
  }

  function startEdit()
  {
    draft = { ...shown! };
    editing = true;
  }

  async function saveEdit()
  {
    if (!draft.question.trim()) return;
    const values = { ...draft };
    if (!(await onEdit(step, values))) return;
    edits[step.item.id!] = values;
    editing = false;
  }

  function onFormKey(e: KeyboardEvent)
  {
    if (e.key === 'Enter' && (e.shiftKey || e.metaKey || e.ctrlKey))
    {
      e.preventDefault();
      saveEdit();
    }
    else if (e.key === 'Escape')
    {
      e.preventDefault();
      editing = false;
    }
  }

  function focus(node: HTMLElement)
  {
    node.focus();
  }
</script>

<div class="ke-review">
  {#if !step}
    <div class="ke-done">Nothing to review.</div>
  {:else}
    <div class="ke-header">
      <span class="ke-deck">{step.deck_path}</span>
      <span class="ke-progress">{index + 1} / {steps.length}</span>
      <button class="ke-edit-card" onclick={startEdit} disabled={editing}>Edit card</button>
      <label class="ke-tree-toggle">
        <input type="checkbox" bind:checked={show_tree} /> Show tree
      </label>
    </div>

    <div class="ke-path">
      <span class="ke-level">L{step.item.level}</span>
      {#each path as node, i (node.line)}
        <span class="ke-crumb">{itemLabel(node)}</span>
        {#if i < path.length - 1 || shown!.label}<span class="ke-sep">›</span>{/if}
      {/each}
      <!-- without a heading label the fallback label is the question itself, shown below already -->
      {#if shown!.label}
        <span class="ke-crumb ke-current">{shown!.label}</span>
      {/if}
    </div>

    {#if show_tree}
      <ul class="ke-tree">
        <TreeNode node={step.unit} current_id={step.item.id} {answered} />
      </ul>
    {/if}

    {#if editing}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="ke-ed-form" onkeydown={onFormKey}>
        <input type="text" placeholder="Label (optional)" bind:value={draft.label} />
        <textarea placeholder="Question" rows="3" bind:value={draft.question} use:focus></textarea>
        <textarea placeholder="Answer" rows="4" bind:value={draft.answer}></textarea>
        <div class="ke-ed-form-buttons">
          <button class="mod-cta" disabled={!draft.question.trim()} onclick={saveEdit}>Save</button>
          <button onclick={() => (editing = false)}>Cancel</button>
        </div>
      </div>
    {:else}
    {#key step.item.id}
      <div class="ke-card ke-question" use:markdown={{ text: shown!.question, source: step.deck_path }}></div>

      {#if revealed}
        <div class="ke-card ke-answer" use:markdown={{ text: shown!.answer, source: step.deck_path }}></div>
        <div class="ke-ratings">
          {#each ratings as r (r.value)}
            <button class="ke-rate ke-rate-{r.value}" onclick={() => rate(r.value)}>{r.label}</button>
          {/each}
        </div>
      {:else}
        <button class="mod-cta ke-show" onclick={() => (revealed = true)}>Show answer</button>
      {/if}
    {/key}
    {/if}
  {/if}
</div>
