<script lang="ts">
  /*
   * One block list of the action builder: a flow's root, a loop body, or a
   * branch body. Renders its cards and the add/paste affordances beneath
   * them, and owns the picker target id (`list:<parentId>` for nested lists,
   * `flow:<triggerId>` at the root - the same grammar the runtime's
   * resolveList speaks).
   */
  import type { ActionBlock } from '@macro-deck/runtime';
  import { AppStrings } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';
  import type { ActionFlowStore } from './action-flow-store.svelte';
  import ActionCard from './ActionCard.svelte';

  interface Props {
    blocks: readonly ActionBlock[];
    listId: string;
    store: ActionFlowStore;
  }

  let { blocks, listId, store }: Props = $props();
</script>

<div class="action-list" data-list-id={listId}>
  {#each blocks as block, index (block.id)}
    <ActionCard {block} {listId} {index} {store} />
  {/each}

  <div class="action-list-footer">
    <button type="button" class="action-add" onclick={() => store.requestAdd(listId)}>
      + {translateKey('macrodeck:Common.Add')}
    </button>
    {#if store.canPaste}
      <button type="button" class="action-add" onclick={() => void store.pasteIntoList(listId)}>
        {translateKey(AppStrings.ActionBuilder.Paste)}
      </button>
    {/if}
  </div>
</div>

<style>
  .action-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .action-list-footer {
    display: flex;
    gap: var(--space-2, 0.5rem);
  }

  .action-add {
    background: none;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md, 6px);
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: var(--text-sm, 0.875rem);
    padding: 0.375rem var(--space-3, 0.75rem);
  }

  .action-add:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
</style>
