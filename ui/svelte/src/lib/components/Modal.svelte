<script lang="ts">
  /*
   * The modal frame every dialog in the app is built on.
   *
   * Two behaviours here are load-bearing and easy to lose in a rewrite:
   *
   * 1. A click only closes the dialog when the press *started* on the overlay. Without that, a
   *    drag that begins inside the dialog and ends on the overlay - selecting text, dragging a
   *    slider - closes it and throws the work away.
   * 2. A dialog ignores overlay clicks for its first 300ms. A double-click that opens a dialog
   *    would otherwise land its second click on the freshly mounted overlay and close it again.
   */
  import { onDestroy, onMount } from 'svelte';
  import { translateKey } from '$lib/localization.svelte';
  import { closeModal, isTopmostModal, openModal } from '$lib/modal-stack';
  import { isAnyPopoverOpenSince, nextPopoverOrder } from '$lib/popover-layer';

  interface Props {
    heading?: string;
    showHeader?: boolean;
    showFooter?: boolean;
    showClose?: boolean;
    closeOnOverlay?: boolean;
    closeOnOverlayClick?: boolean;
    maxWidth?: string;
    size?: 'small' | 'medium' | 'large' | 'full' | null;
    flush?: boolean;
    zIndex?: number | null;
    onclose?: () => void;
    children?: import('svelte').Snippet;
    footer?: import('svelte').Snippet;
  }

  let {
    heading = '',
    showHeader = true,
    showFooter = true,
    showClose = true,
    closeOnOverlay = true,
    closeOnOverlayClick = true,
    maxWidth = '450px',
    size = null,
    flush = false,
    zIndex = null,
    onclose,
    children,
    footer,
  }: Props = $props();

  const OPEN_GRACE_MS = 300;
  const CLOSE_ANIMATION_MS = 150;

  const token = openModal();
  const openedAt = Date.now();
  const openOrder = nextPopoverOrder();
  const headingId = `modal-heading-${Math.random().toString(36).slice(2, 9)}`;

  let closing = $state(false);
  let pressStartedOnOverlay = false;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const effectiveMaxWidth = $derived(
    size === 'small' ? '450px'
      : size === 'medium' ? '700px'
      : size === 'large' ? '1100px'
      : size === 'full' ? '95vw'
      : maxWidth,
  );

  const sizeClass = $derived(size ? `modal-size-${size}` : '');
  const closeLabel = $derived(translateKey('macrodeck:Common.Close'));

  function dismiss(then: () => void): void {
    if (closing) {
      then();
      return;
    }
    closing = true;
    closeTimer = setTimeout(then, CLOSE_ANIMATION_MS);
  }

  function requestClose(): void {
    if (closing) return;
    dismiss(() => onclose?.());
  }

  function onOverlayPointerDown(event: PointerEvent): void {
    pressStartedOnOverlay = event.target === event.currentTarget;
  }

  function onOverlayClick(event: MouseEvent): void {
    const startedOnOverlay = pressStartedOnOverlay;
    pressStartedOnOverlay = false;

    if (event.target !== event.currentTarget) return;
    event.stopPropagation();

    if (Date.now() - openedAt < OPEN_GRACE_MS) return;
    if (!startedOnOverlay) return;
    if (!closeOnOverlay || !closeOnOverlayClick) return;
    if (!isTopmostModal(token)) return;

    requestClose();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    if (!isTopmostModal(token)) return;
    if (!closeOnOverlay) return;
    if (isAnyPopoverOpenSince(openOrder)) return;
    event.stopImmediatePropagation();
    requestClose();
  }

  onMount(() => {
    document.addEventListener('keydown', onKeydown, true);
    return () => document.removeEventListener('keydown', onKeydown, true);
  });

  onDestroy(() => {
    closeModal(token);
    if (closeTimer !== undefined) clearTimeout(closeTimer);
  });
</script>

<div
  class="modal-overlay"
  class:closing
  style:z-index={zIndex ?? undefined}
  role="presentation"
  onpointerdown={onOverlayPointerDown}
  onclick={onOverlayClick}
  onkeydown={() => {}}
>
  <div
    class="modal-dialog {sizeClass}"
    style:max-width={effectiveMaxWidth}
    role="dialog"
    aria-modal="true"
    aria-labelledby={showHeader ? headingId : undefined}
  >
    {#if showHeader}
      <div class="modal-header">
        <h2 class="modal-title" id={headingId}>{heading}</h2>
        {#if showClose}
          <button class="modal-close-btn" aria-label={closeLabel} onclick={requestClose}>
            <span class="icon icon-x icon-lg"></span>
          </button>
        {/if}
      </div>
    {/if}

    <div class="modal-content" class:modal-content--flush={flush}>
      {@render children?.()}
    </div>

    {#if showFooter}
      <div class="modal-footer">
        {@render footer?.()}
      </div>
    {/if}
  </div>
</div>

<style>
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideIn {
    from { opacity: 0; transform: scale(0.96) translateY(-8px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  @keyframes fadeOut {
    to { opacity: 0; }
  }

  @keyframes slideOut {
    to { opacity: 0; transform: scale(0.96) translateY(-8px); }
  }

  /* Duration must stay in sync with CLOSE_ANIMATION_MS. */
  .modal-overlay.closing {
    animation: fadeOut 0.15s ease-in forwards;
    pointer-events: none;
  }

  .modal-overlay.closing .modal-dialog {
    animation: slideOut 0.15s ease-in forwards;
  }

  /*
   * No backdrop-filter: it would establish a containing block for fixed-position descendants and
   * its own stacking context, trapping a nested modal inside the parent overlay's z-stack. The
   * same trap applies to clip-path, mask, filter, contain and transform on any ancestor, since a
   * modal sits inline in the DOM rather than in a portal.
   */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--color-scrim);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
    animation: fadeIn 0.18s ease-out;
  }

  .modal-dialog {
    background-color: var(--color-bg-elevated);
    border-radius: var(--radius-xl);
    width: 90%;
    height: var(--modal-height, auto);
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-dialog);
    animation: slideIn 0.18s ease-out;
  }

  .modal-header {
    padding: 1rem var(--space-5);
    border-bottom: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-title {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .modal-close-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    padding: var(--space-1);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    transition: background-color var(--transition-fast), color var(--transition-fast);
  }

  .modal-close-btn:hover {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .modal-content {
    padding: var(--space-5);
    overflow-y: auto;
    /*
     * `1 1 auto`, not the `flex: 1` shorthand: that expands to a 0% basis, which old WebKit
     * resolves to a hard 0 instead of falling back to the content size in an auto-height
     * container - and with min-height: 0 defeating the content-based minimum too, the body
     * contributed no height and the dialog collapsed to its header.
     */
    flex: 1 1 auto;
    min-height: 0;
  }

  .modal-content--flush {
    padding: 0;
    overflow: hidden;
  }

  .modal-footer {
    padding: var(--space-4) var(--space-5);
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
    flex-shrink: 0;
  }

  .modal-size-small { max-width: 450px; }
  .modal-size-medium { max-width: 700px; }
  .modal-size-large { max-width: 1100px; }
  .modal-size-full { max-width: 95vw; }

  /*
   * Phones in either orientation: modals go full-screen edge to edge. max-width is overridden with
   * !important because the component sets it inline, which a plain rule cannot beat.
   */
  @media (max-width: 640px) {
    .modal-overlay {
      align-items: stretch;
      justify-content: stretch;
      height: 100%;
    }

    .modal-dialog {
      width: 100%;
      max-width: none !important;
      height: 100%;
      max-height: none;
      border-radius: 0;
      box-shadow: none;
      padding-right: env(safe-area-inset-right, 0px);
      padding-bottom: env(safe-area-inset-bottom, 0px);
      padding-left: env(safe-area-inset-left, 0px);
    }

    .modal-header {
      padding-top: calc(1rem + env(safe-area-inset-top, 0px));
    }
  }
</style>
