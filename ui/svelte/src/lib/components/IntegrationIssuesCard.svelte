<script lang="ts">
  /*
   * Integration issues card.
   *
   * Displays reported runtime issues for an enabled integration, categorized
   * by severity (info, warning, error), with optional resolution action buttons.
   */
  import {
    AppStrings,
    resolveLocalizedText,
    type IntegrationIssueSeverity,
    type IpcIntegrationIssue,
  } from '@macro-deck/runtime';
  import Button from '$lib/components/Button.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { localizationTranslator, translateKey } from '$lib/localization.svelte';

  const SEVERITY_RANK: Record<IntegrationIssueSeverity, number> = { info: 0, warning: 1, error: 2 };

  interface Props {
    issues: IpcIntegrationIssue[];
    loading?: boolean;
    error?: string | null;
    resolvingIssueId?: string | null;
    ondismissError?: () => void;
    onresolveIssue?: (issue: IpcIntegrationIssue) => void;
  }

  let {
    issues = [],
    loading = false,
    error = null,
    resolvingIssueId = null,
    ondismissError,
    onresolveIssue,
  }: Props = $props();

  const severity = $derived<IntegrationIssueSeverity | null>(
    issues.length === 0
      ? null
      : issues.reduce<IntegrationIssueSeverity>(
          (max, issue) => (SEVERITY_RANK[issue.severity] > SEVERITY_RANK[max] ? issue.severity : max),
          issues[0].severity,
        ),
  );

  const issueCountLabel = $derived(
    translateKey(AppStrings.Integrations.Page.IssueCount, { count: issues.length }),
  );
</script>

<section class="detail-card detail-card-wide">
  <div class="detail-card-header">
    <h2 class="detail-card-title">{translateKey(AppStrings.Integrations.Detail.IssuesTitle)}</h2>
    {#if issues.length > 0 && severity}
      <span class="issue-badge issue-badge-{severity}">
        {issueCountLabel}
      </span>
    {/if}
  </div>

  {#if loading}
    <div class="loading-state">
      <span class="spinner" aria-hidden="true"></span>
      <span>{translateKey(AppStrings.Integrations.Detail.CheckingIssues)}</span>
    </div>
  {:else if error}
    <div class="error-banner">
      <span>{error}</span>
      {#if ondismissError}
        <button type="button" class="error-dismiss" onclick={ondismissError}>&times;</button>
      {/if}
    </div>
  {:else if issues.length === 0}
    <EmptyState
      icon="check"
      heading={translateKey(AppStrings.Integrations.Detail.NoIssuesHeading)}
      message={translateKey(AppStrings.Integrations.Detail.NoIssuesMessage)}
    />
  {:else}
    <div class="issues-list">
      {#each issues as issue (issue.id)}
        <div class="issue-item issue-{issue.severity}">
          <div class="issue-text">
            <span class="issue-item-title">{resolveLocalizedText(issue.title, localizationTranslator)}</span>
            {#if issue.description}
              <span class="issue-desc">{resolveLocalizedText(issue.description, localizationTranslator)}</span>
            {/if}
          </div>
          {#if issue.actionLabel}
            <Button
              variant="secondary"
              size="compact"
              loading={resolvingIssueId === issue.id}
              disabled={resolvingIssueId !== null}
              onclick={() => onresolveIssue?.(issue)}
            >
              {resolveLocalizedText(issue.actionLabel, localizationTranslator)}
            </Button>
          {/if}
        </div>
      {/each}
    </div>
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

  .issue-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem var(--space-2);
    border-radius: 999px;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    border: 1px solid transparent;
    flex-shrink: 0;
  }

  .issue-badge-error {
    color: var(--color-danger);
    background-color: var(--color-danger-muted);
  }

  .issue-badge-warning {
    color: var(--color-warning);
    background-color: var(--color-warning-muted);
  }

  .issue-badge-info {
    color: var(--color-accent);
    background-color: color-mix(in srgb, var(--color-accent) 15%, transparent);
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
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    background-color: var(--color-danger-muted);
    color: var(--color-danger);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
  }

  .error-dismiss {
    background: none;
    border: none;
    color: inherit;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0 var(--space-1);
    line-height: 1;
  }

  .issues-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .issue-item {
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

  .issue-item.issue-error {
    border-inline-start-color: var(--color-danger);
  }

  .issue-item.issue-warning {
    border-inline-start-color: var(--color-warning);
  }

  .issue-item.issue-info {
    border-inline-start-color: var(--color-accent);
  }

  .issue-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1 1 11.375rem;
    min-width: 0;
  }

  .issue-item-title {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .issue-desc {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    line-height: 1.4;
  }
</style>
