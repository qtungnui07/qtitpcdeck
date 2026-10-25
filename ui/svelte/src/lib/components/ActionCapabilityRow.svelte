<script lang="ts">
  /*
   * One action capability row in the integration detail actions tab.
   *
   * Displays the action's name, description, parameters, and availability status.
   * Offers a "Try it" button that routes to the developer workbench when ready.
   */
  import {
    AppStrings,
    resolveLocalizedText,
    type IpcIntegrationActionCapability,
  } from '@macro-deck/runtime';
  import Button from '$lib/components/Button.svelte';
  import { localizationTranslator, translateKey } from '$lib/localization.svelte';

  interface Props {
    action: IpcIntegrationActionCapability;
    onopen?: () => void;
  }

  let { action, onopen }: Props = $props();

  const isReady = $derived(action.availability === 'Ready');
  const actionName = $derived(resolveLocalizedText(action.name, localizationTranslator));
  const actionDesc = $derived(
    action.description ? resolveLocalizedText(action.description, localizationTranslator) : null,
  );
  const paramsSummary = $derived(
    action.parameterSummary && action.parameterSummary.length > 0
      ? action.parameterSummary.join(', ')
      : null,
  );

  const tryItLabel = $derived(translateKey(AppStrings.Integrations.Detail.TryItAction));
  const tryItTitle = $derived(`${tryItLabel}: ${action.availabilityReason}`);
</script>

<li class="capability-row" class:unavailable={!isReady}>
  <div class="capability-row-main">
    <span class="capability-row-name">{actionName}</span>
    {#if actionDesc}
      <span class="capability-row-desc">{actionDesc}</span>
    {/if}
    {#if paramsSummary}
      <span class="capability-row-params">{paramsSummary}</span>
    {/if}
  </div>
  <div class="capability-row-side">
    <span class="availability-pill availability-{action.availability}">
      {action.availabilityReason}
    </span>
    <Button
      variant="secondary"
      size="compact"
      disabled={!isReady}
      title={tryItTitle}
      ariaLabel={tryItTitle}
      onclick={() => onopen?.()}
    >
      {tryItLabel}
    </Button>
  </div>
</li>

<style>
  .capability-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-4, 1rem);
    padding: 0.625rem 0.8125rem;
    background-color: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    list-style: none;
  }

  .capability-row.unavailable {
    opacity: 0.85;
  }

  .capability-row-main {
    display: flex;
    flex-direction: column;
    gap: 0.1875rem;
    min-width: 0;
  }

  .capability-row-name {
    font-weight: var(--font-semibold, 600);
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .capability-row-desc {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .capability-row-params {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .capability-row-side {
    display: flex;
    align-items: center;
    gap: var(--space-3, 0.75rem);
    flex-shrink: 0;
  }

  .availability-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold, 600);
    border: 1px solid transparent;
    white-space: nowrap;
  }

  .availability-Ready {
    color: var(--color-success);
    background-color: var(--color-success-muted);
  }

  .availability-SetupRequired,
  .availability-AvailableAfterSetup {
    color: var(--color-warning);
    background-color: var(--color-warning-muted);
  }

  .availability-IntegrationDisabled {
    color: var(--color-text-muted);
    background-color: var(--color-bg-hover);
  }

  .availability-Unavailable {
    color: var(--color-danger);
    background-color: var(--color-danger-muted);
  }

  @media (max-width: 768px) {
    .capability-row {
      grid-template-columns: minmax(0, 1fr);
    }
    .capability-row-side {
      align-items: flex-start;
    }
  }
</style>
