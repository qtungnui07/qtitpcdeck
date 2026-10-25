<script lang="ts">
  /*
   * Toast notification host container.
   *
   * Renders transient toast messages stacked at the bottom-right corner of the viewport.
   * Uses role="status" and aria-live="polite" to notify assistive technologies.
   */
  import { dismissToast, toastStore } from '$lib/toasts.svelte';

  const MAX_VISIBLE = 5;

  const visibleToasts = $derived(toastStore.toasts.slice(-MAX_VISIBLE));
</script>

<div class="th" role="status" aria-live="polite">
  {#each visibleToasts as toast (toast.id)}
    <div class="th-toast th-{toast.variant}">
      <svg
        class="th-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        {#if toast.variant === 'error'}
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        {:else if toast.variant === 'warning'}
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        {:else if toast.variant === 'info'}
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        {:else}
          <path d="M20 6 9 17l-5-5" />
        {/if}
      </svg>

      <div class="th-text">
        <span class="th-message">{toast.message}</span>
        {#if toast.detail}
          <span class="th-detail">{toast.detail}</span>
        {/if}
      </div>

      <button
        class="th-dismiss"
        type="button"
        aria-label="Dismiss"
        onclick={() => dismissToast(toast.id)}
      >
        <svg
          class="th-dismiss-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  {/each}
</div>

<style>
  .th {
    position: fixed;
    right: var(--space-4, 1rem);
    bottom: var(--space-4, 1rem);
    left: auto;
    z-index: var(--z-toast, 2000);
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
    align-items: flex-end;
    pointer-events: none;
  }

  .th-toast {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3, 0.75rem);
    width: min(21.125rem, calc(100vw - var(--space-6, 1.5rem)));
    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
    border-radius: var(--radius-lg, 0.5rem);
    background: var(--color-bg-elevated, #242933);
    color: var(--color-text-primary, #eceff4);
    border: 1px solid var(--color-border-overlay, rgba(255, 255, 255, 0.1));
    border-inline-start: 3px solid var(--color-success, #a3be8c);
    box-shadow: var(--shadow-popover, 0 10px 15px -3px rgba(0, 0, 0, 0.3));
    pointer-events: auto;
    animation: th-in 160ms ease-out;
  }

  .th-error {
    border-inline-start-color: var(--color-danger, #bf616a);
  }

  .th-warning {
    border-inline-start-color: var(--color-warning, #ebcb8b);
  }

  .th-info {
    border-inline-start-color: var(--color-accent, #88c0d0);
  }

  .th-icon {
    flex: none;
    width: 0.9375rem;
    height: 0.9375rem;
    margin-top: 0.125rem;
    color: var(--color-success, #a3be8c);
  }

  .th-error .th-icon {
    color: var(--color-danger, #bf616a);
  }

  .th-warning .th-icon {
    color: var(--color-warning, #ebcb8b);
  }

  .th-info .th-icon {
    color: var(--color-accent, #88c0d0);
  }

  .th-text {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
  }

  .th-message {
    font-size: var(--text-base, 0.875rem);
  }

  .th-detail {
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-secondary, #d8dee9);
    overflow-wrap: anywhere;
  }

  .th-dismiss {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    opacity: 0.6;
    cursor: pointer;
  }

  .th-dismiss:hover {
    opacity: 1;
  }

  .th-dismiss-icon {
    display: block;
    width: 0.6875rem;
    height: 0.6875rem;
  }

  @keyframes th-in {
    from {
      opacity: 0;
      transform: translateY(0.375rem);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .th-toast {
      animation: none;
    }
  }
</style>
