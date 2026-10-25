<script lang="ts">
  /*
   * The block picker, ported from the Angular ActionPickerComponent: the
   * client's logic blocks plus every action of the catalogue, grouped by
   * category, filtered by a search box.
   */
  import { AppStrings, type ActionBlockDefinition } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';
  import Modal from '$lib/components/Modal.svelte';

  interface Props {
    blocks: readonly ActionBlockDefinition[];
    onpick: (definition: ActionBlockDefinition) => void;
    onclose: () => void;
  }

  let { blocks, onpick, onclose }: Props = $props();

  let query = $state('');

  const filtered = $derived.by(() => {
    const text = query.trim().toLowerCase();
    if (text === '') return blocks;
    return blocks.filter(block =>
      block.label.toLowerCase().includes(text)
      || block.category.toLowerCase().includes(text)
      || (block.description ?? '').toLowerCase().includes(text)
      || block.blockType.toLowerCase().includes(text),
    );
  });

  const grouped = $derived.by(() => {
    const groups = new Map<string, ActionBlockDefinition[]>();
    for (const block of filtered) {
      const list = groups.get(block.category) ?? [];
      list.push(block);
      groups.set(block.category, list);
    }
    return [...groups.entries()].map(([category, entries]) => ({ category, entries }));
  });
</script>

<Modal
  heading={translateKey(AppStrings.ActionBuilder.Picker.Heading)}
  size="small"
  onclose={onclose}
>
  <div class="picker">
    <input
      class="picker-search"
      type="search"
      placeholder={translateKey(AppStrings.ActionBuilder.Picker.SearchPlaceholder)}
      bind:value={query}
      autofocus
    />

    {#if grouped.length === 0}
      <p class="picker-empty">{translateKey(AppStrings.ActionBuilder.Picker.NoResults)}</p>
    {:else}
      <div class="picker-groups">
        {#each grouped as group (group.category)}
          <section class="picker-group">
            <h4 class="picker-group-title">{group.category}</h4>
            {#each group.entries as block (block.blockType)}
              <button type="button" class="picker-block" onclick={() => onpick(block)} title={block.description ?? block.label}>
                <span class="picker-block-bar" style:background={block.color} aria-hidden="true"></span>
                <span class="picker-block-label">{block.label}</span>
                {#if block.description}
                  <span class="picker-block-desc">{block.description}</span>
                {/if}
              </button>
            {/each}
          </section>
        {/each}
      </div>
    {/if}
  </div>
</Modal>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
    max-height: 60vh;
  }

  .picker-search {
    padding: 0.5rem var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm, 0.875rem);
  }

  .picker-empty {
    margin: 0;
    padding: var(--space-4, 1rem);
    color: var(--color-text-muted);
    text-align: center;
    font-size: var(--text-sm, 0.875rem);
  }

  .picker-groups {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
  }

  .picker-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .picker-group-title {
    margin: 0 0 0.25rem;
    font-size: var(--text-xs, 0.75rem);
    font-weight: var(--font-semibold, 600);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .picker-block {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    background: none;
    border: none;
    border-radius: var(--radius-md, 6px);
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: var(--text-sm, 0.875rem);
    padding: 0.375rem var(--space-2, 0.5rem);
    text-align: left;
  }

  .picker-block:hover {
    background: var(--color-bg-tertiary);
  }

  .picker-block-bar {
    width: 4px;
    height: 1.25rem;
    border-radius: 2px;
    flex: none;
  }

  .picker-block-label {
    font-weight: var(--font-semibold, 600);
    white-space: nowrap;
  }

  .picker-block-desc {
    color: var(--color-text-muted);
    font-size: var(--text-xs, 0.75rem);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
</style>
