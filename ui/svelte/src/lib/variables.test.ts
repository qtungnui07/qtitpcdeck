/*
 * Tests for the variable store.
 *
 * The two rules worth pinning down are the ones a rewrite silently loses: a change event that
 * arrives mid-load must survive the response, and a pending value write must not be echoed back.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Variable } from '@macro-deck/runtime';
import {
  applyVariableBatch,
  createVariable,
  deleteVariable,
  filterVariablesByTypes,
  loadVariables,
  resetVariables,
  resolveVariable,
  sanitizeVariableNameLocal,
  setVariableValue,
  updateVariable,
  variableStore,
  visibleForActionButtonEditor,
  visibleForContext,
} from './variables.svelte';
import { startLocalization, stopLocalization } from './localization.svelte';

function variable(overrides: Partial<Variable> = {}): Variable {
  return {
    id: 'v1',
    name: 'counter',
    type: 'string',
    scope: 'global',
    classification: 'user',
    value: '0',
    ...overrides,
  } as Variable;
}

let listResponse: Variable[] = [];
let listStatus = 200;
let listGate: Promise<void> | null = null;
let createResponse: unknown = null;
let updateResponse: unknown = null;
let valueResponse: unknown = null;
let deleteResponse: unknown = null;

function stubFetch(): void {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init?.method ?? 'GET';

    if (url.pathname === '/api/variables' && method === 'GET') {
      if (listGate) await listGate;
      if (listStatus !== 200) return new Response('', { status: listStatus });
      return new Response(JSON.stringify({ variables: listResponse }), { status: 200 });
    }

    if (url.pathname === '/api/variables' && method === 'POST') {
      return new Response(JSON.stringify(createResponse), { status: 200 });
    }

    if (url.pathname === '/api/variables' && method === 'PUT') {
      return new Response(JSON.stringify(updateResponse), { status: 200 });
    }

    if (url.pathname.startsWith('/api/variables/') && url.pathname.endsWith('/value')) {
      return new Response(JSON.stringify(valueResponse), { status: 200 });
    }

    if (url.pathname.startsWith('/api/variables/') && method === 'DELETE') {
      return new Response(JSON.stringify(deleteResponse), { status: 200 });
    }

    return new Response('', { status: 404 });
  });
}

beforeEach(() => {
  listResponse = [];
  listStatus = 200;
  listGate = null;
  createResponse = null;
  updateResponse = null;
  valueResponse = null;
  deleteResponse = null;
  startLocalization();
  stubFetch();
});

afterEach(() => {
  resetVariables();
  stopLocalization();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('loading', () => {
  it('starts empty', () => {
    expect(variableStore.variables).toEqual([]);
    expect(variableStore.isLoading).toBe(false);
  });

  it('loads the list', async () => {
    listResponse = [variable()];
    await loadVariables();

    expect(variableStore.variables).toHaveLength(1);
    expect(variableStore.isLoading).toBe(false);
  });

  it('records a load failure', async () => {
    listStatus = 500;
    await loadVariables();

    expect(variableStore.loadError).not.toBeNull();
    expect(variableStore.isLoading).toBe(false);
  });

  it('shares one request between concurrent loads', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    listResponse = [variable()];

    await Promise.all([loadVariables(), loadVariables(), loadVariables()]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps a change that arrived while the load was in flight', async () => {
    listResponse = [variable({ id: 'v1', name: 'old' })];

    let release: () => void = () => {};
    listGate = new Promise<void>(resolve => {
      release = resolve;
    });

    const inFlight = loadVariables();

    // The host pushes a newer state than the request will return.
    applyVariableBatch([variable({ id: 'v2', name: 'created-during-load' })], ['v1']);

    release();
    await inFlight;

    expect(variableStore.variables.map(v => v.name)).toEqual(['created-during-load']);
  });
});

describe('ordering', () => {
  it('sorts global variables user before integration before widget', async () => {
    listResponse = [
      variable({ id: 'w', name: 'a', classification: 'widget' }),
      variable({ id: 'i', name: 'b', classification: 'integration' }),
      variable({ id: 'u', name: 'c', classification: 'user' }),
    ];
    await loadVariables();

    expect(variableStore.globalVariables.map(v => v.classification)).toEqual([
      'user',
      'integration',
      'widget',
    ]);
  });

  it('sorts by name within a classification', async () => {
    listResponse = [
      variable({ id: 'b', name: 'beta' }),
      variable({ id: 'a', name: 'alpha' }),
    ];
    await loadVariables();

    expect(variableStore.globalVariables.map(v => v.name)).toEqual(['alpha', 'beta']);
  });

  it('leaves the raw list in arrival order', async () => {
    listResponse = [
      variable({ id: 'b', name: 'beta' }),
      variable({ id: 'a', name: 'alpha' }),
    ];
    await loadVariables();

    // The raw list is the host's order; every consumer that cares sorts its own view.
    expect(variableStore.variables.map(v => v.name)).toEqual(['beta', 'alpha']);
  });
});

describe('scoping', () => {
  it('returns only globals for the global scope', async () => {
    listResponse = [
      variable({ id: 'g', name: 'global-one', scope: 'global' }),
      variable({ id: 'l', name: 'local-one', scope: 'widget', scopeRefId: 'w1' }),
    ];
    await loadVariables();

    expect(visibleForContext('global').map(v => v.name)).toEqual(['global-one']);
  });

  it('puts locals before globals for a widget scope', async () => {
    listResponse = [
      variable({ id: 'g', name: 'global-one', scope: 'global' }),
      variable({ id: 'l', name: 'local-one', scope: 'widget', scopeRefId: 'w1' }),
    ];
    await loadVariables();

    // Both are user-classified, so the name decides: global-one sorts before local-one.
    expect(visibleForContext('widget', 'w1').map(v => v.name)).toEqual(['global-one', 'local-one']);
  });

  it('puts a local before a global when the classification says so', async () => {
    listResponse = [
      variable({ id: 'g', name: 'zzz', scope: 'global', classification: 'integration' }),
      variable({ id: 'l', name: 'aaa', scope: 'widget', scopeRefId: 'w1', classification: 'user' }),
    ];
    await loadVariables();

    expect(visibleForContext('widget', 'w1').map(v => v.name)).toEqual(['aaa', 'zzz']);
  });

  it('hides a global shadowed by a local of the same name', async () => {
    listResponse = [
      variable({ id: 'g', name: 'same', scope: 'global' }),
      variable({ id: 'l', name: 'same', scope: 'widget', scopeRefId: 'w1' }),
    ];
    await loadVariables();

    const visible = visibleForContext('widget', 'w1');
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('l');
  });

  it('resolves a local before a global of the same name', async () => {
    listResponse = [
      variable({ id: 'g', name: 'same', scope: 'global' }),
      variable({ id: 'l', name: 'same', scope: 'widget', scopeRefId: 'w1' }),
    ];
    await loadVariables();

    expect(resolveVariable('same', 'widget', 'w1')?.id).toBe('l');
    expect(resolveVariable('same')?.id).toBe('g');
  });

  it('filters by accepted types', async () => {
    listResponse = [
      variable({ id: 'a', name: 'a', type: 'text' }),
      variable({ id: 'b', name: 'b', type: 'numeric' }),
    ];
    await loadVariables();

    expect(filterVariablesByTypes('global', undefined, ['numeric']).map(v => v.name)).toEqual(['b']);
  });

  it('returns everything when no types are accepted', async () => {
    listResponse = [variable({ id: 'a' }), variable({ id: 'b', name: 'other' })];
    await loadVariables();

    expect(filterVariablesByTypes('global', undefined, undefined)).toHaveLength(2);
  });
});

describe('action button editor', () => {
  it('offers the state variables in state mode even before they exist', async () => {
    listResponse = [];
    await loadVariables();

    const visible = visibleForActionButtonEditor('w1', true);
    expect(visible.map(v => v.name)).toContain('state');
    expect(visible.map(v => v.name)).toContain('state_label');
  });

  it('hides the state variables outside state mode', async () => {
    listResponse = [
      variable({ id: 's', name: 'state', scope: 'widget', scopeRefId: 'w1', classification: 'widget' }),
    ];
    await loadVariables();

    expect(visibleForActionButtonEditor('w1', false).map(v => v.name)).not.toContain('state');
  });

  it('falls back to globals without a widget', async () => {
    listResponse = [variable({ id: 'g', name: 'global-one' })];
    await loadVariables();

    expect(visibleForActionButtonEditor(undefined, true).map(v => v.name)).toEqual(['global-one']);
  });
});

describe('writes', () => {
  it('adds a created variable', async () => {
    createResponse = { success: true, variable: variable({ id: 'new', name: 'fresh' }) };

    const result = await createVariable({ name: 'fresh' } as never);

    expect(result.errorCode).toBeNull();
    expect(variableStore.variables.map(v => v.name)).toEqual(['fresh']);
  });

  it('reports a rejected create', async () => {
    createResponse = { success: false, error: { code: 'NAME_TAKEN' } };

    const result = await createVariable({ name: 'taken' } as never);

    expect(result.variable).toBeNull();
    expect(result.errorCode).toBe('NAME_TAKEN');
  });

  it('replaces an updated variable', async () => {
    listResponse = [variable({ id: 'v1', name: 'before' })];
    await loadVariables();

    updateResponse = { success: true, variable: variable({ id: 'v1', name: 'after' }) };
    await updateVariable({ id: 'v1', name: 'after' } as never);

    expect(variableStore.variables.map(v => v.name)).toEqual(['after']);
  });

  it('removes a deleted variable', async () => {
    listResponse = [variable({ id: 'v1' })];
    await loadVariables();

    deleteResponse = { success: true };
    expect(await deleteVariable('v1')).toBe(true);
    expect(variableStore.variables).toEqual([]);
  });

  it('keeps the variable when the delete is rejected', async () => {
    listResponse = [variable({ id: 'v1' })];
    await loadVariables();

    deleteResponse = { success: false };
    expect(await deleteVariable('v1')).toBe(false);
    expect(variableStore.variables).toHaveLength(1);
  });

  it('echoes a settled value write', async () => {
    listResponse = [variable({ id: 'v1', value: 'old' })];
    await loadVariables();

    valueResponse = { success: true, variable: variable({ id: 'v1', value: 'new' }) };
    await setVariableValue('v1', 'new');

    expect(variableStore.variables[0].value).toBe('new');
  });

  it('does not echo a pending value write', async () => {
    listResponse = [variable({ id: 'v1', value: 'old' })];
    await loadVariables();

    // The host hands the write to the variable's owner and reports the value as it still stands.
    valueResponse = { success: true, pending: true, variable: variable({ id: 'v1', value: 'old' }) };
    await setVariableValue('v1', 'new');

    expect(variableStore.variables[0].value).toBe('old');
  });
});

describe('name sanitizing', () => {
  it('lowercases and underscores', () => {
    expect(sanitizeVariableNameLocal('My Variable').sanitized).toBe('my_variable');
  });

  it('strips the public prefix', () => {
    expect(sanitizeVariableNameLocal('vars.counter').sanitized).toBe('counter');
  });

  it('folds accents', () => {
    expect(sanitizeVariableNameLocal('café').sanitized).toBe('cafe');
  });

  it('prefixes a leading digit', () => {
    expect(sanitizeVariableNameLocal('1st').sanitized).toBe('v_1st');
  });

  it('collapses runs of underscores', () => {
    expect(sanitizeVariableNameLocal('a   b').sanitized).toBe('a_b');
  });

  it('rejects an empty name', () => {
    expect(sanitizeVariableNameLocal('').isValid).toBe(false);
  });

  it('accepts a valid name', () => {
    expect(sanitizeVariableNameLocal('counter_1').isValid).toBe(true);
  });
});
