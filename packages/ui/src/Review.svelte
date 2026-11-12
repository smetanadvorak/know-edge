<!--
  Review screen: path so far (breadcrumb + level), current question, show answer, rating buttons.
  optional tree panel of the current unit.

  prompt:
    The repetition interface should indicate the level and tree structure, without showing all question at a time,
    and not showing the tree ahead, only how we got here (make showing the whole tree an option,
    the ahead part grayed out until answered).
    1. let's ask for now starting from the top. 2. depth first 4. we continue
    I'd like the question and answer be centered. also question text appears twice on card.
    Can there be also a bit more separation between them? Maybe present question in a div and answer in another div below?
-->
<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { ancestors, itemLabel, type SessionStep } from '@know-edge/core';
  import TreeNode from './TreeNode.svelte';

  let { render, steps, onRate }: {
    // renders markdown text into an element (obsidian renderer or markdown-it in the web client)
    render: (el: HTMLElement, text: string, source: string) => void;
    steps: SessionStep[];
    onRate: (step: SessionStep, rating: number) => Promise<void>;
  } = $props();

  let index = $state(0);
  let revealed = $state(false);
  let show_tree = $state(false);
  const answered = new SvelteSet<string>();

  function markdown(node: HTMLElement, args: { text: string; source: string })
  {
    render(node, args.text, args.source);
    return { update: (a: { text: string; source: string }) => render(node, a.text, a.source) };
  }

  const step = $derived(steps[index]);
  const path = $derived(step ? ancestors(step.item) : []);

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
    index += 1;
  }
</script>

<div class="ke-review">
  {#if !step}
    <div class="ke-done">Nothing to review.</div>
  {:else}
    <div class="ke-header">
      <span class="ke-deck">{step.deck_path}</span>
      <span class="ke-progress">{index + 1} / {steps.length}</span>
      <label class="ke-tree-toggle">
        <input type="checkbox" bind:checked={show_tree} /> Show tree
      </label>
    </div>

    <div class="ke-path">
      <span class="ke-level">L{step.item.level}</span>
      {#each path as node, i (node.line)}
        <span class="ke-crumb">{itemLabel(node)}</span>
        {#if i < path.length - 1 || step.item.title}<span class="ke-sep">›</span>{/if}
      {/each}
      <!-- without a heading label the fallback label is the question itself, shown below already -->
      {#if step.item.title}
        <span class="ke-crumb ke-current">{step.item.title}</span>
      {/if}
    </div>

    {#if show_tree}
      <ul class="ke-tree">
        <TreeNode node={step.unit} current_id={step.item.id} {answered} />
      </ul>
    {/if}

    {#key step.item.id}
      <div class="ke-card ke-question" use:markdown={{ text: step.item.question, source: step.deck_path }}></div>

      {#if revealed}
        <div class="ke-card ke-answer" use:markdown={{ text: step.item.answer, source: step.deck_path }}></div>
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
</div>
