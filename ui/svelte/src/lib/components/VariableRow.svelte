<script lang="ts">
  /*
   * One variable in a list.
   *
   * The value column has three mutually exclusive forms: an "unavailable" badge, a value (with a
   * swatch when it is a colour), or an action label that only appears on hover. A row that showed
   * both a value and an action would read as two different things at once.
   */
  import type { Snippet } from 'svelte';
  import type { VariableType } from '@macro-deck/runtime';

  interface Props {
    primary: string;
    secondary?: string | null;
    type?: VariableType | null;
    typeLabel?: string | null;
    value?: string | null;
    swatch?: string | null;
    unavailable?: string | null;
    unavailableLabel?: string;
    actionLabel?: string | null;
    primaryMono?: boolean;
    secondaryMono?: boolean;
    interactive?: boolean;
    title?: string;
    dimmed?: boolean;
    onactivate?: () => void;
    meta?: Snippet;
    side?: Snippet;
    actions?: Snippet;
  }

  let {
    primary,
    secondary = null,
    type = null,
    typeLabel = null,
    value = null,
    swatch = null,
    unavailable = null,
    unavailableLabel = 'Unavailable',
    actionLabel = null,
    primaryMono = false,
    secondaryMono = false,
    interactive = false,
    title = '',
    dimmed = false,
    onactivate,
    meta,
    side,
    actions,
  }: Props = $props();
</script>

{#snippet body()}
  <span class="vr-text">
    <span class="vr-primary" class:vr-mono={primaryMono} title={primary}>{primary}</span>
    <span class="vr-meta">
      {#if typeLabel}
        <span class="vr-type type-{type}">{typeLabel}</span>
      {/if}
      {@render meta?.()}
      {#if secondary}
        <span class="vr-secondary" class:vr-mono={secondaryMono} title={secondary}>{secondary}</span>
      {/if}
    </span>
  </span>
  <span class="vr-side">
    {#if unavailable}
      <span class="vr-unavailable" role="img" title={unavailable} aria-label={unavailable}>
        {unavailableLabel}
      </span>
    {:else if value !== null}
      {#if swatch}
        <span class="vr-swatch" aria-hidden="true" style:--vr-swatch={swatch}></span>
      {/if}
      <span class="vr-value" title={value}>{value}</span>
    {:else if actionLabel}
      <span class="vr-action">{actionLabel}</span>
    {/if}
    {@render side?.()}
  </span>
{/snippet}

<div class="vr-row" class:vr-dimmed={dimmed}>
  {#if interactive}
    <button type="button" class="vr-main vr-button" title={title} onclick={onactivate}>
      {@render body()}
    </button>
  {:else}
    <div class="vr-main">
      {@render body()}
    </div>
  {/if}
  {@render actions?.()}
</div>

<style>
  .vr-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1 1 auto;
    min-width: 0;
    box-sizing: border-box;
    padding-inline-end: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-elevated);
    transition: border-color var(--transition-fast);
  }

  .vr-row:has(.vr-button:hover),
  .vr-row:has(.vr-button:focus-visible) {
    border-color: var(--color-accent);
  }

  .vr-main {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1 1 auto;
    min-width: 0;
    align-self: stretch;
    box-sizing: border-box;
    padding: 0 0 0 var(--space-3);
  }

  .vr-button {
    background: none;
    border: 0;
    color: inherit;
    font: inherit;
    text-align: start;
  }

  .vr-text {
    display: flex;
    flex-direction: column;
    gap: 0.1875rem;
    flex: 1 1 0;
    min-width: 0;
  }

  .vr-primary {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-base);
    color: var(--color-text-primary);
  }

  .vr-mono {
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  }

  .vr-meta {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
    font-size: var(--text-xs);
  }

  .vr-type {
    flex: 0 0 auto;
    padding: 0.0625rem 0.375rem;
    border-radius: var(--radius-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background-color: var(--type-string-bg);
    color: var(--type-string-fg);
  }

  .vr-type.type-numeric { background-color: var(--type-numeric-bg); color: var(--type-numeric-fg); }
  .vr-type.type-boolean { background-color: var(--type-boolean-bg); color: var(--type-boolean-fg); }
  .vr-type.type-color { background-color: var(--type-resource-bg); color: var(--type-resource-fg); }

  .vr-secondary {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 0 1 auto;
    min-width: 0;
    color: var(--color-text-muted);
  }

  .vr-side {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-2);
    flex: 0 0 auto;
    min-width: 0;
    max-width: 40%;
  }

  .vr-side:empty {
    display: none;
  }

  .vr-swatch {
    flex: 0 0 auto;
    width: 0.875rem;
    height: 0.875rem;
    border-radius: var(--radius-sm);
    background:
      linear-gradient(var(--vr-swatch), var(--vr-swatch)),
      repeating-conic-gradient(#c8c8c8 0% 25%, #ffffff 0% 50%) 50% / 0.375rem 0.375rem;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.18);
  }

  .vr-value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: var(--text-base);
    color: var(--color-text-primary);
  }

  .vr-unavailable {
    padding: 0.0625rem 0.3125rem;
    border-radius: 0.1875rem;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--color-warning);
    background-color: var(--color-warning-muted);
    border: 1px solid var(--color-warning);
  }

  .vr-action {
    flex: 0 0 auto;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-accent);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  .vr-row:hover .vr-action,
  .vr-button:focus-visible .vr-action {
    opacity: 1;
  }

  @media (hover: none) {
    .vr-action {
      opacity: 1;
    }
  }

  .vr-dimmed .vr-main {
    opacity: 0.6;
  }
</style>
