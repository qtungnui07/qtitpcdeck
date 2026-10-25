import { describe, expect, it, vi, afterEach } from 'vitest';
import { matchPattern, navigate, resolve, route, routeIdFor, startRouter, stopRouter } from '$lib/router.svelte';
import { ROUTES } from '$lib/routes';

describe('matchPattern', () => {
  it('matches a literal path', () => {
    expect(matchPattern('/deck', '/deck')).toEqual({});
  });

  it('rejects a different literal path', () => {
    expect(matchPattern('/deck', '/scripts')).toBeNull();
  });

  it('captures a named segment', () => {
    expect(matchPattern('/deck/widgets/:widgetId', '/deck/widgets/abc')).toEqual({ widgetId: 'abc' });
  });

  it('decodes a captured segment', () => {
    expect(matchPattern('/deck/widgets/:widgetId', '/deck/widgets/a%20b')).toEqual({ widgetId: 'a b' });
  });

  it('rejects a path with a missing segment', () => {
    expect(matchPattern('/deck/widgets/:widgetId', '/deck/widgets')).toBeNull();
  });

  it('rejects a path with a trailing segment', () => {
    expect(matchPattern('/deck', '/deck/extra')).toBeNull();
  });

  it('ignores a trailing slash', () => {
    expect(matchPattern('/deck', '/deck/')).toEqual({});
  });

  it('captures the rest with a wildcard', () => {
    expect(matchPattern('/store/*', '/store/a/b')).toEqual({ '*': 'a/b' });
  });
});

describe('resolve', () => {
  it('follows the root redirect', () => {
    const match = resolve(ROUTES, '/');
    expect(match?.pattern).toBe('/deck');
  });

  it('follows the icon-packs redirect', () => {
    const match = resolve(ROUTES, '/icon-packs');
    expect(match?.pattern).toBe('/library/icon-packs');
  });

  it('prefers the specific store route over the parameterised one', () => {
    expect(resolve(ROUTES, '/store/installed')?.pattern).toBe('/store/installed');
    expect(resolve(ROUTES, '/store/tests')?.pattern).toBe('/store/tests');
  });

  it('falls through to the parameterised store route', () => {
    const match = resolve(ROUTES, '/store/plugin/abc');
    expect(match?.pattern).toBe('/store/:kind/:extensionId');
    expect(match?.params).toEqual({ kind: 'plugin', extensionId: 'abc' });
  });

  it('parses the query string', () => {
    const match = resolve(ROUTES, '/variables', '?integrationId=abc');
    expect(match?.query).toEqual({ integrationId: 'abc' });
  });

  it('returns null for an unknown path', () => {
    expect(resolve(ROUTES, '/nope')).toBeNull();
  });

  it('does not loop forever on a redirect cycle', () => {
    const cyclic = [
      { id: 'a', pattern: '/a', redirectTo: '/b' },
      { id: 'b', pattern: '/b', redirectTo: '/a' },
    ];
    expect(resolve(cyclic, '/a')).toBeNull();
  });
});

describe('routeIdFor', () => {
  it('returns the id of the matched route', () => {
    expect(routeIdFor(ROUTES, '/automations')).toBe('automations');
  });

  it('returns the id of the redirect target', () => {
    expect(routeIdFor(ROUTES, '/')).toBe('deck');
  });

  it('returns null for an unknown path', () => {
    expect(routeIdFor(ROUTES, '/nope')).toBeNull();
  });
});

/*
 * The production build serves the app under /admin/ (the host's desktop UI
 * base), so the router has to strip that prefix from the location and add it
 * back on navigation. BASE_URL is read at call time, so stubbing it exercises
 * the base-aware paths with the same jsdom history.
 */
describe('with a /admin/ base', () => {
  afterEach(() => {
    stopRouter();
    vi.unstubAllEnvs();
  });

  it('navigates under the base and strips it from the match', () => {
    vi.stubEnv('BASE_URL', '/admin/');
    window.history.replaceState(null, '', '/admin/');

    startRouter();
    // The root redirect is followed, so the match is the deck.
    expect(route.path).toBe('/deck');

    navigate('/deck');
    expect(window.location.pathname).toBe('/admin/deck');
    expect(route.path).toBe('/deck');

    navigate('/store');
    expect(window.location.pathname).toBe('/admin/store');
    expect(route.path).toBe('/store');
  });

  it('strips the base from a deep link with a parameter', () => {
    vi.stubEnv('BASE_URL', '/admin/');
    window.history.replaceState(null, '', '/admin/store/Plugin/abc');

    startRouter();
    expect(route.path).toBe('/store/Plugin/abc');
    expect(route.params.extensionId).toBe('abc');
  });
});
