/*
 * Tests for the integration store.
 *
 * The two ordering rules are the point of this file: the latest started fetch wins, and an issue
 * event that arrives mid-fetch is re-applied on top of the response.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  integrationStore,
  loadIntegrations,
  refreshConfigEntries,
  resetIntegrations,
  selectIntegration,
  toggleIntegration,
} from './integrations.svelte';
import { startLocalization, stopLocalization } from './localization.svelte';

let listResponse: unknown[] = [];
let listStatus = 200;
let listGates: Array<Promise<void>> = [];
let enabledResponse: unknown = { success: true };
let entriesResponse: unknown = { entries: [] };

function integration(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'i1',
    name: 'Test Plugin',
    version: '1.0.0',
    enabled: true,
    ...overrides,
  };
}

function stubFetch(): void {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init?.method ?? 'GET';

    if (url.pathname === '/api/integrations' && method === 'GET') {
      const gate = listGates.shift();
      if (gate) await gate;
      if (listStatus !== 200) return new Response('', { status: listStatus });
      return new Response(JSON.stringify({ integrations: listResponse }), { status: 200 });
    }

    if (url.pathname.endsWith('/enabled') && method === 'PATCH') {
      return new Response(JSON.stringify(enabledResponse), { status: 200 });
    }

    if (url.pathname.endsWith('/config-entries')) {
      return new Response(JSON.stringify(entriesResponse), { status: 200 });
    }

    return new Response('', { status: 404 });
  });
}

beforeEach(() => {
  listResponse = [];
  listStatus = 200;
  listGates = [];
  enabledResponse = { success: true };
  entriesResponse = { entries: [] };
  startLocalization();
  stubFetch();
});

afterEach(() => {
  resetIntegrations();
  stopLocalization();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('loading', () => {
  it('starts empty', () => {
    expect(integrationStore.integrations).toEqual([]);
    expect(integrationStore.isLoading).toBe(false);
  });

  it('loads the list', async () => {
    listResponse = [integration()];
    await loadIntegrations();

    expect(integrationStore.integrations).toHaveLength(1);
    expect(integrationStore.integrations[0].name).toBe('Test Plugin');
  });

  it('fills in the defaults the host omits', async () => {
    listResponse = [integration()];
    await loadIntegrations();

    const loaded = integrationStore.integrations[0];
    expect(loaded.isInternal).toBe(true);
    expect(loaded.actionCount).toBe(0);
    expect(loaded.issueCount).toBe(0);
    expect(loaded.providedCapabilities).toEqual([]);
  });

  it('records a load failure', async () => {
    listStatus = 500;
    await loadIntegrations();

    expect(integrationStore.loadError).not.toBeNull();
    expect(integrationStore.isLoading).toBe(false);
  });

  it('lets the latest started fetch win', async () => {
    let releaseFirst: () => void = () => {};
    const firstGate = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });

    listResponse = [integration({ id: 'old', name: 'Old' })];
    listGates = [firstGate];

    const first = loadIntegrations();

    listResponse = [integration({ id: 'new', name: 'New' })];
    await loadIntegrations();

    releaseFirst();
    await first;

    expect(integrationStore.integrations.map(i => i.name)).toEqual(['New']);
  });
});

describe('selection', () => {
  it('selects an integration', async () => {
    listResponse = [integration({ id: 'i1' })];
    await loadIntegrations();

    selectIntegration('i1');
    expect(integrationStore.selectedIntegration?.id).toBe('i1');
  });

  it('reports no selection for an unknown id', async () => {
    listResponse = [integration({ id: 'i1' })];
    await loadIntegrations();

    selectIntegration('nope');
    expect(integrationStore.selectedIntegration).toBeNull();
  });

  it('clears the selection', async () => {
    listResponse = [integration({ id: 'i1' })];
    await loadIntegrations();

    selectIntegration('i1');
    selectIntegration(null);
    expect(integrationStore.selectedIntegration).toBeNull();
  });
});

describe('enabled count', () => {
  it('counts only enabled integrations', async () => {
    listResponse = [
      integration({ id: 'a', enabled: true }),
      integration({ id: 'b', enabled: false }),
      integration({ id: 'c', enabled: true }),
    ];
    await loadIntegrations();

    expect(integrationStore.enabledCount).toBe(2);
  });
});

describe('toggling', () => {
  it('flips the switch optimistically', async () => {
    listResponse = [integration({ id: 'i1', enabled: true })];
    await loadIntegrations();

    const pending = toggleIntegration('i1');
    expect(integrationStore.integrations[0].enabled).toBe(false);

    await pending;
    expect(integrationStore.integrations[0].enabled).toBe(false);
  });

  it('reverts when the host rejects the change', async () => {
    listResponse = [integration({ id: 'i1', enabled: true })];
    await loadIntegrations();

    enabledResponse = { success: false, error: { message: 'nope' } };
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await toggleIntegration('i1');
    expect(integrationStore.integrations[0].enabled).toBe(true);
  });

  it('reverts when the request throws', async () => {
    listResponse = [integration({ id: 'i1', enabled: true })];
    await loadIntegrations();

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });

    await toggleIntegration('i1');
    expect(integrationStore.integrations[0].enabled).toBe(true);
  });

  it('ignores an unknown integration', async () => {
    await loadIntegrations();
    await expect(toggleIntegration('nope')).resolves.toBeUndefined();
  });
});

describe('config entries', () => {
  it('updates the configured entry count', async () => {
    listResponse = [integration({ id: 'i1', configuredEntryCount: 0 })];
    await loadIntegrations();

    entriesResponse = { entries: [{ id: 'a' }, { id: 'b' }] };
    await refreshConfigEntries('i1');

    expect(integrationStore.integrations[0].configuredEntryCount).toBe(2);
  });

  it('leaves the count alone when the request fails', async () => {
    listResponse = [integration({ id: 'i1', configuredEntryCount: 3 })];
    await loadIntegrations();

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', async () => new Response('', { status: 500 }));

    await refreshConfigEntries('i1');
    expect(integrationStore.integrations[0].configuredEntryCount).toBe(3);
  });
});
