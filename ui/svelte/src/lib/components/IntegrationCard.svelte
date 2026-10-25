<script lang="ts">
  /*
   * A summary card for an integration.
   *
   * Displays the integration's brand icon, display name, version/origin badge,
   * counts for actions and variables, extra capability badges, issue status, and
   * an enable/disable toggle. Clicking the card opens its detail view, while
   * clicking action/variable counters jumps directly to that capability's tab.
   */

  import { AppStrings, resolveLocalizedText } from '@macro-deck/runtime';
  import {
    COUNTED_CAPABILITY_KINDS,
    integrationCapabilityIcon,
  } from '$lib/integration-capability';
  import {
    integrationIconUrl,
    type Integration,
  } from '$lib/integrations.svelte';
  import { localizationTranslator, translateKey } from '$lib/localization.svelte';
  import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';

  interface Props {
    integration: Integration;
    onselect?: (integration: Integration) => void;
    onshowtab?: (integration: Integration, tab: 'actions' | 'variables') => void;
    ontoggle?: (id: string) => void;
    ondisablerequest?: (integration: Integration) => void;
  }

  let {
    integration,
    onselect,
    onshowtab,
    ontoggle,
    ondisablerequest,
  }: Props = $props();

  const iconUrl = $derived(
    integration.hasIcon
      ? integrationIconUrl(integration.id, integration.iconVersion)
      : null,
  );

  const extraCapabilities = $derived(
    integration.providedCapabilities.filter(
      c => !COUNTED_CAPABILITY_KINDS.includes(c.kind),
    ),
  );

  function handleCardClick(): void {
    onselect?.(integration);
  }

  function handleActionCountClick(event: MouseEvent): void {
    event.stopPropagation();
    onshowtab?.(integration, 'actions');
  }

  function handleVariableCountClick(event: MouseEvent): void {
    event.stopPropagation();
    onshowtab?.(integration, 'variables');
  }

  function handleToggle(checked: boolean): void {
    if (!checked) {
      // Disabling requires confirmation to prevent accidental loss of active actions.
      ondisablerequest?.(integration);
    } else {
      ontoggle?.(integration.id);
    }
  }
</script>

<div
  class="integration-card"
  role="button"
  tabindex="0"
  onclick={handleCardClick}
  onkeydown={e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  }}
>
  <div class="integration-card-main">
    <div class="integration-card-header">
      <div class="integration-info">
        {#if iconUrl}
          <img class="integration-brand-icon" src={iconUrl} alt="" />
        {:else}
          <span class="icon icon-puzzle icon-lg integration-icon"></span>
        {/if}
        <div class="integration-title-group">
          <span class="integration-name">{integration.name}</span>
          {#if !integration.isInternal}
            <span class="integration-version">v{integration.version}</span>
            <span class="kind-badge">
              {translateKey(AppStrings.Store.KindLabel.Plugin)}
            </span>
          {/if}
        </div>
      </div>
    </div>

    <div class="integration-card-meta">
      <button
        type="button"
        class="meta-item meta-item-link"
        onclick={handleActionCountClick}
      >
        <span class="icon icon-zap icon-xs"></span>
        <span>
          {translateKey(AppStrings.Integrations.Page.ActionCount, {
            count: integration.actionCount,
          })}
        </span>
      </button>

      <button
        type="button"
        class="meta-item meta-item-link"
        onclick={handleVariableCountClick}
      >
        <span class="icon icon-sliders icon-xs"></span>
        <span>
          {translateKey(AppStrings.Integrations.Page.VariableCount, {
            count: integration.variableCount,
          })}
        </span>
      </button>

      {#each extraCapabilities as capability (capability.kind)}
        <span class="meta-item">
          <span
            class="icon icon-xs"
            class:icon-puzzle={integrationCapabilityIcon(capability.kind) === 'puzzle'}
            class:icon-image={integrationCapabilityIcon(capability.kind) === 'image'}
            class:icon-bell={integrationCapabilityIcon(capability.kind) === 'bell'}
            class:icon-mail={integrationCapabilityIcon(capability.kind) === 'mail'}
            class:icon-layers={integrationCapabilityIcon(capability.kind) === 'layers'}
            class:icon-battery={integrationCapabilityIcon(capability.kind) === 'battery'}
          ></span>
          <span>{resolveLocalizedText(capability.name, localizationTranslator)}</span>
        </span>
      {/each}

      {#if integration.issueCount > 0}
        <span
          class="issue-badge"
          class:issue-badge-warning={integration.issueSeverity === 'warning' || !integration.issueSeverity}
          class:issue-badge-danger={integration.issueSeverity === 'error'}
        >
          {translateKey(AppStrings.Integrations.Page.IssueCount, {
            count: integration.issueCount,
          })}
        </span>
      {/if}
    </div>
  </div>

  <div class="integration-card-actions" onclick={e => e.stopPropagation()} role="presentation">
    <ToggleSwitch
      checked={integration.enabled}
      ariaLabel={integration.name}
      onchange={handleToggle}
    />
    <span class="icon icon-chevron-right rtl-mirror icon-sm integration-chevron"></span>
  </div>
</div>

<style>
  .integration-card {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    cursor: pointer;
    background-color: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
    transition: background-color var(--transition-fast), border-color var(--transition-fast);
  }

  .integration-card:hover {
    background-color: var(--color-bg-tertiary);
    border-color: var(--color-border-light);
  }

  .integration-card-main {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    flex: 1 1 auto;
    min-width: 0;
  }

  .integration-card-header {
    display: flex;
    align-items: center;
  }

  .integration-info {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .integration-title-group {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .integration-icon {
    color: var(--color-accent);
  }

  .integration-brand-icon {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    object-fit: contain;
    flex-shrink: 0;
  }

  .integration-name {
    font-weight: var(--font-semibold);
    font-size: var(--text-lg);
    color: var(--color-text-primary);
  }

  .integration-version {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .kind-badge {
    padding: 0.125rem var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    letter-spacing: 0.02em;
    text-transform: uppercase;
    background-color: var(--color-bg-tertiary);
    color: var(--color-accent);
    font-weight: var(--font-semibold);
  }

  .integration-card-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);
    padding-inline-start: 2rem;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.3125rem;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  button.meta-item-link {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: color var(--transition-fast);
  }

  button.meta-item-link:hover {
    color: var(--color-accent);
  }

  .issue-badge {
    padding: 0.125rem var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
  }

  .issue-badge-warning {
    color: var(--color-warning);
    background-color: var(--color-warning-muted);
  }

  .issue-badge-danger {
    color: var(--color-danger);
    background-color: var(--color-danger-muted);
  }

  .integration-card-actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: var(--space-3);
  }

  .integration-chevron {
    color: var(--color-text-muted);
  }
</style>
