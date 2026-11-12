<!--
  One node of the unit tree in the review view.
  answered and current items show their label, items ahead are grayed out.

  prompt:
    make showing the whole tree an option, the ahead part grayed out until answered
-->
<script lang="ts">
  import type { SvelteSet } from 'svelte/reactivity';
  import { itemLabel, type Item } from '@know-edge/core';
  import TreeNode from './TreeNode.svelte';

  let { node, current_id, answered }: { node: Item; current_id: string | null; answered: SvelteSet<string> } = $props();

  const is_current = $derived(node.id !== null && node.id === current_id);
  const is_answered = $derived(node.id !== null && answered.has(node.id));
  // structural headings (no question) are always visible
  const visible = $derived(is_current || is_answered || !node.question);
</script>

<li>
  <span class="ke-tree-label" class:ke-current={is_current} class:ke-ahead={!visible}>
    {visible ? itemLabel(node) || '·' : '?'}
  </span>
  {#if node.children.length}
    <ul>
      {#each node.children as child (child.line)}
        <TreeNode node={child} {current_id} {answered} />
      {/each}
    </ul>
  {/if}
</li>
