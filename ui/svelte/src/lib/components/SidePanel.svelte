<script lang="ts">
  /*
   * The side panel a shell surface slides in, ported from the Angular
   * SidePanelComponent: a scrim that closes on click, the panel itself sliding
   * by its inset (never a transform - a transform would become the containing
   * block of fixed-position modals rendered inside the content), Escape closes
   * it, and focus returns to the opener when it closes.
   *
   * Escape is handled on the document during the open state only, and stops
   * immediate propagation so handlers behind the scrim do not act on it too.
   */
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    edge?: 'start' | 'end';
    heading: string;
    closeLabel?: string;
    width?: string;
    actions?: Snippet;
    onclose: () => void;
    children?: Snippet;
  }

  let {
    open,
    edge = 'end',
    heading,
    closeLabel = 'Close',
    width = '24rem',
    actions,
    onclose,
    children,
  }: Props = $props();

  let opener: HTMLElement | null = null;

  $effect(() => {
    if (open) {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    } else if (opener !== null) {
      const target = opener;
      opener = null;
      if (target !== document.body && target.isConnected) {
        queueMicrotask(() => target.focus());
      }
    }
  });

  onMount(() => {
    const onKeydown = (event: KeyboardEvent): void => {
      if (!open || event.key !== 'Escape') return;
      if (document.querySelector('.modal-overlay')) return;
      event.stopImmediatePropagation();
      onclose();
    };
    document.addEventListener('keydown', onKeydown, true);
    return () => document.removeEventListener('keydown', onKeydown, true);
  });
</script>

<div class="sp-root" class:sp-open={open} style:--sp-width={width}>
  <div class="sp-scrim" class:sp-scrim-visible={open} aria-hidden="true" onclick={onclose}></div>

  <aside
    class="sp-panel"
    class:sp-panel-end={edge === 'end'}
    class:sp-panel-open={open}
    inert={!open}
    role="complementary"
    aria-label={heading}
    aria-hidden={open ? undefined : 'true'}
  >
    <header class="sp-header">
      <span class="sp-title">{heading}</span>
      <div class="sp-header-actions">
        {@render actions?.()}
        <button type="button" class="sp-close" aria-label={closeLabel} onclick={onclose}>×</button>
      </div>
    </header>

    <div class="sp-body">
      {@render children?.()}
    </div>
  </aside>
</div>

<style>
  .sp-root {
    position: absolute;
    inset: 0;
    z-index: 30;
    overflow: hidden;
    pointer-events: none;
  }

  .sp-scrim {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.4);
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms ease;
  }

  .sp-scrim-visible {
    opacity: 1;
    pointer-events: auto;
  }

  .sp-panel {
    --sp-offset: calc(-1 * var(--sp-width, 24rem));

    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--sp-offset);
    width: var(--sp-width, 24rem);
    max-width: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg-secondary);
    border-right: 1px solid var(--color-border);
    pointer-events: auto;
    visibility: hidden;
    transition: left 200ms ease, right 200ms ease, visibility 0s 200ms;
  }

  .sp-panel-end {
    left: auto;
    right: var(--sp-offset);
    border-right: none;
    border-left: 1px solid var(--color-border);
  }

  .sp-panel-open {
    --sp-offset: 0px;

    visibility: visible;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
    transition: left 200ms ease, right 200ms ease, visibility 0s;
  }

  .sp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2, 0.5rem);
    flex-shrink: 0;
    padding: var(--space-3, 0.75rem) var(--space-3, 0.75rem) var(--space-2, 0.5rem);
  }

  .sp-title {
    font-size: var(--text-sm, 0.875rem);
    font-weight: var(--font-semibold, 600);
    color: var(--color-text-primary);
  }

  .sp-header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1, 0.25rem);
  }

  .sp-close {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: var(--text-md, 1rem);
    line-height: 1;
    padding: 0.25rem;
  }

  .sp-close:hover {
    color: var(--color-text-primary);
  }

  .sp-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 var(--space-3, 0.75rem) var(--space-3, 0.75rem);
  }
</style>
