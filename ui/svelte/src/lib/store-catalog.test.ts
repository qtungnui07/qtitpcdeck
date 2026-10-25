import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storeCatalogEndpoints } from './endpoints';
import {
  loadCategories,
  loadMoreCatalog,
  reloadCatalog,
  resetStoreCatalog,
  storeCatalogStore,
} from './store-catalog.svelte';
import type {
  StoreCatalogItemBody,
  StoreCategoryBody,
  StoreRegistryStatusBody,
} from '@macro-deck/runtime';

vi.mock('./endpoints', () => ({
  storeCatalogEndpoints: {
    list: vi.fn(),
    categories: vi.fn(),
    refreshRegistry: vi.fn(),
  },
}));

const mockRegistry: StoreRegistryStatusBody = {
  hasCatalog: true,
  sequence: 1,
  refreshing: false,
  stale: false,
};

const mockItems: StoreCatalogItemBody[] = [
  {
    id: 'com.macrodeck.obs',
    kind: 'Plugin',
    name: 'OBS Studio Integration',
    publisher: 'Macro Deck Team',
    latestVersion: '1.2.0',
    description: 'Control scenes and streams',
    trust: 'PublisherVerified',
    installState: 'Installed',
    installedVersion: '1.2.0',
    hasIcon: false,
  },
  {
    id: 'com.macrodeck.material',
    kind: 'IconPack',
    name: 'Material Icons',
    publisher: 'Community',
    latestVersion: '2.0.0',
    description: 'Clean modern icons',
    trust: 'RegistryAuthenticated',
    installState: 'NotInstalled',
    hasIcon: false,
  },
];

describe('storeCatalogStore', () => {
  beforeEach(() => {
    resetStoreCatalog();
    vi.clearAllMocks();
  });

  it('loads catalog items and tracks pagination state', async () => {
    vi.mocked(storeCatalogEndpoints.list).mockResolvedValueOnce({
      items: mockItems,
      total: 2,
      registry: mockRegistry,
    });

    await reloadCatalog();

    expect(storeCatalogStore.items).toHaveLength(2);
    expect(storeCatalogStore.items[0].name).toBe('OBS Studio Integration');
    expect(storeCatalogStore.hasMore).toBe(false);
    expect(storeCatalogStore.isLoading).toBe(false);
  });

  it('appends items on loadMore', async () => {
    vi.mocked(storeCatalogEndpoints.list)
      .mockResolvedValueOnce({
        items: [mockItems[0]],
        total: 2,
        registry: mockRegistry,
      })
      .mockResolvedValueOnce({
        items: [mockItems[1]],
        total: 2,
        registry: mockRegistry,
      });

    await reloadCatalog();
    expect(storeCatalogStore.items).toHaveLength(1);
    expect(storeCatalogStore.hasMore).toBe(true);

    await loadMoreCatalog();
    expect(storeCatalogStore.items).toHaveLength(2);
    expect(storeCatalogStore.hasMore).toBe(false);
  });

  it('loads categories', async () => {
    const mockCategories: StoreCategoryBody[] = [
      { id: 'Streaming', names: { en: 'Streaming' }, count: 5 },
      { id: 'Productivity', names: { en: 'Productivity' }, count: 3 },
    ];
    vi.mocked(storeCatalogEndpoints.categories).mockResolvedValueOnce({
      categories: mockCategories,
    });

    await loadCategories();
    expect(storeCatalogStore.categories).toEqual(mockCategories);
  });

  it('handles catalog load failure', async () => {
    vi.mocked(storeCatalogEndpoints.list).mockRejectedValueOnce(new Error('Network offline'));

    await reloadCatalog();
    expect(storeCatalogStore.loadError).toBe('Network offline');
    expect(storeCatalogStore.items).toHaveLength(0);
    expect(storeCatalogStore.isLoading).toBe(false);
  });
});
