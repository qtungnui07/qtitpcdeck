/*
 * Tests for the variable catalog.
 *
 * The catalog is a lazily fetched tree, so the rules worth pinning down are about caching and
 * invalidation: a page is fetched once, a bind invalidates only its own integration, and the
 * unbound count falls back to counting seen leaves when the provider does not report one.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bindCatalogVariable,
  catalogPage,
  invalidateCatalogIntegration,
  isCatalogPageLoaded,
  loadCatalogPage,
  loadCatalogProviders,
  loadMoreCatalogPage,
  reloadCatalogPage,
  resetVariableCatalog,
  resolveBoundVariable,
  unbindCatalogVariable,
  unboundCountFor,
  variableCatalog,
} from './variable-catalog.svelte';

let providersResponse: unknown = { providers: [] };
let discoverResponse: unknown = null;
let bindResponse: unknown = { success: true, variable: { id: 'v1' } };
let unbindResponse: unknown = { success: true };
let discoverCalls: Array<Record<string, unknown>> = [];

function stubFetch(): void {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init?.method ?? 'GET';

    if (url.pathname === '/api/variables/catalog/bind') {
      return new Response(JSON.stringify(bindResponse), { status: 200 });
    }

    if (url.pathname.startsWith('/api/variables/catalog/') && method === 'DELETE') {
      return new Response(JSON.stringify(unbindResponse), { status: 200 });
    }

    return new Response('', { status: 404 });
  });
}

/*
 * Discovery and provider loading go over the socket, not HTTP, so they are stubbed at the module
 * boundary rather than through fetch.
 */
vi.mock('./endpoints', async () => {
  const actual = await vi.importActual<typeof import('./endpoints')>('./endpoints');
  return {
    ...actual,
    variableCatalogEndpoints: {
      providers: async () => providersResponse as never,
      discover: async (request: Record<string, unknown>) => {
        discoverCalls.push(request);
        return discoverResponse as never;
      },
      resolve: async () => null,
      bind: actual.variableCatalogEndpoints.bind,
      unbind: actual.variableCatalogEndpoints.unbind,
      rename: async () => ({ success: true }) as never,
    },
  };
});

beforeEach(() => {
  providersResponse = { providers: [] };
  discoverResponse = null;
  bindResponse = { success: true, variable: { id: 'v1' } };
  unbindResponse = { success: true };
  discoverCalls = [];
  stubFetch();
});

afterEach(() => {
  resetVariableCatalog();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('providers', () => {
  it('starts with none', () => {
    expect(variableCatalog.providers).toEqual([]);
  });

  it('loads them', async () => {
    providersResponse = { providers: [{ integrationId: 'i1', name: 'Plugin' }] };
    await loadCatalogProviders();

    expect(variableCatalog.providers).toHaveLength(1);
  });

  it('treats a null response as no providers', async () => {
    providersResponse = null;
    await loadCatalogProviders();

    expect(variableCatalog.providers).toEqual([]);
  });

  it('shares one request between concurrent loads', async () => {
    providersResponse = { providers: [] };
    await Promise.all([loadCatalogProviders(), loadCatalogProviders()]);

    expect(variableCatalog.providers).toEqual([]);
  });
});

describe('pages', () => {
  it('returns an empty page before loading', () => {
    expect(catalogPage('i1', undefined, undefined).nodes).toEqual([]);
    expect(isCatalogPageLoaded('i1', undefined, undefined)).toBe(false);
  });

  it('loads a page', async () => {
    discoverResponse = { nodes: [{ id: 'n1', name: 'Node' }], hasMore: false, available: true };
    await loadCatalogPage('i1', undefined, undefined);

    expect(catalogPage('i1', undefined, undefined).nodes).toHaveLength(1);
    expect(isCatalogPageLoaded('i1', undefined, undefined)).toBe(true);
  });

  it('fetches a page only once', async () => {
    discoverResponse = { nodes: [], hasMore: false, available: true };

    await loadCatalogPage('i1', undefined, undefined);
    await loadCatalogPage('i1', undefined, undefined);

    expect(discoverCalls).toHaveLength(1);
  });

  it('keys pages by parent and search', async () => {
    discoverResponse = { nodes: [], hasMore: false, available: true };

    await loadCatalogPage('i1', undefined, undefined);
    await loadCatalogPage('i1', 'parent', undefined);
    await loadCatalogPage('i1', undefined, 'term');

    expect(discoverCalls).toHaveLength(3);
  });

  it('treats a null response as unavailable', async () => {
    discoverResponse = null;
    await loadCatalogPage('i1', undefined, undefined);

    expect(catalogPage('i1', undefined, undefined).available).toBe(false);
  });

  it('records a failure as unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const endpoints = await import('./endpoints');
    vi.spyOn(endpoints.variableCatalogEndpoints, 'discover').mockRejectedValueOnce(new Error('boom'));

    await loadCatalogPage('i1', undefined, undefined);
    expect(catalogPage('i1', undefined, undefined).available).toBe(false);
  });

  it('reloads a page that was already loaded', async () => {
    discoverResponse = { nodes: [], hasMore: false, available: true };
    await loadCatalogPage('i1', undefined, undefined);

    await reloadCatalogPage('i1', undefined, undefined);
    expect(discoverCalls).toHaveLength(2);
  });

  it('appends the next page', async () => {
    discoverResponse = {
      nodes: [{ id: 'n1' }],
      nextCursor: 'c1',
      hasMore: true,
      available: true,
    };
    await loadCatalogPage('i1', undefined, undefined);

    discoverResponse = { nodes: [{ id: 'n2' }], hasMore: false, available: true };
    await loadMoreCatalogPage('i1', undefined, undefined);

    expect(catalogPage('i1', undefined, undefined).nodes.map(n => n.id)).toEqual(['n1', 'n2']);
    expect(discoverCalls[1].cursor).toBe('c1');
  });

  it('does not load more when there is no more', async () => {
    discoverResponse = { nodes: [], hasMore: false, available: true };
    await loadCatalogPage('i1', undefined, undefined);

    await loadMoreCatalogPage('i1', undefined, undefined);
    expect(discoverCalls).toHaveLength(1);
  });
});

describe('invalidation', () => {
  it('drops only the pages of one integration', async () => {
    discoverResponse = { nodes: [], hasMore: false, available: true };
    await loadCatalogPage('i1', undefined, undefined);
    await loadCatalogPage('i2', undefined, undefined);

    invalidateCatalogIntegration('i1');

    expect(isCatalogPageLoaded('i1', undefined, undefined)).toBe(false);
    expect(isCatalogPageLoaded('i2', undefined, undefined)).toBe(true);
  });

  it('bumps the revision so consumers re-read', async () => {
    discoverResponse = { nodes: [], hasMore: false, available: true };
    await loadCatalogPage('i1', undefined, undefined);

    const before = variableCatalog.revision;
    invalidateCatalogIntegration('i1');

    expect(variableCatalog.revision).toBeGreaterThan(before);
  });

  it('invalidates the integration a bind touched', async () => {
    discoverResponse = { nodes: [], hasMore: false, available: true };
    await loadCatalogPage('i1', undefined, undefined);

    await bindCatalogVariable({ integrationId: 'i1', resourceId: 'r1' } as never);
    expect(isCatalogPageLoaded('i1', undefined, undefined)).toBe(false);
  });

  it('leaves the pages alone when a bind fails', async () => {
    discoverResponse = { nodes: [], hasMore: false, available: true };
    await loadCatalogPage('i1', undefined, undefined);

    bindResponse = { success: false };
    await bindCatalogVariable({ integrationId: 'i1', resourceId: 'r1' } as never);

    expect(isCatalogPageLoaded('i1', undefined, undefined)).toBe(true);
  });

  it('invalidates the integration an unbind touched', async () => {
    discoverResponse = { nodes: [], hasMore: false, available: true };
    await loadCatalogPage('i1', undefined, undefined);

    await unbindCatalogVariable('i1', 'v1');
    expect(isCatalogPageLoaded('i1', undefined, undefined)).toBe(false);
  });

  it('leaves the pages alone when an unbind fails', async () => {
    discoverResponse = { nodes: [], hasMore: false, available: true };
    await loadCatalogPage('i1', undefined, undefined);

    unbindResponse = { success: false };
    await unbindCatalogVariable('i1', 'v1');

    expect(isCatalogPageLoaded('i1', undefined, undefined)).toBe(true);
  });
});

describe('unbound count', () => {
  it('uses the count the provider reports', async () => {
    providersResponse = { providers: [{ integrationId: 'i1', unboundCount: 7 }] };
    await loadCatalogProviders();

    expect(unboundCountFor('i1')).toBe(7);
  });

  it('reports null when the provider supports search but no count', async () => {
    providersResponse = { providers: [{ integrationId: 'i1', supportsSearch: true }] };
    await loadCatalogProviders();

    expect(unboundCountFor('i1')).toBeNull();
  });

  it('counts seen unbound leaves when the provider reports nothing', async () => {
    providersResponse = { providers: [{ integrationId: 'i1' }] };
    await loadCatalogProviders();

    discoverResponse = {
      nodes: [
        { id: 'a', type: 'string' },
        { id: 'b', type: 'string', boundVariableId: 'v1' },
        { id: 'c', type: 'string' },
      ],
      hasMore: false,
      available: true,
    };
    await loadCatalogPage('i1', undefined, undefined);

    expect(unboundCountFor('i1')).toBe(2);
  });

  it('ignores branch nodes when counting leaves', async () => {
    providersResponse = { providers: [{ integrationId: 'i1' }] };
    await loadCatalogProviders();

    discoverResponse = {
      nodes: [{ id: 'branch', hasChildren: true }],
      hasMore: false,
      available: true,
    };
    await loadCatalogPage('i1', undefined, undefined);

    expect(unboundCountFor('i1')).toBe(0);
  });

  it('reports zero for an integration it has never seen', () => {
    expect(unboundCountFor('unknown')).toBe(0);
  });
});

describe('bound variable lookup', () => {
  it('finds the bound variable', () => {
    const node = { id: 'n1', boundVariableId: 'v1' } as never;
    const variables = [{ id: 'v1', name: 'counter' }] as never;

    expect(resolveBoundVariable(node, variables)?.name).toBe('counter');
  });

  it('returns null for an unbound node', () => {
    expect(resolveBoundVariable({ id: 'n1' } as never, [])).toBeNull();
  });

  it('returns null when the variable is gone', () => {
    const node = { id: 'n1', boundVariableId: 'missing' } as never;
    expect(resolveBoundVariable(node, [])).toBeNull();
  });
});
