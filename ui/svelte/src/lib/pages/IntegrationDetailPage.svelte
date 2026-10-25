<script lang="ts">
  /*
   * The Integration Detail page.
   *
   * Displays integration metadata, runtime status, health issues, declared
   * capabilities (actions and variables), and configuration entries.
   * Provides three tabs:
   *  - Overview: runtime status badges, issues card, compatibility card, general info,
   *    additional capabilities, and configuration entries list with management actions.
   *  - Actions: searchable list of action capabilities with "Try it" buttons.
   *  - Variables: searchable list of declared and dynamically bound variables.
   */

  import { onMount } from 'svelte';
  import {
    AppStrings,
    Strings,
    resolveLocalizedText,
    type ConfigEntryDto,
    type GetIntegrationCapabilitiesResponse,
    type IntegrationIssuesChangedEvent,
    type IntegrationsChangedEvent,
    type IpcIntegrationActionCapability,
    type IpcIntegrationIssue,
    type IpcIntegrationVariableCapability,
    type Variable,
  } from '@macro-deck/runtime';
  import { onNotificationOf } from '$lib/api.svelte';
  import ActionCapabilityRow from '$lib/components/ActionCapabilityRow.svelte';
  import Button from '$lib/components/Button.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import DetailPage from '$lib/components/DetailPage.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import IntegrationCompatibilityCard from '$lib/components/IntegrationCompatibilityCard.svelte';
  import IntegrationIssuesCard from '$lib/components/IntegrationIssuesCard.svelte';
  import IntegrationStatusStrip, {
    type IntegrationStatusBadge,
  } from '$lib/components/IntegrationStatusStrip.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import TabBar, { type TabItem } from '$lib/components/TabBar.svelte';
  import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
  import VariableRow from '$lib/components/VariableRow.svelte';
  import { COUNTED_CAPABILITY_KINDS } from '$lib/integration-capability';
  import {
    deleteIntegrationConfigEntry,
    fetchIntegrationCapabilities,
    fetchIntegrationConfigEntries,
    fetchIntegrationIssues,
    integrationIconUrl,
    integrationStore,
    loadIntegrations,
    renameIntegrationConfigEntry,
    resolveIntegrationIssue,
    toggleIntegration,
  } from '$lib/integrations.svelte';
  import { localizationTranslator, translateKey } from '$lib/localization.svelte';
  import {
    forPlugin,
    loadPluginCompatibility,
    pluginCompatibilityStore,
  } from '$lib/plugin-compatibility.svelte';
  import { navigate, route } from '$lib/router.svelte';
  import { showToast } from '$lib/toasts.svelte';
  import { variableTypeLabels } from '$lib/variable-source';
  import { variableStore } from '$lib/variables.svelte';

  type DetailTab = 'overview' | 'actions' | 'variables';

  interface Props {
    integrationId?: string;
    initialCapabilities?: GetIntegrationCapabilitiesResponse | null;
    initialIssues?: IpcIntegrationIssue[] | null;
    initialConfigEntries?: ConfigEntryDto[] | null;
  }

  let {
    integrationId: propIntegrationId,
    initialCapabilities,
    initialIssues,
    initialConfigEntries,
  }: Props = $props();

  const activeIntegrationId = $derived(propIntegrationId ?? route.params.integrationId ?? '');

  const integration = $derived(
    integrationStore.integrations.find(i => i.id === activeIntegrationId) ?? null,
  );

  let activeTab = $state<DetailTab>('overview');

  let actionSearch = $state('');
  let variableSearch = $state('');

  let capabilities = $state<GetIntegrationCapabilitiesResponse | null>(null);
  let capabilitiesLoading = $state(false);
  let capabilitiesError = $state<string | null>(null);

  let issues = $state<IpcIntegrationIssue[]>([]);
  let issuesLoading = $state(false);
  let issuesError = $state<string | null>(null);
  let resolvingIssueId = $state<string | null>(null);

  let configEntries = $state<ConfigEntryDto[]>([]);

  const typeLabels = $derived(variableTypeLabels(translateKey));

  $effect(() => {
    const tab = route.query.tab;
    if (tab === 'actions' || tab === 'variables') {
      activeTab = tab;
    } else {
      activeTab = 'overview';
    }
  });

  $effect(() => {
    if (initialCapabilities !== undefined) {
      capabilities = initialCapabilities;
    }
  });

  $effect(() => {
    if (initialIssues !== undefined) {
      issues = initialIssues ?? [];
    }
  });

  $effect(() => {
    if (initialConfigEntries !== undefined) {
      configEntries = initialConfigEntries ?? [];
    }
  });

  let showDisableConfirm = $state(false);
  let pendingRemove = $state<ConfigEntryDto | null>(null);
  let configurationName = $state('');
  let configurationNameTarget = $state<ConfigEntryDto | null>(null);
  let configurationMutationPending = $state(false);

  const canSetUp = $derived(integration?.supportsConfigFlow === true);

  const requiresSetup = $derived(
    canSetUp &&
      integration?.requiresConfiguration !== false &&
      !configEntries.some(entry => entry.usable !== false),
  );

  const configurationOptional = $derived(
    canSetUp &&
      integration?.requiresConfiguration === false &&
      configEntries.length === 0,
  );

  const statusKind = $derived<'setup' | 'disabled' | 'starting' | 'ready' | ''>(
    !integration
      ? ''
      : requiresSetup
        ? 'setup'
        : !integration.enabled
          ? 'disabled'
          : !integration.isInitialized
            ? 'starting'
            : 'ready',
  );

  const statusLabel = $derived.by(() => {
    switch (statusKind) {
      case 'setup':
        return translateKey(AppStrings.Integrations.Detail.StatusSetupRequired);
      case 'disabled':
        return translateKey(AppStrings.Integrations.Detail.StatusDisabled);
      case 'starting':
        return translateKey(AppStrings.Integrations.Detail.StatusStarting);
      case 'ready':
        return translateKey(AppStrings.Integrations.Detail.StatusReady);
      default:
        return '';
    }
  });

  const statusClass = $derived.by(() => {
    switch (statusKind) {
      case 'setup':
        return 'status-chip-setup';
      case 'disabled':
        return 'status-chip-disabled';
      case 'starting':
        return 'status-chip-starting';
      default:
        return 'status-chip-ready';
    }
  });

  const disableMessage = $derived(
    translateKey(AppStrings.Integrations.Page.DisableMessage, {
      name:
        integration?.name ?? translateKey(AppStrings.Integrations.Page.FallbackIntegrationName),
    }),
  );

  const removeConfigurationMessage = $derived(
    translateKey(AppStrings.Integrations.Detail.RemoveConfigEntryMessage, {
      name: pendingRemove?.title ?? '',
    }),
  );

  const setUpLabel = $derived.by(() => {
    if (integration?.allowsMultipleConfigurations) {
      return translateKey(AppStrings.Integrations.Detail.AddConfigurationAction);
    }
    const reconfiguring = !integration?.allowsMultipleConfigurations && configEntries.length > 0;
    return translateKey(
      reconfiguring
        ? AppStrings.Integrations.Detail.ReconfigureAction
        : AppStrings.Integrations.Detail.SetUpAction,
    );
  });

  const issuesHealthy = $derived(
    integration?.enabled === true &&
      !issuesLoading &&
      issuesError === null &&
      issues.length === 0,
  );

  const compatibilityReport = $derived(
    integration && !integration.isInternal ? forPlugin(integration.id) : null,
  );

  const compatibilityHealthy = $derived(
    !pluginCompatibilityStore.isLoading &&
      pluginCompatibilityStore.loadError === null &&
      compatibilityReport !== null &&
      compatibilityReport.state === 'compatible' &&
      !compatibilityReport.usageTruncated &&
      compatibilityReport.findings.length === 0,
  );

  const compatibilityUnknown = $derived(
    integration?.isInternal === false &&
      !pluginCompatibilityStore.isLoading &&
      pluginCompatibilityStore.loadError === null &&
      compatibilityReport === null,
  );

  const showIssuesCard = $derived(integration?.enabled === true && !issuesHealthy);

  const showCompatibilityCard = $derived(
    integration?.isInternal === false && !compatibilityHealthy && !compatibilityUnknown,
  );

  const statusBadges = $derived.by<IntegrationStatusBadge[]>(() => {
    const badges: IntegrationStatusBadge[] = [];
    if (issuesHealthy) {
      badges.push({
        id: 'issues',
        tier: 'ok',
        icon: 'check',
        label: translateKey(AppStrings.Integrations.Detail.RunningCleanly),
      });
    }
    if (integration?.isInternal === false) {
      if (compatibilityHealthy) {
        badges.push({
          id: 'compatibility',
          tier: 'ok',
          icon: 'check',
          label: translateKey(AppStrings.Integrations.Detail.FullyCompatible),
        });
      } else if (compatibilityUnknown) {
        badges.push({
          id: 'compatibility',
          tier: 'neutral',
          icon: 'info',
          label: translateKey(AppStrings.Integrations.Detail.NoCompatibilityData),
        });
      }
    }
    return badges;
  });

  const additionalCapabilities = $derived(
    (integration?.providedCapabilities ?? []).filter(
      c => !COUNTED_CAPABILITY_KINDS.includes(c.kind),
    ),
  );

  const declaredActions = $derived(capabilities?.actions ?? []);

  const actionsCount = $derived(
    capabilities?.actions.length ?? integration?.actionCount ?? 0,
  );

  const filteredActions = $derived.by(() => {
    const query = actionSearch.trim().toLowerCase();
    if (!query) return declaredActions;
    return declaredActions.filter(a => {
      const name = resolveLocalizedText(a.name, localizationTranslator).toLowerCase();
      const desc = a.description
        ? resolveLocalizedText(a.description, localizationTranslator).toLowerCase()
        : '';
      return name.includes(query) || desc.includes(query);
    });
  });

  const declaredVariables = $derived.by<IpcIntegrationVariableCapability[]>(() => {
    const declared = capabilities?.variables ?? [];
    const id = activeIntegrationId;
    const live = new Map(
      variableStore.variables
        .filter(v => v.ownerIntegrationId === id)
        .map(v => [v.name, v] as const),
    );

    if (live.size === 0) return declared;

    return declared.map(capability => {
      if (capability.availability !== 'Ready' && capability.availability !== 'Unavailable') {
        return capability;
      }
      const match = live.get(capability.name);
      if (!match) return capability;

      const available = match.available ?? true;
      return {
        ...capability,
        value: available ? match.value : capability.value,
        valueAvailable: available,
        availability: available ? 'Ready' : 'Unavailable',
        availabilityReason: available ? 'Ready' : 'Unavailable',
      };
    });
  });

  const boundVariables = $derived.by<Variable[]>(() => {
    const id = activeIntegrationId;
    const declared = new Set(declaredVariables.map(v => v.name));
    return variableStore.variables.filter(
      v =>
        v.ownerIntegrationId === id &&
        !!v.dynamicResourceId &&
        v.scope === 'global' &&
        !declared.has(v.name),
    );
  });

  const variablesCount = $derived(
    (capabilities?.variables.length ?? integration?.variableCount ?? 0) + boundVariables.length,
  );

  const filteredVariables = $derived.by(() => {
    const query = variableSearch.trim().toLowerCase();
    if (!query) return declaredVariables;
    return declaredVariables.filter(v => `vars.${v.name}`.toLowerCase().includes(query));
  });

  const filteredBoundVariables = $derived.by(() => {
    const query = variableSearch.trim().toLowerCase();
    if (!query) return boundVariables;
    return boundVariables.filter(v => `vars.${v.name}`.toLowerCase().includes(query));
  });

  const listedVariableCount = $derived(
    filteredVariables.length + filteredBoundVariables.length,
  );

  const totalVariableCount = $derived(
    declaredVariables.length + boundVariables.length,
  );

  const tabs = $derived.by<TabItem[]>(() => [
    {
      id: 'overview',
      label: translateKey(AppStrings.Integrations.Detail.OverviewTab),
    },
    {
      id: 'actions',
      label: translateKey(AppStrings.Integrations.Detail.ActionsTab),
      badge: actionsCount,
    },
    {
      id: 'variables',
      label: translateKey(AppStrings.Integrations.Detail.VariablesTab),
      badge: variablesCount,
    },
  ]);

  const resourceUnavailableLabel = $derived(
    translateKey(AppStrings.Variables.Dynamic.ResourceUnavailable),
  );

  const iconUrl = $derived(
    integration?.hasIcon ? integrationIconUrl(integration.id, integration.iconVersion) : null,
  );

  async function loadCapabilities(): Promise<void> {
    const id = activeIntegrationId;
    if (!id) return;
    capabilitiesLoading = true;
    capabilitiesError = null;
    try {
      capabilities = await fetchIntegrationCapabilities(id);
    } catch {
      capabilitiesError = translateKey(AppStrings.Integrations.Detail.LoadCapabilitiesFailed);
    } finally {
      capabilitiesLoading = false;
    }
  }

  async function loadIssues(): Promise<void> {
    const id = activeIntegrationId;
    if (!id || !integration?.enabled) {
      issues = [];
      issuesLoading = false;
      issuesError = null;
      return;
    }
    issuesLoading = true;
    issuesError = null;
    try {
      const res = await fetchIntegrationIssues(id);
      issues = res.issues ?? [];
    } catch {
      issuesError = translateKey(AppStrings.Integrations.Detail.LoadIssuesFailed);
    } finally {
      issuesLoading = false;
    }
  }

  async function loadConfigEntries(): Promise<void> {
    const id = activeIntegrationId;
    if (!id || !integration?.supportsConfigFlow) return;
    try {
      const res = await fetchIntegrationConfigEntries(id);
      configEntries = res.entries ?? [];
    } catch {
      // Gracefully retain existing state on error
    }
  }

  async function refreshAfterConfigurationMutation(): Promise<void> {
    await loadIntegrations();
    await loadConfigEntries();
    await loadIssues();
    await loadCapabilities();
  }

  function goBack(): void {
    void navigate('/integrations');
  }

  function handleTabChange(id: string): void {
    const tab = id as DetailTab;
    activeTab = tab;
    void navigate(
      `/integrations/${activeIntegrationId}${tab === 'overview' ? '' : `?tab=${tab}`}`,
      { replace: true },
    );
  }

  function handleToggle(): void {
    if (!integration) return;

    if (integration.enabled) {
      showDisableConfirm = true;
      return;
    }

    void toggleAndRefresh(integration.id);
  }

  function cancelDisable(): void {
    showDisableConfirm = false;
  }

  async function confirmDisable(): Promise<void> {
    showDisableConfirm = false;
    if (integration) {
      await toggleAndRefresh(integration.id);
    }
  }

  async function toggleAndRefresh(id: string): Promise<void> {
    await toggleIntegration(id);
    await loadIssues();
    await loadCapabilities();
  }

  function onRenameEntry(entry: ConfigEntryDto): void {
    configurationName = entry.title;
    configurationNameTarget = entry;
  }

  function cancelConfigurationName(): void {
    configurationNameTarget = null;
  }

  async function submitConfigurationName(): Promise<void> {
    const title = configurationName.trim();
    if (!title || configurationMutationPending || !integration || !configurationNameTarget) return;

    configurationMutationPending = true;
    try {
      const res = await renameIntegrationConfigEntry(
        integration.id,
        configurationNameTarget.id,
        title,
      );
      if (!res.success) {
        showToast(
          res.error?.message ??
            translateKey(AppStrings.Integrations.Detail.ConfigurationMutationFailed),
          { variant: 'error' },
        );
        return;
      }
      cancelConfigurationName();
      await refreshAfterConfigurationMutation();
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : translateKey(AppStrings.Integrations.Detail.ConfigurationMutationFailed),
        { variant: 'error' },
      );
    } finally {
      configurationMutationPending = false;
    }
  }

  function onRemoveEntry(entry: ConfigEntryDto): void {
    pendingRemove = entry;
  }

  function cancelRemoveEntry(): void {
    pendingRemove = null;
  }

  async function confirmRemoveEntry(): Promise<void> {
    if (!integration || !pendingRemove || configurationMutationPending) return;

    const entry = pendingRemove;
    pendingRemove = null;
    configurationMutationPending = true;
    try {
      const res = await deleteIntegrationConfigEntry(integration.id, entry.id, true);
      if (!res.success) {
        showToast(
          res.error?.message ??
            translateKey(AppStrings.Integrations.Detail.ConfigurationMutationFailed),
          { variant: 'error' },
        );
        return;
      }
      await refreshAfterConfigurationMutation();
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : translateKey(AppStrings.Integrations.Detail.ConfigurationMutationFailed),
        { variant: 'error' },
      );
    } finally {
      configurationMutationPending = false;
    }
  }

  async function handleResolveIssue(issue: IpcIntegrationIssue): Promise<void> {
    if (!integration || resolvingIssueId) return;

    resolvingIssueId = issue.id;
    try {
      const res = await resolveIntegrationIssue(integration.id, issue.id);
      const message = res.message ? resolveLocalizedText(res.message, localizationTranslator) : '';
      if (message) {
        showToast(message, { variant: res.success ? 'success' : 'error' });
      }
      await loadIntegrations();
      await loadIssues();
      await loadCapabilities();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to resolve issue', {
        variant: 'error',
      });
    } finally {
      resolvingIssueId = null;
    }
  }

  function configurationStatusLabel(entry: ConfigEntryDto): string {
    const key = {
      Connected: AppStrings.Integrations.Detail.ConfigStatusConnected,
      Connecting: AppStrings.Integrations.Detail.ConfigStatusConnecting,
      Reconnecting: AppStrings.Integrations.Detail.ConfigStatusReconnecting,
      Disconnected: AppStrings.Integrations.Detail.ConfigStatusDisconnected,
      NeedsReconfiguration: AppStrings.Integrations.Detail.ConfigStatusNeedsReconfiguration,
      Ready: AppStrings.Integrations.Detail.ConfigStatusReady,
    }[entry.status ?? 'Ready'];
    return translateKey(key ?? AppStrings.Integrations.Detail.ConfigStatusReady);
  }

  function configurationStatusClass(entry: ConfigEntryDto): string {
    if (!entry.status || entry.status === 'Connected' || entry.status === 'Ready') {
      return 'config-status-ok';
    }
    if (entry.status === 'NeedsReconfiguration' || entry.status === 'Disconnected') {
      return 'config-status-warning';
    }
    return 'config-status-pending';
  }

  function templateChipLabel(name: string): string {
    const placeholder = /<([^<>]+)>/.exec(name)?.[1];
    return placeholder
      ? translateKey(AppStrings.Integrations.Detail.OnePerConfiguredPlaceholder, { placeholder })
      : translateKey(AppStrings.Integrations.Detail.OnePerConfiguration);
  }

  function boundValue(variable: Variable): string {
    const value = variable.value ?? '';
    return variable.unit
      ? translateKey(AppStrings.Variables.Format.ValueWithUnit, { value, unit: variable.unit })
      : value;
  }

  function boundDisplayName(variable: Variable): string | null {
    return resolveLocalizedText(variable.displayName, localizationTranslator) || null;
  }

  function tryInDeveloper(action: IpcIntegrationActionCapability): void {
    if (action.availability !== 'Ready' || !integration) return;
    void navigate(
      `/developer?actionId=${encodeURIComponent(action.id)}&integrationId=${encodeURIComponent(integration.id)}`,
    );
  }

  onMount(() => {
    if (initialCapabilities === undefined) {
      void loadCapabilities();
    }
    if (initialIssues === undefined) {
      void loadIssues();
    }
    if (initialConfigEntries === undefined) {
      void loadConfigEntries();
    }
    void loadPluginCompatibility();

    const unsubIssues = onNotificationOf<IntegrationIssuesChangedEvent>(
      'IntegrationIssuesChangedEvent',
      event => {
        if (event.integrationId === activeIntegrationId) {
          issues = event.issues ?? [];
          issuesError = null;
        }
      },
    );

    const unsubChanged = onNotificationOf<IntegrationsChangedEvent>(
      'IntegrationsChangedEvent',
      event => {
        if (event.integrationId === activeIntegrationId) {
          void loadCapabilities();
        }
      },
    );

    return () => {
      unsubIssues();
      unsubChanged();
    };
  });
</script>

{#if integration}
  <DetailPage
    backLabel={translateKey(AppStrings.Integrations.Detail.BackToIntegrations)}
    onclose={goBack}
  >
    {#snippet header()}
      <div class="detail-header-content">
        {#if iconUrl}
          <img class="detail-brand-icon" src={iconUrl} alt="" />
        {:else}
          <span class="icon icon-puzzle icon-lg detail-brand-glyph" aria-hidden="true"></span>
        {/if}
        <div class="detail-heading">
          <h1 class="detail-name">{integration.name}</h1>
          {#if !integration.isInternal}
            <span class="detail-version">v{integration.version}</span>
            <span class="kind-badge">{translateKey(AppStrings.Store.KindLabel.Plugin)}</span>
          {/if}
          <span class="status-chip {statusClass}">{statusLabel}</span>
        </div>
        <ToggleSwitch
          ariaLabel={translateKey(AppStrings.Integrations.Detail.EnableIntegration)}
          checked={integration.enabled}
          onchange={handleToggle}
        />
      </div>
    {/snippet}

    <div class="detail-tabs">
      <TabBar
        idPrefix="integration-detail"
        items={tabs}
        activeId={activeTab}
        onchange={handleTabChange}
      />
    </div>

    <div class="detail-body">
      {#if activeTab === 'overview'}
        <div
          id="integration-detail-panel-overview"
          role="tabpanel"
          aria-labelledby="integration-detail-tab-overview"
          class="detail-grid"
        >
          {#if statusBadges.length > 0}
            <IntegrationStatusStrip badges={statusBadges} />
          {/if}

          {#if showIssuesCard}
            <IntegrationIssuesCard
              {issues}
              loading={issuesLoading}
              error={issuesError}
              {resolvingIssueId}
              ondismissError={() => {
                issuesError = null;
              }}
              onresolveIssue={handleResolveIssue}
            />
          {/if}

          {#if showCompatibilityCard}
            <IntegrationCompatibilityCard
              report={compatibilityReport}
              loading={pluginCompatibilityStore.isLoading}
              error={pluginCompatibilityStore.loadError}
            />
          {/if}

          <section class="detail-card">
            <h2 class="detail-card-title">
              {translateKey(AppStrings.Integrations.Detail.GeneralSectionTitle)}
            </h2>
            <div class="detail-field">
              <span class="detail-label">
                {translateKey(AppStrings.Integrations.Detail.IdFieldLabel)}
              </span>
              <span class="detail-value">{integration.id}</span>
            </div>
            {#if !integration.isInternal}
              <div class="detail-field">
                <span class="detail-label">
                  {translateKey(AppStrings.Integrations.Detail.VersionFieldLabel)}
                </span>
                <span class="detail-value">{integration.version}</span>
              </div>
            {/if}
          </section>

          <section class="detail-card">
            <h2 class="detail-card-title">
              {translateKey(AppStrings.Integrations.Detail.CapabilitiesSectionTitle)}
            </h2>
            <div class="detail-field">
              <span class="detail-label">
                {translateKey(AppStrings.Integrations.Detail.ActionsTab)}
              </span>
              <span class="detail-value">{actionsCount}</span>
            </div>
            <div class="detail-field">
              <span class="detail-label">
                {translateKey(AppStrings.Integrations.Detail.VariablesTab)}
              </span>
              <span class="detail-value">{variablesCount}</span>
            </div>
            {#each additionalCapabilities as capability (capability.kind)}
              <div class="detail-field">
                <span class="detail-label">
                  {resolveLocalizedText(capability.name, localizationTranslator)}
                </span>
                <span class="detail-value">
                  <span class="icon icon-check icon-xs" aria-hidden="true"></span>
                </span>
              </div>
            {/each}
          </section>

          <section class="detail-card detail-card-wide">
            <h2 class="detail-card-title">
              {translateKey(AppStrings.Integrations.Detail.ConfigurationSectionTitle)}
            </h2>
            {#if integration.supportsConfigFlow}
              {#if configEntries.length > 0}
                <div class="config-entry-list">
                  {#each configEntries as entry (entry.id)}
                    <div class="config-entry">
                      <div class="config-entry-summary">
                        <span class="config-entry-title">{entry.title}</span>
                        <span class="config-entry-status {configurationStatusClass(entry)}">
                          {configurationStatusLabel(entry)}
                        </span>
                      </div>
                      <div class="config-entry-actions">
                        <button
                          type="button"
                          class="config-entry-action"
                          onclick={() => onRenameEntry(entry)}
                        >
                          {translateKey(AppStrings.Integrations.Detail.RenameConfigEntryAction)}
                        </button>
                        <button
                          type="button"
                          class="config-entry-action config-entry-remove"
                          onclick={() => onRemoveEntry(entry)}
                        >
                          <span class="icon icon-trash icon-xs" aria-hidden="true"></span>
                          {translateKey(AppStrings.Integrations.Detail.RemoveConfigEntryAction)}
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
              {#if configurationOptional}
                <p class="detail-hint">
                  {translateKey(AppStrings.Integrations.Detail.OptionalConfigurationHint)}
                </p>
              {/if}
              {#if canSetUp}
                <Button variant="primary">
                  <span>{setUpLabel}</span>
                  <span class="icon icon-arrow-right rtl-mirror icon-xs" aria-hidden="true"></span>
                </Button>
              {/if}
              {#if !integration.allowsMultipleConfigurations && configEntries.length > 0}
                <p class="detail-hint">
                  {translateKey(AppStrings.Integrations.Detail.SingleConfigurationHint)}
                </p>
              {/if}
            {:else}
              <p class="detail-placeholder">
                {translateKey(AppStrings.Integrations.Detail.NoConfigurationOptions)}
              </p>
            {/if}
          </section>
        </div>
      {:else if activeTab === 'actions'}
        <div
          id="integration-detail-panel-actions"
          role="tabpanel"
          aria-labelledby="integration-detail-tab-actions"
          class="capability-panel"
        >
          <input
            class="capability-search"
            type="search"
            placeholder={translateKey(AppStrings.Integrations.Detail.SearchActionsPlaceholder)}
            aria-label={translateKey(AppStrings.Integrations.Detail.SearchActionsAriaLabel)}
            bind:value={actionSearch}
          />
          {#if !capabilitiesLoading && !capabilitiesError}
            <p class="capability-result-count" aria-live="polite">
              {translateKey(AppStrings.Integrations.Detail.ResultCountOf, {
                shown: filteredActions.length,
                total: declaredActions.length,
              })}
            </p>
          {/if}

          {#if capabilitiesLoading}
            <p class="capability-status">
              {translateKey(AppStrings.Integrations.Detail.LoadingActions)}
            </p>
          {:else if capabilitiesError}
            <div class="capability-error">
              <span>{capabilitiesError}</span>
              <Button
                variant="secondary"
                size="compact"
                onclick={() => {
                  capabilitiesError = null;
                }}
              >
                {translateKey(Strings.Common.Close)}
              </Button>
            </div>
          {:else if declaredActions.length === 0}
            <EmptyState
              icon="zap"
              heading={translateKey(AppStrings.Integrations.Detail.NoActionsHeading)}
              message={translateKey(AppStrings.Integrations.Detail.NoActionsMessage)}
            />
          {:else if filteredActions.length === 0}
            <EmptyState
              icon="zap"
              heading={translateKey(AppStrings.Integrations.Detail.NoMatchingActionsHeading)}
              message={translateKey(AppStrings.Integrations.Detail.NoMatchingSearchMessage)}
            />
          {:else}
            <ul class="capability-list">
              {#each filteredActions as action (action.id)}
                <ActionCapabilityRow {action} onopen={() => tryInDeveloper(action)} />
              {/each}
            </ul>
          {/if}
        </div>
      {:else if activeTab === 'variables'}
        <div
          id="integration-detail-panel-variables"
          role="tabpanel"
          aria-labelledby="integration-detail-tab-variables"
          class="capability-panel"
        >
          <input
            class="capability-search"
            type="search"
            placeholder={translateKey(AppStrings.Integrations.Detail.SearchVariablesPlaceholder)}
            aria-label={translateKey(AppStrings.Integrations.Detail.SearchVariablesAriaLabel)}
            bind:value={variableSearch}
          />
          {#if !capabilitiesLoading && !capabilitiesError}
            <p class="capability-result-count" aria-live="polite">
              {translateKey(AppStrings.Integrations.Detail.ResultCountOf, {
                shown: listedVariableCount,
                total: totalVariableCount,
              })}
            </p>
          {/if}

          {#if capabilitiesLoading}
            <p class="capability-status">
              {translateKey(AppStrings.Integrations.Detail.LoadingVariables)}
            </p>
          {:else if capabilitiesError}
            <div class="capability-error">
              <span>{capabilitiesError}</span>
              <Button
                variant="secondary"
                size="compact"
                onclick={() => {
                  capabilitiesError = null;
                }}
              >
                {translateKey(Strings.Common.Close)}
              </Button>
            </div>
          {:else if totalVariableCount === 0 && !variableSearch.trim()}
            <EmptyState
              icon="code"
              heading={translateKey(AppStrings.Integrations.Detail.NoVariablesHeading)}
              message={translateKey(AppStrings.Integrations.Detail.NoVariablesMessage)}
            />
          {:else if filteredVariables.length === 0 && filteredBoundVariables.length === 0}
            <EmptyState
              icon="code"
              heading={translateKey(AppStrings.Integrations.Detail.NoMatchingVariablesHeading)}
              message={translateKey(AppStrings.Integrations.Detail.NoMatchingSearchMessage)}
            />
          {:else}
            <ul class="variable-capability-list">
              {#each filteredVariables as variable (variable.name)}
                <li class="variable-capability-slot">
                  <VariableRow
                    primary="vars.{variable.name}"
                    type={variable.type}
                    typeLabel={typeLabels[variable.type]}
                    value={variable.valueAvailable ? (variable.value ?? '') : null}
                    dimmed={variable.availability !== 'Ready'}
                    primaryMono
                  >
                    {#snippet meta()}
                      {#if variable.isTemplate}
                        <span class="template-chip">{templateChipLabel(variable.name)}</span>
                      {/if}
                    {/snippet}
                    {#snippet side()}
                      {#if !variable.valueAvailable}
                        <span class="availability-pill availability-{variable.availability}">
                          {variable.availabilityReason}
                        </span>
                      {/if}
                    {/snippet}
                  </VariableRow>
                </li>
              {/each}
              {#each filteredBoundVariables as bound (bound.id)}
                <li class="variable-capability-slot">
                  <VariableRow
                    primary="vars.{bound.name}"
                    secondary={boundDisplayName(bound)}
                    type={bound.type}
                    typeLabel={typeLabels[bound.type]}
                    value={bound.available === false ? null : boundValue(bound)}
                    unavailable={bound.available === false ? resourceUnavailableLabel : null}
                    primaryMono
                  />
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    </div>
  </DetailPage>
{:else if !integrationStore.isLoading}
  <DetailPage
    backLabel={translateKey(AppStrings.Integrations.Detail.BackToIntegrations)}
    onclose={goBack}
  >
    {#snippet header()}
      <h1 class="detail-name">
        {translateKey(AppStrings.Integrations.Detail.IntegrationNotFound)}
      </h1>
    {/snippet}
  </DetailPage>
{/if}

{#if showDisableConfirm}
  <ConfirmDialog
    heading={translateKey(AppStrings.Integrations.Page.DisableHeading)}
    message={disableMessage}
    confirmText={translateKey(AppStrings.Integrations.Page.DisableAction)}
    cancelText={translateKey(Strings.Common.Cancel)}
    danger
    onconfirm={confirmDisable}
    oncancel={cancelDisable}
  />
{/if}

{#if pendingRemove}
  <ConfirmDialog
    heading={translateKey(AppStrings.Integrations.Detail.RemoveConfigEntryHeading)}
    message={removeConfigurationMessage}
    confirmText={translateKey(AppStrings.Integrations.Detail.RemoveConfigEntryAction)}
    cancelText={translateKey(Strings.Common.Cancel)}
    danger
    onconfirm={confirmRemoveEntry}
    oncancel={cancelRemoveEntry}
  />
{/if}

{#if configurationNameTarget}
  <Modal
    heading={translateKey(AppStrings.Integrations.Detail.RenameConfigurationHeading)}
    maxWidth="420px"
    onclose={cancelConfigurationName}
  >
    <form
      class="config-name-form"
      onsubmit={e => {
        e.preventDefault();
        void submitConfigurationName();
      }}
    >
      <label class="config-name-field">
        <span>{translateKey(AppStrings.Integrations.Detail.ConfigurationNameLabel)}</span>
        <input
          class="config-name-input"
          type="text"
          required
          placeholder={translateKey(
            AppStrings.Integrations.Detail.ConfigurationNamePlaceholder,
          )}
          bind:value={configurationName}
        />
      </label>
    </form>
    {#snippet footer()}
      <Button variant="secondary" onclick={cancelConfigurationName}>
        {translateKey(Strings.Common.Cancel)}
      </Button>
      <Button
        variant="primary"
        disabled={!configurationName.trim() || configurationMutationPending}
        loading={configurationMutationPending}
        onclick={submitConfigurationName}
      >
        {translateKey(Strings.Common.Save)}
      </Button>
    {/snippet}
  </Modal>
{/if}

<style>
  .detail-header-content {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex: 1 1 0;
    min-width: 0;
  }

  .detail-brand-icon,
  .detail-brand-glyph {
    flex-shrink: 0;
  }

  .detail-brand-icon {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    object-fit: contain;
  }

  .detail-brand-glyph {
    color: var(--color-accent);
  }

  .detail-heading {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    flex: 1 1 0;
    min-width: 0;
  }

  .detail-name {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail-version {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .kind-badge {
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    letter-spacing: 0.02em;
    text-transform: uppercase;
    background-color: var(--type-integration-bg);
    color: var(--type-integration-fg);
    flex-shrink: 0;
  }

  .status-chip {
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    flex-shrink: 0;
  }

  .status-chip-ready {
    color: var(--color-success);
    background-color: var(--color-success-muted);
  }

  .status-chip-disabled {
    color: var(--color-text-muted);
    background-color: var(--color-bg-hover);
  }

  .status-chip-starting,
  .status-chip-setup {
    color: var(--color-warning);
    background-color: var(--color-warning-muted);
  }

  .detail-tabs {
    flex-shrink: 0;
    padding: var(--space-4) var(--space-5) 0;
  }

  .detail-body {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: var(--space-5);
    scrollbar-gutter: stable;
    min-height: 0;
  }

  .detail-grid,
  .capability-panel {
    max-width: 45.5rem;
    margin: 0 auto;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .detail-card {
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-4) 1rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .detail-card-wide {
    grid-column: 1 / -1;
  }

  .detail-card-title {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    margin: 0 0 var(--space-2);
  }

  .detail-field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: 0.3125rem 0;
  }

  .detail-label {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .detail-value {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-primary);
  }

  .config-entry-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .config-entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background-color: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .config-entry-summary {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .config-entry-title {
    font-size: var(--text-sm);
    color: var(--color-text-primary);
  }

  .config-entry-status {
    padding: 0.125rem 0.375rem;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
  }

  .config-status-ok {
    color: var(--color-success);
    background-color: var(--color-success-muted);
  }

  .config-status-warning {
    color: var(--color-warning);
    background-color: var(--color-warning-muted);
  }

  .config-status-pending {
    color: var(--color-text-muted);
    background-color: var(--color-bg-hover);
  }

  .config-entry-actions {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .config-entry-action {
    background: none;
    border: none;
    font-size: var(--text-sm);
    color: var(--color-accent);
    cursor: pointer;
    padding: 0;
  }

  .config-entry-action:hover {
    text-decoration: underline;
  }

  .config-entry-remove {
    color: var(--color-danger);
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .detail-placeholder,
  .detail-hint {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .detail-placeholder {
    font-style: italic;
    margin: 0 0 var(--space-3);
  }

  .detail-hint {
    margin: var(--space-2) 0 0;
  }

  .capability-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    height: 100%;
    min-height: 0;
  }

  .capability-search {
    display: block;
    width: 100%;
    flex-shrink: 0;
    min-height: var(--control-height);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .capability-result-count {
    flex-shrink: 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    margin: 0;
  }

  .capability-status {
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    margin: var(--space-4) 0;
    text-align: center;
  }

  .capability-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3);
    background-color: var(--color-danger-muted);
    color: var(--color-danger);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .capability-list,
  .variable-capability-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: 0;
    margin: 0;
    overflow-y: auto;
    min-height: 0;
  }

  .variable-capability-slot {
    flex: 0 0 auto;
  }

  .template-chip {
    padding: 0.125rem 0.375rem;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    background-color: var(--color-bg-hover);
    color: var(--color-text-secondary);
  }

  .availability-pill {
    padding: 0.125rem 0.375rem;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    white-space: nowrap;
    border: 1px solid transparent;
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

  .config-name-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .config-name-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  .config-name-input {
    min-height: var(--control-height);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  @media (max-width: 48rem) {
    .detail-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
