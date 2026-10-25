<script lang="ts">
  /*
   * A floating context menu positioned at (x, y) coordinates.
   *
   * Automatically bounds itself within the viewport edges. Closes when clicking
   * outside or selecting an item.
   */
  import { onMount, onDestroy } from 'svelte';
  import { registerPopover, unregisterPopover } from '$lib/popover-layer';

  export interface ContextMenuItem {
    id: string;
    label: string;
    icon?: string;
    disabled?: boolean;
    danger?: boolean;
    dividerAfter?: boolean;
  }

  interface Props {
    items: readonly ContextMenuItem[];
    x: number;
    y: number;
    minWidth?: number;
    onselect: (id: string) => void;
    onclose: () => void;
  }

  let { items, x, y, minWidth = 180, onselect, onclose }: Props = $props();

  const token = Symbol('context-menu');
  let menuEl = $state<HTMLDivElement | null>(null);
  let adjustedX = $state(0);
  let adjustedY = $state(0);

  $effect(() => {
    let newX = x;
    let newY = y;
    if (menuEl && typeof window !== 'undefined') {
      const rect = menuEl.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      newX = x + rect.width > viewportWidth ? Math.max(8, viewportWidth - rect.width - 8) : x;
      newY = y + rect.height > viewportHeight ? Math.max(8, viewportHeight - rect.height - 8) : y;
    }
    adjustedX = newX;
    adjustedY = newY;
  });

  onMount(() => {
    registerPopover(token);

    if (menuEl) {
      menuEl.focus();
    }
  });

  onDestroy(() => {
    unregisterPopover(token);
  });

  function handleSelect(item: ContextMenuItem, event: MouseEvent): void {
    event.stopPropagation();
    if (item.disabled) return;
    onselect(item.id);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onclose();
    }
  }

  function handleBackdrop(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    onclose();
  }
</script>

<!-- Transparent backdrop catching clicks outside the popup -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="context-menu-backdrop"
  onclick={handleBackdrop}
  oncontextmenu={handleBackdrop}
></div>

<div
  bind:this={menuEl}
  class="context-menu"
  role="menu"
  tabindex="-1"
  style="left: {adjustedX}px; top: {adjustedY}px; min-width: {minWidth}px;"
  onkeydown={handleKeyDown}
>
  {#each items as item (item.id)}
    <button
      type="button"
      class="menu-item"
      class:danger={item.danger}
      class:disabled={item.disabled}
      disabled={item.disabled}
      role="menuitem"
      onclick={(e) => handleSelect(item, e)}
    >
      {#if item.icon}
        <span class="icon {item.icon} icon-sm" aria-hidden="true"></span>
      {/if}
      <span class="label">{item.label}</span>
    </button>
    {#if item.dividerAfter}
      <div class="divider" role="separator"></div>
    {/if}
  {/each}
</div>

<style>
  .context-menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-popover, 1000);
    background: transparent;
  }

  .context-menu {
    position: fixed;
    z-index: calc(var(--z-popover, 1000) + 1);
    display: flex;
    flex-direction: column;
    padding: var(--space-1);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    box-sizing: border-box;
    overflow-y: auto;
    max-height: 80vh;
  }

  .context-menu:focus-visible {
    outline: none;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: none;
    background: transparent;
    color: var(--color-text-primary);
    font: inherit;
    font-size: var(--text-sm);
    text-align: start;
    border-radius: var(--radius-sm);
    cursor: pointer;
    box-sizing: border-box;
    transition: background-color var(--transition-fast), color var(--transition-fast);
  }

  .menu-item:hover:not(.disabled),
  .menu-item:focus-visible:not(.disabled) {
    background-color: var(--color-bg-hover);
    color: var(--color-text-primary);
    outline: none;
  }

  .menu-item.danger {
    color: var(--color-danger);
  }

  .menu-item.danger:hover:not(.disabled),
  .menu-item.danger:focus-visible:not(.disabled) {
    background-color: var(--color-danger-muted);
  }

  .menu-item.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .menu-item .label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .divider {
    height: 1px;
    background-color: var(--color-border);
    margin: var(--space-1) var(--space-2);
  }
</style>
