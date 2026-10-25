<script lang="ts">
  /*
   * Empty state placeholder.
   *
   * Displayed when a list, search result, or page collection has no items.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    icon?: string;
    heading?: string;
    message?: string;
    compact?: boolean;
    children?: Snippet;
  }

  let {
    icon = '',
    heading = '',
    message = '',
    compact = false,
    children,
  }: Props = $props();
</script>

<div class="es" class:es-compact={compact}>
  {#if icon}
    <span
      class="es-icon icon icon-{icon} {compact ? 'icon-lg' : 'icon-2xl'}"
      aria-hidden="true"
    ></span>
  {/if}

  {#if heading}
    <h3 class="es-title">{heading}</h3>
  {/if}

  {#if message}
    <p class="es-message">{message}</p>
  {/if}

  {@render children?.()}
</div>

<style>
  .es {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3, 0.75rem);
    padding: var(--space-8, 2rem) var(--space-5, 1.25rem);
    text-align: center;
  }

  .es-compact {
    gap: var(--space-2, 0.5rem);
    padding: var(--space-4, 1rem) var(--space-3, 0.75rem);
  }

  .es-compact .es-title {
    font-size: var(--text-md, 0.9375rem);
  }

  .es-compact .es-message {
    font-size: var(--text-sm, 0.8125rem);
  }

  .es-icon {
    color: var(--color-text-muted);
  }

  .es-title {
    margin: 0;
    font-size: var(--text-lg, 1.125rem);
    font-weight: var(--font-semibold, 600);
    color: var(--color-text-primary);
  }

  .es-message {
    margin: 0;
    font-size: var(--text-md, 0.9375rem);
    color: var(--color-text-muted);
    max-width: 24rem;
  }
</style>
