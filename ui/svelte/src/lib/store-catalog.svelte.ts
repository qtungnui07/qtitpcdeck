/*
 * Reactive store for the Macro-Deck extension catalog.
 *
 * Handles browsing the registry catalog with search, filtering (kinds, categories,
 * section sorting, supported-only), and pagination.
 *
 * Keeps live synchronization with the host via WebSocket events:
 *  - StoreCatalogChangedEvent
 *  - StoreRegistryStatusChangedEvent
 *  - StoreRegistryRefreshChangedEvent
 */

import {
  AppStrings,
  type StoreCatalogChangedEvent,
  type StoreCatalogItemBody,
  type StoreCategoryBody,
  type StoreExtensionKind,
  type StoreRegistryRefreshChangedEvent,
  type StoreRegistryRefreshRunBody,
  type StoreRegistryStatusBody,
  type StoreRegistryStatusChangedEvent,
} from '@macro-deck/runtime';
import { onNotificationOf } from './api.svelte';
import { storeCatalogEndpoints, type StoreCatalogOptions } from './endpoints';
import { translateKey } from './localization.svelte';

export const STORE_CATALOG_PAGE_SIZE = 24;

let items = $state<StoreCatalogItemBody[]>([]);
let total = $state(0);
let registry = $state<StoreRegistryStatusBody | null>(null);
let categories = $state<StoreCategoryBody[]>([]);
let isLoading = $state(false);
let isLoadingMore = $state(false);
let loadError = $state<string | null>(null);
let refreshRun = $state<StoreRegistryRefreshRunBody | null>(null);

let lastQuery: StoreCatalogOptions | null = null;
let generation = 0;

let unsubscribeCatalogChanged: (() => void) | null = null;
let unsubscribeStatusChanged: (() => void) | null = null;
let unsubscribeRefreshChanged: (() => void) | null = null;

export const storeCatalogStore = {
  get items(): readonly StoreCatalogItemBody[] {
    return items;
  },
  get total(): number {
    return total;
  },
  get registry(): StoreRegistryStatusBody | null {
    return registry;
  },
  get categories(): readonly StoreCategoryBody[] {
    return categories;
  },
  get isLoading(): boolean {
    return isLoading;
  },
  get isLoadingMore(): boolean {
    return isLoadingMore;
  },
  get loadError(): string | null {
    return loadError;
  },
  get refreshRun(): StoreRegistryRefreshRunBody | null {
    return refreshRun;
  },
  get hasMore(): boolean {
    return items.length < total;
  },
  get refreshing(): boolean {
    return refreshRun?.state === 'Running' || registry?.refreshing === true;
  },
};

export async function loadCatalog(query?: StoreCatalogOptions): Promise<void> {
  const effective = query ?? lastQuery ?? {};
  const previous = lastQuery;
  lastQuery = effective;
  const currentGen = ++generation;

  isLoading = true;
  loadError = null;

  try {
    const response = await storeCatalogEndpoints.list({
      ...effective,
      skip: 0,
      take: STORE_CATALOG_PAGE_SIZE,
    });

    if (currentGen !== generation) return;

    items = response.items ?? [];
    total = response.total ?? 0;
    registry = response.registry ?? null;
  } catch (error) {
    if (currentGen === generation) {
      lastQuery = previous;
      loadError = error instanceof Error
        ? error.message
        : translateKey(AppStrings.Store.Error.RegistryUnavailable);
    }
  } finally {
    if (currentGen === generation) {
      isLoading = false;
    }
  }
}

export async function loadMoreCatalog(): Promise<void> {
  if (!lastQuery || items.length >= total || isLoadingMore || isLoading) {
    return;
  }

  const currentGen = generation;
  isLoadingMore = true;
  loadError = null;

  try {
    const response = await storeCatalogEndpoints.list({
      ...lastQuery,
      skip: items.length,
      take: STORE_CATALOG_PAGE_SIZE,
    });

    if (currentGen !== generation) return;

    const incoming = response.items ?? [];
    const seen = new Set(items.map(item => `${item.kind}:${item.id}`));
    const unique = incoming.filter(item => !seen.has(`${item.kind}:${item.id}`));

    items = [...items, ...unique];
    total = response.total ?? total;
    if (response.registry) {
      registry = response.registry;
    }
  } catch (error) {
    if (currentGen === generation) {
      loadError = error instanceof Error ? error.message : String(error);
    }
  } finally {
    if (currentGen === generation) {
      isLoadingMore = false;
    }
  }
}

export async function reloadCatalog(): Promise<void> {
  if (!lastQuery) {
    await loadCatalog({ section: 'popular' });
    return;
  }
  await loadCatalog(lastQuery);
}

export async function loadCategories(kinds?: StoreExtensionKind[], supportedOnly?: boolean): Promise<void> {
  try {
    const response = await storeCatalogEndpoints.categories(kinds, supportedOnly);
    categories = response.categories ?? [];
  } catch (error) {
    console.error('Failed to load store categories:', error);
  }
}

export async function refreshStoreRegistry(): Promise<boolean> {
  try {
    const response = await storeCatalogEndpoints.refreshRegistry();
    if (response.registry) {
      registry = response.registry;
    }
    return response.success ?? false;
  } catch (error) {
    console.error('Failed to trigger store registry refresh:', error);
    return false;
  }
}

export function applyCatalogBatch(
  newItems: StoreCatalogItemBody[],
  newTotal?: number,
  newRegistry?: StoreRegistryStatusBody | null,
): void {
  items = [...newItems];
  total = newTotal ?? newItems.length;
  if (newRegistry !== undefined) {
    registry = newRegistry;
  }
}

export function startStoreCatalog(): void {
  stopStoreCatalog();

  unsubscribeCatalogChanged = onNotificationOf<StoreCatalogChangedEvent>(
    'StoreCatalogChangedEvent',
    () => {
      void reloadCatalog();
    },
  );

  unsubscribeStatusChanged = onNotificationOf<StoreRegistryStatusChangedEvent>(
    'StoreRegistryStatusChangedEvent',
    event => {
      if (event?.registry) {
        registry = event.registry;
      }
    },
  );

  unsubscribeRefreshChanged = onNotificationOf<StoreRegistryRefreshChangedEvent>(
    'StoreRegistryRefreshChangedEvent',
    event => {
      if (event?.run) {
        refreshRun = event.run;
      }
    },
  );
}

export function stopStoreCatalog(): void {
  unsubscribeCatalogChanged?.();
  unsubscribeCatalogChanged = null;

  unsubscribeStatusChanged?.();
  unsubscribeStatusChanged = null;

  unsubscribeRefreshChanged?.();
  unsubscribeRefreshChanged = null;
}

export function resetStoreCatalog(): void {
  stopStoreCatalog();
  items = [];
  total = 0;
  registry = null;
  categories = [];
  isLoading = false;
  isLoadingMore = false;
  loadError = null;
  refreshRun = null;
  lastQuery = null;
  generation = 0;
}
