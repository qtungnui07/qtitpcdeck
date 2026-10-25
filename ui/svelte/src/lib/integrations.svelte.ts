/*
 * The integration list.
 *
 * Two ordering rules matter here and both are easy to get wrong.
 *
 * 1. The latest started fetch wins. A slow first request must not overwrite the list a faster
 *    second one already delivered, so each fetch carries a sequence number and drops its result if
 *    a newer fetch has started.
 *
 * 2. An issue event that arrives mid-fetch is newer than whatever that fetch read, so it is
 *    recorded and re-applied on top of the response. Without it, a plugin that reports a problem
 *    while the list is loading shows as healthy until the next refresh.
 */

import type {
  ConfigEntryDto,
  DeleteConfigEntryResponse,
  GetConfigEntriesResponse,
  GetIntegrationCapabilitiesResponse,
  GetIntegrationIssuesResponse,
  IntegrationIssueSeverity,
  IntegrationIssuesChangedEvent,
  IntegrationsChangedEvent,
  IpcIntegration,
  IpcProvidedCapability,
  RenameConfigEntryResponse,
  ResolveIntegrationIssueResponse,
} from '@macro-deck/runtime';
import { resolveLocalizedText } from '@macro-deck/runtime';
import { onNotificationOf } from './api.svelte';
import { integrationEndpoints } from './endpoints';
import { localizationTranslator } from './localization.svelte';

export type { ConfigEntryDto };

export interface Integration {
  id: string;
  name: string;
  version: string;
  isInternal: boolean;
  enabled: boolean;
  actionCount: number;
  variableCount: number;
  supportsConfigFlow: boolean;
  allowsMultipleConfigurations: boolean;
  requiresConfiguration: boolean;
  configuredEntryCount: number;
  hasIcon: boolean;
  iconVersion: string | null;
  issueCount: number;
  issueSeverity: IntegrationIssueSeverity | null;
  isInitialized: boolean;
  variablesDependOnConfiguration: boolean;
  providedCapabilities: IpcProvidedCapability[];
}

let integrations = $state<Integration[]>([]);
let isLoading = $state(false);
let loadError = $state<string | null>(null);
let selectedIntegrationId = $state<string | null>(null);

let fetchSequence = 0;
let fetchesInFlight = 0;
let refreshRunning = false;
let refreshQueued = false;
const issuesDuringFetch = new Map<string, IntegrationIssuesChangedEvent>();

let unsubscribeIssues: (() => void) | null = null;
let unsubscribeChanged: (() => void) | null = null;

export const integrationStore = {
  get integrations() {
    return integrations;
  },
  get isLoading() {
    return isLoading;
  },
  get loadError() {
    return loadError;
  },
  get selectedIntegrationId() {
    return selectedIntegrationId;
  },
  get selectedIntegration() {
    if (!selectedIntegrationId) return null;
    return integrations.find(i => i.id === selectedIntegrationId) ?? null;
  },
  get enabledCount() {
    return integrations.filter(i => i.enabled).length;
  },
};

export function selectIntegration(id: string | null): void {
  selectedIntegrationId = id;
}

export async function loadIntegrations(): Promise<void> {
  isLoading = true;
  loadError = null;

  try {
    await fetchIntegrations();
  } catch (error) {
    console.error('Failed to load integrations:', error);
    loadError = 'Failed to load integrations';
  } finally {
    isLoading = false;
  }
}

async function fetchIntegrations(): Promise<void> {
  const sequence = ++fetchSequence;
  fetchesInFlight += 1;

  try {
    const response = await integrationEndpoints.list();
    if (sequence !== fetchSequence) return;

    integrations = (response.integrations ?? []).map(mapIntegration);

    for (const event of issuesDuringFetch.values()) {
      applyIssues(event);
    }
    issuesDuringFetch.clear();
  } catch (error) {
    if (sequence === fetchSequence) throw error;
  } finally {
    fetchesInFlight -= 1;
    if (fetchesInFlight === 0) {
      issuesDuringFetch.clear();
    }
  }
}

async function requestRefresh(): Promise<void> {
  if (refreshRunning) {
    refreshQueued = true;
    return;
  }

  refreshRunning = true;
  try {
    do {
      refreshQueued = false;
      await fetchIntegrations().catch(error =>
        console.error('Failed to refresh integrations:', error),
      );
    } while (refreshQueued);
  } finally {
    refreshRunning = false;
  }
}

function applyIssues(event: IntegrationIssuesChangedEvent): void {
  integrations = integrations.map(i =>
    i.id === event.integrationId
      ? { ...i, issueCount: event.issueCount, issueSeverity: event.severity }
      : i,
  );
}

/*
 * Optimistic, then reverted on failure. A toggle that waited for the host would leave the switch
 * sitting in its old position for as long as the plugin takes to start, which reads as a dead
 * control.
 */
export async function toggleIntegration(id: string): Promise<void> {
  const integration = integrations.find(i => i.id === id);
  if (!integration) return;

  const nextEnabled = !integration.enabled;
  setEnabledLocally(id, nextEnabled);

  try {
    const response = await integrationEndpoints.setEnabled({ id, enabled: nextEnabled });
    if (!response.success) {
      setEnabledLocally(id, !nextEnabled);
      console.error('Failed to toggle integration:', response.error?.message);
    }
  } catch (error) {
    setEnabledLocally(id, !nextEnabled);
    console.error('Failed to toggle integration:', error);
  }
}

function setEnabledLocally(id: string, enabled: boolean): void {
  integrations = integrations.map(i => (i.id === id ? { ...i, enabled } : i));
}

export async function refreshConfigEntries(id: string): Promise<void> {
  try {
    const response = await integrationEndpoints.configEntries(id);
    integrations = integrations.map(i =>
      i.id === id ? { ...i, configuredEntryCount: response.entries.length } : i,
    );
  } catch (error) {
    console.error('Failed to refresh config entries:', error);
  }
}

function mapIntegration(integration: IpcIntegration): Integration {
  return {
    id: integration.id,
    name: resolveLocalizedText(integration.name, localizationTranslator),
    version: integration.version,
    isInternal: integration.isInternal ?? true,
    enabled: integration.enabled,
    actionCount: integration.actionCount ?? 0,
    variableCount: integration.variableCount ?? 0,
    supportsConfigFlow: integration.supportsConfigFlow ?? false,
    allowsMultipleConfigurations: integration.allowsMultipleConfigurations ?? true,
    requiresConfiguration: integration.requiresConfiguration ?? true,
    configuredEntryCount: integration.configuredEntryCount ?? 0,
    hasIcon: integration.hasIcon ?? false,
    iconVersion: integration.iconVersion ?? null,
    issueCount: integration.issueCount ?? 0,
    issueSeverity: integration.issueSeverity ?? null,
    isInitialized: integration.isInitialized ?? false,
    variablesDependOnConfiguration: integration.variablesDependOnConfiguration ?? false,
    providedCapabilities: integration.providedCapabilities ?? [],
  };
}

export function applyIntegrationBatch(items: IpcIntegration[]): void {
  integrations = items.map(mapIntegration);
}

export function startIntegrations(): void {
  stopIntegrations();

  unsubscribeIssues = onNotificationOf<IntegrationIssuesChangedEvent>(
    'IntegrationIssuesChangedEvent',
    event => {
      if (fetchesInFlight > 0) {
        issuesDuringFetch.set(event.integrationId, event);
      }
      applyIssues(event);
    },
  );

  unsubscribeChanged = onNotificationOf<IntegrationsChangedEvent>(
    'IntegrationsChangedEvent',
    () => {
      void requestRefresh();
    },
  );
}

export function stopIntegrations(): void {
  unsubscribeIssues?.();
  unsubscribeIssues = null;
  unsubscribeChanged?.();
  unsubscribeChanged = null;
}

export function resetIntegrations(): void {
  stopIntegrations();
  integrations = [];
  isLoading = false;
  loadError = null;
  selectedIntegrationId = null;
  fetchSequence = 0;
  fetchesInFlight = 0;
  refreshRunning = false;
  refreshQueued = false;
  issuesDuringFetch.clear();
}

export function integrationIconUrl(
  id: string,
  iconVersion?: string | null,
): string {
  return integrationEndpoints.iconUrl(id, iconVersion ?? undefined);
}

export async function fetchIntegrationCapabilities(
  id: string,
): Promise<GetIntegrationCapabilitiesResponse> {
  return integrationEndpoints.capabilities(id);
}

export async function fetchIntegrationIssues(
  id: string,
): Promise<GetIntegrationIssuesResponse> {
  return integrationEndpoints.issues(id);
}

export async function resolveIntegrationIssue(
  id: string,
  issueId: string,
): Promise<ResolveIntegrationIssueResponse> {
  return integrationEndpoints.resolveIssue(id, issueId);
}

export async function renameIntegrationConfigEntry(
  id: string,
  entryId: string,
  title: string,
): Promise<RenameConfigEntryResponse> {
  return integrationEndpoints.renameConfigEntry(id, entryId, title);
}

export async function deleteIntegrationConfigEntry(
  id: string,
  entryId: string,
  confirmed = false,
): Promise<DeleteConfigEntryResponse> {
  return integrationEndpoints.deleteConfigEntry(id, entryId, confirmed);
}

export async function fetchIntegrationConfigEntries(
  id: string,
): Promise<GetConfigEntriesResponse> {
  return integrationEndpoints.configEntries(id);
}
