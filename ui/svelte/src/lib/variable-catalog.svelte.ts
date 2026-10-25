/*
 * The variable catalog.
 *
 * A catalog is a tree a plugin exposes lazily: each page is fetched on demand, keyed by
 * integration, parent node and search term. Three things here are worth knowing.
 *
 * 1. Pages are cached per key and never re-fetched unless invalidated. A tree the user browses
 *    back and forth must not re-query the plugin on every step.
 *
 * 2. A bind or unbind changes the unbound count the provider list carries, so a provider load that
 *    was already in flight may predate the change. It is repeated once rather than trusted.
 *
 * 3. When a provider does not report an unbound count and does not support search, the count is
 *    derived from the leaves seen so far. That is an estimate, and it is why the count is nullable.
 */

import type {
  BindCatalogVariableRequest,
  BindCatalogVariableResponse,
  RenameCatalogVariableRequest,
  RenameCatalogVariableResponse,
  ResolveCatalogVariableResponse,
  UnbindCatalogVariableResponse,
  Variable,
  VariableCatalogNode,
  VariableCatalogProvider,
  VariablesChangedEvent,
} from '@macro-deck/runtime';
import { onNotificationOf } from './api.svelte';
import { variableCatalogEndpoints } from './endpoints';

export interface VariableCatalogPage {
  nodes: VariableCatalogNode[];
  nextCursor?: string;
  hasMore: boolean;
  available: boolean;
}

const EMPTY_PAGE: VariableCatalogPage = { nodes: [], hasMore: false, available: true };

let providers = $state<VariableCatalogProvider[]>([]);
let revision = $state(0);

let loadedProviders = false;
let loadingProviders: Promise<void> | null = null;
let providersStale = false;

const pages = new Map<string, VariableCatalogPage>();
const loadedKeys = new Set<string>();
const loadingKeys = new Set<string>();
const boundVariables = new Map<string, string>();
let seenLeaves = new Map<string, Map<string, boolean>>();

let unsubscribeChanged: (() => void) | null = null;

export const variableCatalog = {
  get providers() {
    return providers;
  },
  get revision() {
    return revision;
  },
};

export function catalogPage(
  integrationId: string,
  parentId: string | undefined,
  search: string | undefined,
): VariableCatalogPage {
  return pages.get(catalogKey(integrationId, parentId, search)) ?? EMPTY_PAGE;
}

export function isCatalogPageLoaded(
  integrationId: string,
  parentId: string | undefined,
  search: string | undefined,
): boolean {
  return loadedKeys.has(catalogKey(integrationId, parentId, search));
}

export async function loadCatalogProviders(): Promise<void> {
  if (loadingProviders) return loadingProviders;

  loadingProviders = runLoadProviders().finally(() => {
    loadingProviders = null;
  });
  return loadingProviders;
}

async function runLoadProviders(): Promise<void> {
  try {
    do {
      providersStale = false;
      const response = await variableCatalogEndpoints.providers();
      providers = response?.providers ?? [];
      loadedProviders = true;
    } while (providersStale);
  } catch (error) {
    console.error('Failed to load variable catalog providers:', error);
  }
}

function refreshProviders(): void {
  if (loadingProviders) {
    providersStale = true;
  } else if (loadedProviders) {
    void loadCatalogProviders();
  }
}

export function unboundCountFor(integrationId: string): number | null {
  const provider = providers.find(p => p.integrationId === integrationId);
  const reported = provider?.unboundCount;

  if (reported !== undefined && reported !== null) return reported;
  if (provider?.supportsSearch) return null;

  let unbound = 0;
  for (const bound of (seenLeaves.get(integrationId) ?? new Map()).values()) {
    if (!bound) unbound += 1;
  }
  return unbound;
}

export async function loadCatalogPage(
  integrationId: string,
  parentId: string | undefined,
  search: string | undefined,
): Promise<void> {
  const key = catalogKey(integrationId, parentId, search);
  if (loadingKeys.has(key) || loadedKeys.has(key)) return;

  loadingKeys.add(key);
  try {
    const response = await variableCatalogEndpoints.discover({
      integrationId,
      parentId,
      search: search || undefined,
    });

    pages.set(
      key,
      response
        ? {
            nodes: response.nodes,
            nextCursor: response.nextCursor,
            hasMore: response.hasMore,
            available: response.available,
          }
        : { nodes: [], hasMore: false, available: false },
    );

    recordLeaves(integrationId, response?.nodes ?? []);
    loadedKeys.add(key);
    revision += 1;
  } catch (error) {
    console.error(`Failed to discover catalog variables for ${integrationId}:`, error);
    pages.set(key, { nodes: [], hasMore: false, available: false });
    loadedKeys.add(key);
    revision += 1;
  } finally {
    loadingKeys.delete(key);
  }
}

export async function reloadCatalogPage(
  integrationId: string,
  parentId: string | undefined,
  search: string | undefined,
): Promise<void> {
  const key = catalogKey(integrationId, parentId, search);
  loadedKeys.delete(key);
  await loadCatalogPage(integrationId, parentId, search);
}

export async function loadMoreCatalogPage(
  integrationId: string,
  parentId: string | undefined,
  search: string | undefined,
): Promise<void> {
  const key = catalogKey(integrationId, parentId, search);
  const current = pages.get(key) ?? EMPTY_PAGE;

  if (!current.hasMore || loadingKeys.has(key)) return;

  loadingKeys.add(key);
  try {
    const response = await variableCatalogEndpoints.discover({
      integrationId,
      parentId,
      search: search || undefined,
      cursor: current.nextCursor,
    });
    if (!response) return;

    pages.set(key, {
      nodes: [...current.nodes, ...response.nodes],
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
      available: response.available,
    });
    revision += 1;
  } catch (error) {
    console.error(`Failed to load more catalog variables for ${integrationId}:`, error);
  } finally {
    loadingKeys.delete(key);
  }
}

export async function resolveCatalogVariable(
  integrationId: string,
  resourceId: string,
): Promise<ResolveCatalogVariableResponse | null> {
  return variableCatalogEndpoints.resolve({ integrationId, resourceId });
}

export async function bindCatalogVariable(
  request: BindCatalogVariableRequest,
): Promise<BindCatalogVariableResponse> {
  const response = await variableCatalogEndpoints.bind(request);
  if (response.variable) {
    invalidateCatalogIntegration(request.integrationId);
  }
  return response;
}

export async function unbindCatalogVariable(
  integrationId: string,
  variableId: string,
): Promise<UnbindCatalogVariableResponse> {
  const response = await variableCatalogEndpoints.unbind(variableId);
  if (response.success) {
    invalidateCatalogIntegration(integrationId);
  }
  return response;
}

export async function renameCatalogVariable(
  request: RenameCatalogVariableRequest,
): Promise<RenameCatalogVariableResponse> {
  return variableCatalogEndpoints.rename(request);
}

export function invalidateCatalogIntegration(integrationId: string): void {
  const prefix = `${integrationId}::`;

  for (const key of [...pages.keys()]) {
    if (!key.startsWith(prefix)) continue;
    pages.delete(key);
    loadedKeys.delete(key);
    loadingKeys.delete(key);
  }

  revision += 1;
  refreshProviders();
}

function recordLeaves(integrationId: string, nodes: readonly VariableCatalogNode[]): void {
  const forIntegration = new Map(seenLeaves.get(integrationId) ?? new Map());
  let changed = false;

  for (const node of nodes) {
    if (node.hasChildren || !node.type) continue;

    const bound = node.boundVariableId !== undefined && node.boundVariableId !== null;
    if (forIntegration.get(node.id) !== bound) {
      forIntegration.set(node.id, bound);
      changed = true;
    }
  }

  if (changed) {
    seenLeaves = new Map(seenLeaves).set(integrationId, forIntegration);
  }
}

function catalogKey(
  integrationId: string,
  parentId: string | undefined,
  search: string | undefined,
): string {
  return `${integrationId}::${parentId ?? ''}::${(search ?? '').trim()}`;
}

export function resolveBoundVariable(
  node: VariableCatalogNode,
  variables: Variable[],
): Variable | null {
  if (!node.boundVariableId) return null;
  return variables.find(v => v.id === node.boundVariableId) ?? null;
}

export function startVariableCatalog(): void {
  stopVariableCatalog();

  unsubscribeChanged = onNotificationOf<VariablesChangedEvent>('VariablesChangedEvent', event => {
    const integrationIds = new Set<string>();

    for (const variable of event.upserted ?? []) {
      if (
        variable.dynamicResourceId &&
        variable.ownerIntegrationId &&
        !boundVariables.has(variable.id)
      ) {
        boundVariables.set(variable.id, variable.ownerIntegrationId);
        integrationIds.add(variable.ownerIntegrationId);
      }
    }

    for (const id of event.deletedIds ?? []) {
      const integrationId = boundVariables.get(id);
      if (integrationId) {
        boundVariables.delete(id);
        integrationIds.add(integrationId);
      }
    }

    for (const integrationId of integrationIds) {
      invalidateCatalogIntegration(integrationId);
    }
  });
}

export function stopVariableCatalog(): void {
  unsubscribeChanged?.();
  unsubscribeChanged = null;
}

export function resetVariableCatalog(): void {
  stopVariableCatalog();
  providers = [];
  revision = 0;
  loadedProviders = false;
  loadingProviders = null;
  providersStale = false;
  pages.clear();
  loadedKeys.clear();
  loadingKeys.clear();
  boundVariables.clear();
  seenLeaves = new Map();
}
