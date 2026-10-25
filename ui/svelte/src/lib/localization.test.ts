/*
 * Tests for the localization store.
 *
 * The lookup rules are the interesting part: an exact key wins, a plural suffix
 * is tried only when a count is supplied, and an unknown key renders visibly
 * rather than as an empty string.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Strings } from '@macro-deck/runtime';
import {
  DEFAULT_CULTURE,
  localization,
  loadFromHost,
  setCulture,
  startLocalization,
  stopLocalization,
  timeLocale,
  translate,
  translateKey,
} from './localization.svelte';

let catalog: Record<string, unknown> | null;

function stubFetch(): void {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();

    if (url.pathname === '/api/localization' && method === 'GET') {
      if (catalog === null) return new Response('', { status: 500 });
      return new Response(JSON.stringify(catalog), { status: 200 });
    }

    if (url.pathname === '/api/settings/localization' && method === 'PUT') {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response('', { status: 404 });
  });
}

beforeEach(() => {
  catalog = null;
  localStorage.clear();
  stubFetch();
  vi.stubGlobal('WebSocket', class {});
});

afterEach(() => {
  stopLocalization();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('localization store', () => {
  it('starts on the default culture', () => {
    expect(localization.culture).toBe(DEFAULT_CULTURE);
    expect(localization.availableCultures).toEqual([]);
  });

  it('translates a bundled default before any host contact', () => {
    // The bundled catalogue is merged in at module load, so a common key
    // resolves without a host. Strings.Common.Close is the qualified key.
    expect(translateKey(Strings.Common.Close)).toBe('Close');
  });

  it('renders an unknown key visibly', () => {
    expect(translate('Nope', 'Missing')).toBe('[[Nope:Missing]]');
  });

  it('renders a key with no scope visibly', () => {
    expect(translateKey('NoScope')).toBe('[[NoScope]]');
  });

  it('translates a qualified key', () => {
    expect(translateKey('Nope:Missing')).toBe('[[Nope:Missing]]');
  });

  it('applies a catalogue from the host', async () => {
    catalog = {
      culture: 'vi',
      fallbackCulture: 'en',
      translations: { 'Test:Hello': 'Xin chào' },
      availableCultures: ['en', 'vi'],
      followSystem: false,
      timeFormat: '24h',
    };

    await loadFromHost();

    expect(localization.culture).toBe('vi');
    expect(localization.fallbackCulture).toBe('en');
    expect(localization.availableCultures).toEqual(['en', 'vi']);
    expect(localization.timeFormat).toBe('24h');
    expect(translate('Test', 'Hello')).toBe('Xin chào');
  });

  it('keeps the bundled defaults alongside host translations', async () => {
    catalog = { culture: 'vi', translations: { 'Test:Hello': 'Xin chào' } };
    await loadFromHost();

    expect(translate('Test', 'Hello')).toBe('Xin chào');
    expect(translateKey(Strings.Common.Close)).toBe('Close');
  });

  it('formats a template with arguments', async () => {
    catalog = { translations: { 'Test:Greeting': 'Hello {name}' } };
    await loadFromHost();

    expect(translate('Test', 'Greeting', { name: 'World' })).toBe('Hello World');
  });

  it('prefers an exact key over a plural form', async () => {
    catalog = {
      translations: {
        'Test:Items': 'Items',
        'Test:Items.One': 'One item',
      },
    };
    await loadFromHost();

    expect(translate('Test', 'Items', { count: 1 })).toBe('Items');
  });

  it('falls back to a plural form when there is no exact key', async () => {
    catalog = {
      translations: {
        'Test:Items.One': 'One item',
        'Test:Items.Other': '{count} items',
      },
    };
    await loadFromHost();

    expect(translate('Test', 'Items', { count: 1 })).toBe('One item');
    expect(translate('Test', 'Items', { count: 5 })).toBe('5 items');
  });

  it('ignores a plural form when no count is supplied', async () => {
    catalog = { translations: { 'Test:Items.One': 'One item' } };
    await loadFromHost();

    expect(translate('Test', 'Items')).toBe('[[Test:Items]]');
  });

  it('bumps the catalogue version on each load', async () => {
    const before = localization.catalogVersion;
    catalog = { translations: {} };
    await loadFromHost();
    expect(localization.catalogVersion).toBe(before + 1);
  });

  it('survives a host that refuses the catalogue', async () => {
    catalog = null;
    await expect(loadFromHost()).resolves.toBeUndefined();
    expect(localization.culture).toBe(DEFAULT_CULTURE);
  });

  it('persists the catalogue to localStorage', async () => {
    catalog = { culture: 'vi', translations: { 'Test:Hello': 'Xin chào' } };
    await loadFromHost();

    expect(localStorage.getItem('md.localization.culture')).toBe('vi');
    expect(localStorage.getItem('md.localization.translations')).toContain('Xin chào');
  });

  it('restores the cached catalogue on start', async () => {
    catalog = { culture: 'vi', translations: { 'Test:Hello': 'Xin chào' } };
    await loadFromHost();
    stopLocalization();

    // With the host gone, only the cache can supply the translation.
    catalog = null;
    startLocalization();

    expect(localization.culture).toBe('vi');
    expect(translate('Test', 'Hello')).toBe('Xin chào');
  });

  it('sets the document language and direction', async () => {
    catalog = { culture: 'vi', availableCultures: ['en', 'vi'] };
    await loadFromHost();

    expect(document.documentElement.lang).toBe('vi');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('reports a time locale', async () => {
    catalog = { culture: 'vi', hourCycle: 'h23' };
    await loadFromHost();

    expect(timeLocale()).toEqual({ locale: 'vi', hourCycle: 'h23' });
  });

  it('changes the culture through the host', async () => {
    catalog = { culture: 'en', translations: {} };
    await loadFromHost();

    catalog = { culture: 'vi', translations: {} };
    await setCulture('vi');

    expect(localization.culture).toBe('vi');
  });

  it('is idempotent on start', () => {
    startLocalization();
    startLocalization();
    expect(localization.culture).toBe(DEFAULT_CULTURE);
  });

  it('stops cleanly without having started', () => {
    expect(() => stopLocalization()).not.toThrow();
  });
});
