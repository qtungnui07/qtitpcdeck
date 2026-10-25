<script lang="ts">
  /*
   * Reusable DetailPage component.
   *
   * Displays a slide-up surface for focused detail views (e.g. Integration Detail,
   * Widget Editor). Provides a back button in the header, animated exit, and graceful
   * fallback for reduced motion or dropped animation frames.
   */
  import type { Snippet } from 'svelte';
  import { onDestroy } from 'svelte';
  import { Strings } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';

  const CLOSE_FALLBACK_MS = 600;

  interface Props {
    backLabel?: string;
    onclose?: () => void;
    header?: Snippet;
    overlay?: Snippet;
    children?: Snippet;
  }

  let {
    backLabel,
    onclose,
    header,
    overlay,
    children,
  }: Props = $props();

  let surfaceRef: HTMLElement | null = $state(null);
  let leaving = $state(false);
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
  let closeEmitted = false;

  const resolvedBackLabel = $derived(backLabel ?? translateKey(Strings.Common.Back));

  function prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function emitCloseOnce(): void {
    if (closeEmitted) return;
    closeEmitted = true;
    onclose?.();
  }

  export function requestClose(): void {
    if (leaving) return;
    leaving = true;

    if (prefersReducedMotion()) {
      emitCloseOnce();
      return;
    }

    fallbackTimer = setTimeout(() => emitCloseOnce(), CLOSE_FALLBACK_MS);
  }

  function onSurfaceAnimationEnd(event: AnimationEvent): void {
    if (event.target !== surfaceRef || !leaving) return;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = undefined;
    }
    emitCloseOnce();
  }

  onDestroy(() => {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
    }
  });
</script>

<div
  bind:this={surfaceRef}
  class="dp-surface"
  class:dp-leaving={leaving}
  onanimationend={onSurfaceAnimationEnd}
>
  <header class="dp-topbar">
    <button
      type="button"
      class="dp-back"
      aria-label={resolvedBackLabel}
      title={resolvedBackLabel}
      onclick={requestClose}
    >
      <span class="icon icon-arrow-left rtl-mirror icon-md" aria-hidden="true"></span>
    </button>
    {#if header}
      {@render header()}
    {/if}
  </header>

  <div class="dp-body">
    {#if children}
      {@render children()}
    {/if}
  </div>

  {#if overlay}
    {@render overlay()}
  {/if}
</div>

<style>
  :global(.dp-host) {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .dp-surface {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    animation: dp-slide-up-in 200ms ease-out;
  }

  .dp-surface.dp-leaving {
    animation: dp-slide-up-out 160ms ease-in forwards;
  }

  @keyframes dp-slide-up-in {
    from {
      opacity: 0;
      transform: translateY(1rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes dp-slide-up-out {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(0.75rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dp-surface,
    .dp-surface.dp-leaving {
      animation: none;
    }
  }

  .dp-topbar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    height: 2.625rem;
    padding: 0 var(--space-4);
    border-bottom: 1px solid var(--color-border);
    flex: 0 0 auto;
  }

  .dp-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--control-height-compact, 2rem);
    height: var(--control-height-compact, 2rem);
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    flex-shrink: 0;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast);
  }

  .dp-back:hover {
    color: var(--color-text-primary);
    background-color: var(--color-bg-hover);
  }

  .dp-back:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .dp-body {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
  }
</style>
