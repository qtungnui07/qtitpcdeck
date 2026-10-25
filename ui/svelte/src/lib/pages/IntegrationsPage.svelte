<script lang="ts">
  /*
   * The Integrations page.
   *
   * Displays the list of internal features and installed plugins, with live
   * counts of enabled integrations, search filtering, and facet controls for
   * status, type, and health issues.
   *
   * Disabling an integration prompts for confirmation through ConfirmDialog
   * because turning off a plugin deactivates its actions and variables across
   * existing buttons and automations.
   */

  import { AppStrings, Strings } from '@macro-deck/runtime';
  import Button from '$lib/components/Button.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import IntegrationCard from '$lib/components/IntegrationCard.svelte';
  import {
    integrationStore,
    toggleIntegration,
    type Integration,
  } from '$lib/integrations.svelte';
  import { translateKey } from '$lib/localization.svelte';
  import { navigate } from '$lib/router.svelte';

  type StatusFilter = 'all' | 'enabled' | 'disabled';
  type TypeFilter = 'all' | 'internal' | 'external';
  type IssuesFilter = 'all' | 'has' | 'none';

  let searchQuery = $state('');
  let statusFilter = $state<StatusFilter>('all');
  let typeFilter = $state<TypeFilter>('all');
  let issuesFilter = $state<IssuesFilter>('all');

  let disableTarget = $state<Integration | null>(null);

  const hasActiveFilters = $derived(
    statusFilter !== 'all' ||
      typeFilter !== 'all' ||
      issuesFilter !== 'all' ||
      searchQuery.trim() !== '',
  );

  const displayedIntegrations = $derived(
    integrationStore.integrations
      .filter(i => {
        const q = searchQuery.trim().toLowerCase();
        return q === '' || i.name.toLowerCase().includes(q);
      })
      .filter(i => {
        if (statusFilter === 'all') return true;
        return statusFilter === 'enabled' ? i.enabled : !i.enabled;
      })
      .filter(i => {
        if (typeFilter === 'all') return true;
        return typeFilter === 'internal' ? i.isInternal : !i.isInternal;
      })
      .filter(i => {
        if (issuesFilter === 'all') return true;
        return issuesFilter === 'has' ? i.issueCount > 0 : i.issueCount === 0;
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  function clearFilters(): void {
    searchQuery = '';
    statusFilter = 'all';
    typeFilter = 'all';
    issuesFilter = 'all';
  }

  function handleSelect(integration: Integration): void {
    void navigate(`/integrations/${integration.id}`);
  }

  function handleShowTab(integration: Integration, tab: 'actions' | 'variables'): void {
    void navigate(`/integrations/${integration.id}?tab=${tab}`);
  }

  function handleDisableRequest(integration: Integration): void {
    disableTarget = integration;
  }

  function confirmDisable(): void {
    if (disableTarget) {
      void toggleIntegration(disableTarget.id);
      disableTarget = null;
    }
  }

  function cancelDisable(): void {
    disableTarget = null;
  }
</script>

<div class="integrations-page">
  <div class="integrations-content">
    <header class="integrations-header">
      <div>
        <h1 class="integrations-title">{translateKey(AppStrings.Nav.Integrations)}</h1>
        <p class="integrations-subtitle">
          {translateKey(AppStrings.Integrations.Page.EnabledSubtitle, {
            enabled: integrationStore.enabledCount,
            total: integrationStore.integrations.length,
          })}
        </p>
      </div>
      <div class="integrations-header-actions">
        <Button variant="primary" onclick={() => navigate('/store')}>
          <span class="icon icon-store icon-sm"></span>
          <span>{translateKey(AppStrings.Integrations.Page.BrowseStoreAction)}</span>
        </Button>
      </div>
    </header>

    {#if integrationStore.isLoading}
      <p class="integrations-status">
        {translateKey(AppStrings.Integrations.Page.LoadingIntegrations)}
      </p>
    {:else if integrationStore.loadError}
      <p class="integrations-error">{integrationStore.loadError}</p>
    {:else if integrationStore.integrations.length === 0}
      <div class="integrations-empty">
        <span class="icon icon-puzzle icon-2xl integrations-empty-icon"></span>
        <h2 class="integrations-empty-heading">
          {translateKey(AppStrings.Integrations.Page.NoIntegrationsAvailableHeading)}
        </h2>
        <p class="integrations-empty-message">
          {translateKey(AppStrings.Integrations.Page.NoIntegrationsAvailableMessage)}
        </p>
      </div>
    {:else}
      <div class="integrations-toolbar">
        <div class="integrations-search">
          <input
            type="search"
            class="integrations-search-input"
            placeholder={translateKey(AppStrings.Integrations.Page.SearchPlaceholder)}
            bind:value={searchQuery}
          />
        </div>
      </div>

      <div class="integrations-filters">
        <div class="filter-group">
          <label class="filter-label" for="filter-status">
            {translateKey(AppStrings.Integrations.Page.FilterStatusLabel)}
          </label>
          <select id="filter-status" class="filter-select" bind:value={statusFilter}>
            <option value="all">{translateKey(AppStrings.Integrations.Page.FilterAll)}</option>
            <option value="enabled">{translateKey(Strings.Common.Enabled)}</option>
            <option value="disabled">{translateKey(Strings.Common.Disabled)}</option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label" for="filter-type">
            {translateKey(AppStrings.Integrations.Page.FilterTypeLabel)}
          </label>
          <select id="filter-type" class="filter-select" bind:value={typeFilter}>
            <option value="all">{translateKey(AppStrings.Integrations.Page.FilterAll)}</option>
            <option value="internal">{translateKey(AppStrings.Integrations.Page.InternalTag)}</option>
            <option value="external">{translateKey(AppStrings.Store.KindLabel.Plugin)}</option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label" for="filter-issues">
            {translateKey(AppStrings.Integrations.Page.FilterIssuesLabel)}
          </label>
          <select id="filter-issues" class="filter-select" bind:value={issuesFilter}>
            <option value="all">{translateKey(AppStrings.Integrations.Page.FilterAll)}</option>
            <option value="has">{translateKey(AppStrings.Integrations.Page.FilterHasIssues)}</option>
            <option value="none">{translateKey(AppStrings.Integrations.Page.FilterNoIssues)}</option>
          </select>
        </div>

        {#if hasActiveFilters}
          <button type="button" class="clear-filters-btn" onclick={clearFilters}>
            {translateKey(AppStrings.Integrations.Page.ClearFiltersAction)}
          </button>
        {/if}
      </div>

      {#if displayedIntegrations.length === 0}
        <div class="integrations-empty">
          <span class="icon icon-puzzle icon-2xl integrations-empty-icon"></span>
          <h2 class="integrations-empty-heading">
            {translateKey(AppStrings.Integrations.Page.NoMatchingIntegrationsHeading)}
          </h2>
          <p class="integrations-empty-message">
            {translateKey(
              hasActiveFilters
                ? AppStrings.Integrations.Page.NoMatchingFiltersMessage
                : AppStrings.Integrations.Page.NoMatchingIntegrationsMessage,
            )}
          </p>
        </div>
      {:else}
        <div class="integrations-list">
          {#each displayedIntegrations as integration (integration.id)}
            <IntegrationCard
              {integration}
              onselect={handleSelect}
              onshowtab={handleShowTab}
              ontoggle={id => void toggleIntegration(id)}
              ondisablerequest={handleDisableRequest}
            />
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

{#if disableTarget}
  <ConfirmDialog
    heading={translateKey(AppStrings.Integrations.Page.DisableHeading)}
    message={translateKey(AppStrings.Integrations.Page.DisableMessage, {
      name: disableTarget.name,
    })}
    confirmText={translateKey(AppStrings.Integrations.Page.DisableAction)}
    cancelText={translateKey(Strings.Common.Cancel)}
    danger={true}
    onconfirm={confirmDisable}
    oncancel={cancelDisable}
  />
{/if}

<style>
  .integrations-page {
    height: 100%;
    width: 100%;
    display: flex;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    overflow: hidden;
  }

  .integrations-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--space-4) var(--space-5);
    min-width: 0;
    overflow-y: auto;
  }

  .integrations-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-4);
    flex-shrink: 0;
  }

  .integrations-title {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--font-bold);
    color: var(--color-text-primary);
  }

  .integrations-subtitle {
    margin: var(--space-1) 0 0;
    font-size: var(--text-md);
    color: var(--color-text-muted);
  }

  .integrations-header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .integrations-status,
  .integrations-error {
    margin: var(--space-4) 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .integrations-error {
    color: var(--color-danger);
  }

  .integrations-toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .integrations-search {
    flex: 1 1 14rem;
    max-width: 24rem;
  }

  .integrations-search-input {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background-color: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
  }

  .integrations-search-input:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .integrations-filters {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .filter-label {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .filter-select {
    padding: 0.25rem var(--space-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    background-color: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .clear-filters-btn {
    background: none;
    border: none;
    color: var(--color-accent);
    font-size: var(--text-sm);
    cursor: pointer;
    padding: 0.25rem var(--space-2);
  }

  .clear-filters-btn:hover {
    text-decoration: underline;
  }

  .integrations-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .integrations-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-8) var(--space-4);
    text-align: center;
  }

  .integrations-empty-icon {
    color: var(--color-text-muted);
    margin-bottom: var(--space-3);
    opacity: 0.6;
  }

  .integrations-empty-heading {
    margin: 0 0 var(--space-2);
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .integrations-empty-message {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    max-width: 28rem;
  }
</style>
