<script lang="ts">
  /*
   * One entry in a rail.
   *
   * The count has two forms: a plain total, or a total with the unbound count in brackets. The
   * bracketed form is what tells a user how much of a plugin's catalog they have not bound yet,
   * and it is only shown when the catalog can actually report it.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    count?: number | null;
    unboundCount?: number | null;
    active?: boolean;
    onclick?: () => void;
    oncontextmenu?: (e: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    label,
    count = null,
    unboundCount = null,
    active = false,
    onclick,
    oncontextmenu,
    children,
  }: Props = $props();

  const countText = $derived(
    count === null ? null : unboundCount === null ? String(count) : `${count} (${unboundCount})`,
  );
</script>

<button
  type="button"
  class="rail-item"
  class:active
  role="option"
  aria-selected={active}
  {onclick}
  {oncontextmenu}
>
  <span class="rail-item-name" title={label}>{label}</span>
  <span class="rail-item-meta">
    {@render children?.()}
    {#if countText !== null}
      <span class="rail-item-count">{countText}</span>
    {/if}
  </span>
</button>

<style>
  .rail-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: none;
    background: transparent;
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    transition: background-color var(--transition-fast), color var(--transition-fast);
  }

  .rail-item:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .rail-item:focus-visible {
    box-shadow: var(--focus-ring);
    outline: none;
  }

  .rail-item.active {
    background: var(--color-accent-muted);
    color: var(--color-text-primary);
  }

  .rail-item-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rail-item-meta {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    flex-shrink: 0;
  }

  .rail-item-count {
    min-width: 1.25rem;
    text-align: end;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
</style>
