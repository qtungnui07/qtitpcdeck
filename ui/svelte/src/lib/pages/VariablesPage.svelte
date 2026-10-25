<script lang="ts">
  /*
   * The variables page.
   *
   * The rail lists sources, not variables: all, user, then one entry per integration. The detail
   * pane shows the variables of the selected source, grouped by where they came from.
   *
   * The selected source lives in the URL as `?integrationId=`, so a link to one plugin's variables
   * survives a reload and the back button works. Everything else is derived from it.
   */
  import Button from '$lib/components/Button.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import RailItem from '$lib/components/RailItem.svelte';
  import RailPage from '$lib/components/RailPage.svelte';
  import VariableRow from '$lib/components/VariableRow.svelte';
  import { translateKey, localizationTranslator } from '$lib/localization.svelte';
  import { integrationStore } from '$lib/integrations.svelte';
  import { deleteVariable, variableStore, visibleForContext } from '$lib/variables.svelte';
  import {
    groupVariablesBySource,
    integrationSourceEntries,
    matchesVariableSource,
    variableTypeLabels,
    type VariableSourceFilter,
  } from '$lib/variable-source';
  import { unboundCountFor, variableCatalog } from '$lib/variable-catalog.svelte';
  import { navigate, route } from '$lib/router.svelte';
  import type { Variable } from '@macro-deck/runtime';
  import { resolveLocalizedText } from '@macro-deck/runtime';

  const source = $derived<VariableSourceFilter>(readSource(route.query));

  function readSource(query: Record<string, string>): VariableSourceFilter {
    if (query.integrationId) return { kind: 'integration', integrationId: query.integrationId };
    if (query.source === 'user') return { kind: 'user' };
    return { kind: 'all' };
  }

  const globals = $derived(variableStore.globalVariables);
  const totalCount = $derived(globals.length);
  const userCount = $derived(globals.filter(v => v.classification === 'user').length);

  const catalogIntegrationIds = $derived(variableCatalog.providers.map(p => p.integrationId));

  const integrationSources = $derived(
    integrationSourceEntries(globals, integrationDisplayName, catalogIntegrationIds),
  );

  const visible = $derived(visibleForContext('global').filter(v => matchesVariableSource(v, source)));

  const typeLabels = $derived(variableTypeLabels(translateKey));

  const groups = $derived(
    groupVariablesBySource(
      visible,
      translateKey('macrodeck.app:Variables.ThisWidget'),
      integrationDisplayName,
      translateKey,
    ),
  );

  const heading = $derived.by(() => {
    switch (source.kind) {
      case 'all':
        return translateKey('macrodeck.app:Variables.AllVariablesHeading');
      case 'user':
        return translateKey('macrodeck.app:Variables.UserLabel');
      case 'integration':
        return integrationDisplayName(source.integrationId);
      default:
        return translateKey('macrodeck.app:Variables.AllVariablesHeading');
    }
  });

  let search = $state('');
  let pendingDelete = $state<Variable | null>(null);
  let deleteError = $state<string | null>(null);

  const filteredGroups = $derived.by(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;

    return groups
      .map(group => ({
        ...group,
        variables: group.variables.filter(
          v =>
            v.name.toLowerCase().includes(term) ||
            String(v.value ?? '').toLowerCase().includes(term),
        ),
      }))
      .filter(group => group.variables.length > 0);
  });

  function integrationDisplayName(integrationId: string): string {
    return integrationStore.integrations.find(i => i.id === integrationId)?.name ?? integrationId;
  }

  function selectAll(): void {
    navigate('/variables');
  }

  function selectUser(): void {
    navigate('/variables?source=user');
  }

  function selectIntegration(integrationId: string): void {
    navigate(`/variables?integrationId=${encodeURIComponent(integrationId)}`);
  }

  function isIntegrationSelected(integrationId: string): boolean {
    return source.kind === 'integration' && source.integrationId === integrationId;
  }

  function unboundFor(integrationId: string): number | null {
    return catalogIntegrationIds.includes(integrationId) ? unboundCountFor(integrationId) : null;
  }

  function displayValue(variable: Variable): string | null {
    if (variable.value === undefined || variable.value === null) return null;
    return String(variable.value);
  }

  function displayName(variable: Variable): string | null {
    const text = variable.displayName;
    if (!text) return null;
    const resolved = resolveLocalizedText(text, localizationTranslator);
    return resolved && resolved !== variable.name ? resolved : null;
  }

  async function confirmDelete(): Promise<void> {
    const target = pendingDelete;
    if (!target) return;

    deleteError = null;
    const ok = await deleteVariable(target.id);
    if (!ok) {
      deleteError = translateKey('macrodeck.app:Errors.Variables.WriteFailed');
      return;
    }

    pendingDelete = null;
  }

  /*
   * This page does not load anything. `startVariables`, `startVariableCatalog` and
   * `startIntegrations` run once at app start and keep the stores current from the push
   * channel, so a page that also fetched on mount would issue a second, redundant request
   * every time the user navigated back to it - and would race the push updates that are
   * already in flight. Keeping the page a pure view over the stores also means a test can
   * seed a store and render, with no transport to stand up.
   */
</script>

<RailPage railTitle={translateKey('macrodeck.app:Nav.Variables')}>
  {#snippet rail()}
    <ul
      class="source-list"
      role="listbox"
      aria-label={translateKey('macrodeck.app:Variables.VariableSourcesAriaLabel')}
    >
      <li>
        <RailItem
          label={translateKey('macrodeck.app:Variables.AllVariablesHeading')}
          count={totalCount}
          active={source.kind === 'all'}
          onclick={selectAll}
        />
      </li>
      <li>
        <RailItem
          label={translateKey('macrodeck.app:Variables.UserLabel')}
          count={userCount}
          active={source.kind === 'user'}
          onclick={selectUser}
        />
      </li>

      {#if integrationSources.length > 0}
        <li class="rail-section" aria-hidden="true">
          {translateKey('macrodeck.app:Nav.Integrations')}
        </li>
        {#each integrationSources as integration (integration.integrationId)}
          <li>
            <RailItem
              label={integration.name}
              count={integration.count}
              unboundCount={unboundFor(integration.integrationId)}
              active={isIntegrationSelected(integration.integrationId)}
              onclick={() => selectIntegration(integration.integrationId)}
            />
          </li>
        {/each}
      {/if}
    </ul>
  {/snippet}

  <div class="manager">
    <div class="manager-header">
      <h2 class="manager-title">{heading}</h2>
      <input
        class="manager-search"
        type="search"
        placeholder={translateKey('macrodeck.app:Variables.Manager.SearchPlaceholder')}
        aria-label={translateKey('macrodeck.app:Variables.Manager.SearchPlaceholder')}
        bind:value={search}
      />
    </div>

    {#if variableStore.isLoading}
      <p class="manager-status">{translateKey('macrodeck:Common.Loading')}</p>
    {:else if variableStore.loadError}
      <p class="manager-status manager-status--error">{variableStore.loadError}</p>
    {:else if filteredGroups.length === 0}
      <div class="manager-empty">
        <p class="manager-empty-heading">
          {translateKey(
            search.trim()
              ? 'macrodeck.app:Variables.Manager.EmptyFilteredHeading'
              : 'macrodeck.app:Variables.Manager.EmptyNoneHeading',
          )}
        </p>
        <p class="manager-empty-message">
          {translateKey(
            search.trim()
              ? 'macrodeck.app:Variables.Manager.EmptyFilteredMessage'
              : 'macrodeck.app:Variables.Manager.EmptyNoneMessage',
          )}
        </p>
      </div>
    {:else}
      <div class="vars-list">
        {#each filteredGroups as group (group.key)}
          <section class="vars-group">
            <h3 class="vars-group-heading">{group.label}</h3>
            {#each group.variables as variable (variable.id)}
              <VariableRow
                primary={variable.name}
                secondary={displayName(variable)}
                type={variable.type}
                typeLabel={typeLabels[variable.type]}
                value={displayValue(variable)}
                swatch={variable.type === 'color' ? displayValue(variable) : null}
                primaryMono
              >
                {#snippet side()}
                  <Button
                    variant="danger-ghost"
                    size="icon-compact"
                    ariaLabel={translateKey('macrodeck:Common.Delete')}
                    onclick={() => (pendingDelete = variable)}
                  >
                    <span class="icon icon-trash icon-sm"></span>
                  </Button>
                {/snippet}
              </VariableRow>
            {/each}
          </section>
        {/each}
      </div>
    {/if}

    {#if deleteError}
      <p class="manager-status manager-status--error">{deleteError}</p>
    {/if}
  </div>
</RailPage>

{#if pendingDelete}
  {@const target = pendingDelete}
  <ConfirmDialog
    heading={translateKey('macrodeck.app:Variables.Manager.DeleteHeading')}
    message={translateKey('macrodeck.app:Variables.Manager.DeleteMessage', { name: target.name })}
    confirmText={translateKey('macrodeck:Common.Delete')}
    cancelText={translateKey('macrodeck:Common.Cancel')}
    danger
    onconfirm={confirmDelete}
    oncancel={() => (pendingDelete = null)}
  />
{/if}

<style>
  .source-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-y: auto;
    min-height: 0;
  }

  .rail-section {
    margin-top: var(--space-3);
    padding: 0 var(--space-3) var(--space-1);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .manager {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1 1 auto;
    gap: var(--space-3);
  }

  .manager-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-shrink: 0;
  }

  .manager-title {
    margin: 0;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .manager-search {
    min-height: var(--control-height);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font: inherit;
    font-size: var(--text-sm);
    min-width: 12rem;
  }

  .manager-search:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .manager-status {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  .manager-status--error {
    color: var(--color-danger);
  }

  .vars-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    overflow-y: auto;
    min-height: 0;
    flex: 1 1 auto;
  }

  .vars-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .vars-group-heading {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .manager-empty {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-6) 0;
  }

  .manager-empty-heading {
    margin: 0;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .manager-empty-message {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }
</style>
