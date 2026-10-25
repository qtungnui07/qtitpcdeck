<script lang="ts">
  /*
   * Reusable tab bar component.
   *
   * Implements WAI-ARIA tablist pattern with keyboard navigation (Arrow keys, Home, End).
   * Supports active tab indicator, badges, state dots, and removable tabs.
   */
  import { AppStrings } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';

  export interface TabItem {
    id: string;
    label: string;
    badge?: number | string;
    dot?: boolean;
    removable?: boolean;
  }

  interface Props {
    items: TabItem[];
    activeId?: string;
    idPrefix?: string;
    onchange?: (id: string) => void;
    onremove?: (id: string) => void;
  }

  let {
    items = [],
    activeId = '',
    idPrefix,
    onchange,
    onremove,
  }: Props = $props();

  let barRef: HTMLElement | null = $state(null);
  let resizeObserver: ResizeObserver | null = null;

  function tabIndexFor(item: TabItem): 0 | -1 {
    if (activeId === item.id) {
      return 0;
    }
    const hasActive = items.some(i => i.id === activeId);
    return !hasActive && items[0]?.id === item.id ? 0 : -1;
  }

  function select(id: string): void {
    if (activeId !== id) {
      onchange?.(id);
    }
  }

  function removeLabel(item: TabItem): string {
    return translateKey(AppStrings.Forms.TabBar.RemoveTab, { label: item.label });
  }

  function removeItem(event: MouseEvent, item: TabItem): void {
    event.stopPropagation();
    onremove?.(item.id);
  }

  function onKeydown(event: KeyboardEvent): void {
    const key = event.key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') {
      return;
    }

    if (!barRef) return;
    const tabs = Array.from(barRef.querySelectorAll<HTMLButtonElement>('.tab-item'));
    if (tabs.length === 0) return;

    const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number;

    switch (key) {
      case 'ArrowLeft':
        nextIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1;
        break;
      case 'ArrowRight':
        nextIndex = currentIndex === -1 || currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      default:
        nextIndex = tabs.length - 1;
        break;
    }

    event.preventDefault();
    tabs[nextIndex]?.focus();
  }

  function ensureActiveVisible(): void {
    if (!barRef) return;
    const activeTab = barRef.querySelector<HTMLElement>('.tab-item.active');
    const active = activeTab?.closest<HTMLElement>('.tab-item-wrap') ?? activeTab;
    if (!active) return;

    const barRect = barRef.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();

    if (activeRect.left < barRect.left) {
      barRef.scrollLeft -= barRect.left - activeRect.left + 8;
    } else if (activeRect.right > barRect.right) {
      barRef.scrollLeft += activeRect.right - barRect.right + 8;
    }
  }

  $effect(() => {
    // Re-check visibility when activeId or items change
    void activeId;
    void items;
    queueMicrotask(() => ensureActiveVisible());
  });

  $effect(() => {
    if (barRef && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => ensureActiveVisible());
      resizeObserver.observe(barRef);
    }
    return () => {
      resizeObserver?.disconnect();
      resizeObserver = null;
    };
  });
</script>

<div
  bind:this={barRef}
  class="tab-bar"
  role="tablist"
  tabindex="-1"
  onkeydown={onKeydown}
>
  {#each items as item (item.id)}
    {#if item.removable}
      <span class="tab-item-wrap" role="presentation" class:active={activeId === item.id}>
        <button
          type="button"
          role="tab"
          class="tab-item"
          id={idPrefix ? `${idPrefix}-tab-${item.id}` : undefined}
          aria-controls={idPrefix && activeId === item.id ? `${idPrefix}-panel-${item.id}` : undefined}
          class:active={activeId === item.id}
          aria-selected={activeId === item.id}
          tabindex={tabIndexFor(item)}
          onclick={() => select(item.id)}
        >
          <span class="tab-label">{item.label}</span>
          {#if item.badge !== undefined && item.badge !== null && item.badge !== 0}
            <span class="tab-badge">{item.badge}</span>
          {/if}
          {#if item.dot}
            <span class="tab-dot" aria-hidden="true"></span>
          {/if}
        </button>
        <button
          type="button"
          class="tab-remove-btn"
          tabindex={tabIndexFor(item)}
          aria-label={removeLabel(item)}
          title={removeLabel(item)}
          onclick={(e) => removeItem(e, item)}
        >
          <span class="icon icon-x icon-xs" aria-hidden="true"></span>
        </button>
      </span>
    {:else}
      <button
        type="button"
        role="tab"
        class="tab-item"
        id={idPrefix ? `${idPrefix}-tab-${item.id}` : undefined}
        aria-controls={idPrefix && activeId === item.id ? `${idPrefix}-panel-${item.id}` : undefined}
        class:active={activeId === item.id}
        aria-selected={activeId === item.id}
        tabindex={tabIndexFor(item)}
        onclick={() => select(item.id)}
      >
        <span class="tab-label">{item.label}</span>
        {#if item.badge !== undefined && item.badge !== null && item.badge !== 0}
          <span class="tab-badge">{item.badge}</span>
        {/if}
        {#if item.dot}
          <span class="tab-dot" aria-hidden="true"></span>
        {/if}
      </button>
    {/if}
  {/each}
</div>

<style>
  .tab-bar {
    display: inline-flex;
    gap: var(--space-1);
    padding: var(--space-1);
    background-color: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow-x: auto;
    max-width: 100%;
    min-width: 0;
  }

  .tab-item {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) 0.6875rem;
    background: none;
    border: none;
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast);
  }

  .tab-item:hover:not(.active) {
    color: var(--color-text-primary);
    background-color: var(--color-bg-hover);
  }

  .tab-item.active {
    background-color: var(--color-accent);
    color: var(--color-on-accent);
  }

  .tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1rem;
    height: 1rem;
    padding: 0 0.3125rem;
    background-color: rgba(255, 255, 255, 0.18);
    border-radius: 999px;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    font-variant-numeric: tabular-nums;
    color: inherit;
  }

  .tab-item:not(.active) .tab-badge {
    background-color: var(--color-bg-hover);
    color: var(--color-text-secondary);
  }

  .tab-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
    background-color: currentColor;
    flex-shrink: 0;
  }

  .tab-item-wrap {
    display: inline-flex;
    align-items: center;
    border-radius: var(--radius-md);
    transition: background-color var(--transition-fast);
  }

  .tab-item-wrap:hover:not(.active) {
    background-color: var(--color-bg-hover);
  }

  .tab-item-wrap.active {
    background-color: var(--color-accent);
  }

  .tab-item-wrap .tab-item,
  .tab-item-wrap .tab-item:hover:not(.active),
  .tab-item-wrap .tab-item.active {
    background-color: transparent;
  }

  .tab-item-wrap .tab-item {
    padding-inline-end: var(--space-1);
  }

  .tab-item-wrap:hover .tab-item:not(.active) {
    color: var(--color-text-primary);
  }

  .tab-remove-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.125rem;
    height: 1.125rem;
    margin-inline-end: 0.4375rem;
    padding: 0;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast);
  }

  .tab-item-wrap:hover .tab-remove-btn {
    color: var(--color-text-secondary);
  }

  .tab-item-wrap.active .tab-remove-btn {
    color: var(--color-on-accent);
  }

  .tab-remove-btn:hover,
  .tab-remove-btn:focus-visible {
    color: inherit;
    background-color: rgba(255, 255, 255, 0.18);
  }
</style>
