<script lang="ts">
  /*
   * Integration compatibility card.
   *
   * Displays API deprecation and compatibility diagnostics for plugins,
   * showing evidence source (confirmed, negotiated, inferred), severity,
   * guidance, and migration links.
   */
  import {
    AppStrings,
    type CompatibilityFindingSource,
    type PluginCompatibilityReport,
    type PluginCompatibilityState,
  } from '@macro-deck/runtime';
  import Button from '$lib/components/Button.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { openExternal } from '$lib/external-link';
  import { translateKey } from '$lib/localization.svelte';

  const EVIDENCE_TEXT: Record<CompatibilityFindingSource, string> = {
    confirmed: "Confirmed from the plugin's build-time usage manifest.",
    negotiated: 'From protocol negotiation.',
    inferred: 'Inferred from the SDK version - this plugin may be affected.',
    unknown: 'Not reported by this plugin.',
  };

  const STATE_LABELS: Record<PluginCompatibilityState, string> = {
    compatible: 'Compatible',
    deprecated_apis: 'Deprecated APIs',
    update_recommended: 'Update recommended',
    update_required: 'Update required',
    partially_incompatible: 'Partially incompatible',
    incompatible: 'Incompatible',
  };

  const STATE_TIERS: Record<PluginCompatibilityState, 'ok' | 'warning' | 'danger'> = {
    compatible: 'ok',
    deprecated_apis: 'warning',
    update_recommended: 'warning',
    update_required: 'danger',
    partially_incompatible: 'danger',
    incompatible: 'danger',
  };

  const SOURCE_LABELS: Record<CompatibilityFindingSource, string> = {
    confirmed: 'Confirmed',
    negotiated: 'Negotiated',
    inferred: 'Inferred',
    unknown: 'Unknown',
  };

  interface Props {
    report: PluginCompatibilityReport | null;
    loading?: boolean;
    error?: string | null;
  }

  let { report = null, loading = false, error = null }: Props = $props();

  function stateLabel(state: PluginCompatibilityState): string {
    return STATE_LABELS[state] ?? state;
  }

  function stateTier(state: PluginCompatibilityState): 'ok' | 'warning' | 'danger' {
    return STATE_TIERS[state] ?? 'warning';
  }

  function evidenceText(rep: PluginCompatibilityReport): string {
    return EVIDENCE_TEXT[rep.usageSource] ?? EVIDENCE_TEXT.unknown;
  }

  function sourceLabel(source: CompatibilityFindingSource): string {
    return SOURCE_LABELS[source] ?? source;
  }

  function openMigrationLink(url: string): void {
    openExternal(url);
  }
</script>

<section class="detail-card detail-card-wide">
  <div class="detail-card-header">
    <h2 class="detail-card-title">{translateKey(AppStrings.Integrations.Detail.CompatibilityTitle)}</h2>
    {#if report && report.state !== 'compatible'}
      <span class="compat-badge tier-{stateTier(report.state)}">{stateLabel(report.state)}</span>
    {/if}
  </div>

  {#if loading}
    <div class="loading-state">
      <span class="spinner" aria-hidden="true"></span>
      <span>{translateKey(AppStrings.Integrations.Detail.CheckingCompatibility)}</span>
    </div>
  {:else if error}
    <div class="error-banner">
      <span>{error}</span>
    </div>
  {:else if !report}
    <EmptyState
      icon="info"
      heading={translateKey(AppStrings.Integrations.Detail.NoCompatibilityData)}
      message={translateKey(AppStrings.Integrations.Detail.NoCompatibilityDataMessage)}
    />
  {:else}
    <p class="compat-evidence">{evidenceText(report)}</p>

    {#if report.usageTruncated}
      <p class="compat-truncated-note">
        {translateKey(AppStrings.Integrations.Detail.UsageTruncatedNote)}
      </p>
    {/if}

    {#if report.findings.length === 0}
      <EmptyState
        icon="check"
        heading={translateKey(AppStrings.Integrations.Detail.NoKnownIssuesHeading)}
        message={translateKey(AppStrings.Integrations.Detail.NoKnownIssuesMessage)}
      />
    {:else}
      <div class="compat-findings-list">
        {#each report.findings as finding (finding.diagnosticId + finding.subject)}
          <div class="compat-finding-item finding-{finding.severity}">
            <div class="compat-finding-text">
              <span class="compat-finding-title">
                <span class="compat-finding-subject">{finding.subject}</span>
                <span class="compat-finding-diagnostic">{finding.diagnosticId}</span>
                <span class="compat-finding-source source-{finding.source}">{sourceLabel(finding.source)}</span>
              </span>
              <span class="compat-finding-guidance">{finding.guidance}</span>
              {#if finding.deprecatedIn || finding.removedIn || finding.replacement}
                <span class="compat-finding-meta">
                  {#if finding.deprecatedIn}
                    <span>{translateKey(AppStrings.Integrations.Detail.DeprecatedIn, { version: finding.deprecatedIn })}</span>
                  {/if}
                  {#if finding.removedIn}
                    <span>{translateKey(AppStrings.Integrations.Detail.RemovalPlanned, { version: finding.removedIn })}</span>
                  {/if}
                  {#if finding.replacement}
                    <span>{translateKey(AppStrings.Integrations.Detail.ReplaceWith, { replacement: finding.replacement })}</span>
                  {/if}
                </span>
              {/if}
            </div>
            {#if finding.migrationUrl}
              <Button variant="secondary" size="compact" onclick={() => openMigrationLink(finding.migrationUrl!)}>
                {translateKey(AppStrings.Integrations.Detail.MigrationGuideAction)}
              </Button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</section>

<style>
  .detail-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    grid-column: 1 / -1;
    background-color: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-4) 1rem;
  }

  .detail-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .detail-card-title {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .compat-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem var(--space-2);
    border-radius: 999px;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    border: 1px solid transparent;
    flex-shrink: 0;
  }

  .compat-badge.tier-ok {
    color: var(--color-success);
    background-color: var(--color-success-muted);
  }

  .compat-badge.tier-warning {
    color: var(--color-warning);
    background-color: var(--color-warning-muted);
  }

  .compat-badge.tier-danger {
    color: var(--color-danger);
    background-color: var(--color-danger-muted);
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-4);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-banner {
    display: flex;
    align-items: center;
    padding: var(--space-2) var(--space-3);
    background-color: var(--color-danger-muted);
    color: var(--color-danger);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
  }

  .compat-evidence {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .compat-truncated-note {
    margin: var(--space-2) 0 0;
    padding: var(--space-2) var(--space-3);
    background-color: var(--color-bg-tertiary);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .compat-findings-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .compat-finding-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
    padding: var(--space-2) var(--space-3);
    background-color: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-inline-start: 3px solid var(--color-text-muted);
    border-radius: var(--radius-sm);
  }

  .compat-finding-item.finding-error {
    border-inline-start-color: var(--color-danger);
  }

  .compat-finding-item.finding-warning {
    border-inline-start-color: var(--color-warning);
  }

  .compat-finding-item.finding-info {
    border-inline-start-color: var(--color-accent);
  }

  .compat-finding-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1 1 11.375rem;
    min-width: 0;
  }

  .compat-finding-title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .compat-finding-subject {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .compat-finding-diagnostic {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .compat-finding-source {
    display: inline-flex;
    align-items: center;
    padding: 0.0625rem var(--space-2);
    border-radius: 999px;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    white-space: nowrap;
  }

  .compat-finding-source.source-confirmed {
    background-color: var(--color-success-muted);
    color: var(--color-success);
  }

  .compat-finding-source.source-negotiated {
    background-color: color-mix(in srgb, var(--color-accent) 15%, transparent);
    color: var(--color-accent);
  }

  .compat-finding-source.source-inferred {
    background-color: var(--color-warning-muted);
    color: var(--color-warning);
  }

  .compat-finding-source.source-unknown {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-muted);
  }

  .compat-finding-guidance {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .compat-finding-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
</style>
