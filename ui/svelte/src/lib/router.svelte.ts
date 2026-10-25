/*
 * A small history-based router.
 *
 * The Angular app used @angular/router, which brought route guards, resolvers
 * and a typed route tree. None of that is needed yet: the route table is 13
 * entries, the guards are two "is there unsaved work" prompts, and the pages
 * load eagerly enough that lazy chunks are not worth the complexity. A
 * dependency-free router keeps the boundary tests meaningful and avoids
 * adopting a third-party router whose Svelte 5 support would need verifying.
 *
 * The API is deliberately close to the Angular one so the pages port over
 * without rethinking navigation: `navigate` takes a path, `route` exposes the
 * current match, and query parameters are read from `route.query`.
 */

import { ROUTES } from './routes';

export interface RouteMatch {
  /** The path pattern that matched, e.g. `/deck/widgets/:widgetId`. */
  pattern: string;
  /** The path that was navigated to, e.g. `/deck/widgets/abc`. */
  path: string;
  /** Named segments from the pattern, e.g. `{ widgetId: 'abc' }`. */
  params: Record<string, string>;
  /** Parsed query string. Repeated keys keep the last value. */
  query: Record<string, string>;
}

export interface RouteDefinition {
  pattern: string;
  /** When set, navigating here redirects instead of rendering. */
  redirectTo?: string;
  /** A human-readable name, used by the shell to highlight the active nav item. */
  id: string;
}

/*
 * State is held in a plain `$state` value rather than in a wrapper object with
 * getters. Svelte 5 tracks reads statically: a getter on a plain object that
 * reads a rune is not a dependency the compiler can see, so a template binding
 * through one updates only by luck.
 */
let currentMatch = $state<RouteMatch | null>(null);

let started = false;
let listener: (() => void) | null = null;

export const route = {
  get match(): RouteMatch | null {
    return currentMatch;
  },
  get path(): string {
    return currentMatch?.path ?? '/';
  },
  get params(): Record<string, string> {
    return currentMatch?.params ?? {};
  },
  get query(): Record<string, string> {
    return currentMatch?.query ?? {};
  },
};

/**
 * Splits a path into its segments, dropping the empty ones a leading or
 * trailing slash produces.
 */
function segments(path: string): string[] {
  return path.split('/').filter(segment => segment !== '');
}

/**
 * Matches a concrete path against a pattern, returning the captured segments or
 * null. A `:name` segment captures one segment; `*` captures the rest.
 */
export function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const patternParts = segments(pattern);
  const pathParts = segments(path);
  const params: Record<string, string> = {};

  for (let index = 0; index < patternParts.length; index += 1) {
    const part = patternParts[index];

    if (part === '*') {
      params['*'] = pathParts.slice(index).join('/');
      return params;
    }

    const value = pathParts[index];
    if (value === undefined) return null;

    if (part.startsWith(':')) {
      params[part.slice(1)] = decodeURIComponent(value);
    } else if (part !== value) {
      return null;
    }
  }

  return patternParts.length === pathParts.length ? params : null;
}

function parseQuery(search: string): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(search)) {
    query[key] = value;
  }
  return query;
}

/**
 * The base the app is served under: `/admin/` in the production build (the
 * host serves the desktop UI there and rewrites deep links to it), `/` on the
 * dev server. Vite injects it from the build config; it is read at call time
 * so a test can stub it.
 *
 * The route table speaks base-less paths - the location is stripped on the way
 * in and the base is added back on the way out.
 */
function routeBase(): string {
  const base: string | undefined = import.meta.env.BASE_URL;
  return base === undefined || base === '/' ? '' : base.replace(/\/$/, '');
}

function stripBase(pathname: string): string {
  const base = routeBase();
  if (base !== '' && pathname.startsWith(base)) {
    pathname = pathname.slice(base.length);
  }
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

/**
 * Resolves a path against the route table, following redirects.
 *
 * Returns null when nothing matches, which the shell renders as a not-found
 * page rather than throwing - a stale bookmark should not blank the app.
 */
export function resolve(
  routes: readonly RouteDefinition[],
  path: string,
  search = '',
): RouteMatch | null {
  let current = path;
  let currentSearch = search;

  // A redirect chain longer than the table is a cycle; bail rather than spin.
  for (let hop = 0; hop <= routes.length; hop += 1) {
    let matched: RouteMatch | null = null;
    let definition: RouteDefinition | null = null;

    for (const candidate of routes) {
      const params = matchPattern(candidate.pattern, current);
      if (params === null) continue;

      matched = {
        pattern: candidate.pattern,
        path: current,
        params,
        query: parseQuery(currentSearch),
      };
      definition = candidate;
      break;
    }

    if (matched === null || definition === null) return null;
    if (definition.redirectTo === undefined) return matched;

    current = definition.redirectTo;
    currentSearch = '';
  }

  return null;
}

/** The route id for a path, used to highlight the active nav item. */
export function routeIdFor(routes: readonly RouteDefinition[], path: string): string | null {
  const match = resolve(routes, path);
  if (match === null) return null;
  return routes.find(definition => definition.pattern === match.pattern)?.id ?? null;
}

/**
 * Navigates to a path, pushing a history entry.
 *
 * `replace` swaps the current entry instead, which is what a redirect wants -
 * otherwise the back button would bounce the user through it again.
 */
export function navigate(path: string, options: { replace?: boolean } = {}): void {
  const url = new URL(`${routeBase()}${path}`, window.location.origin);
  const target = `${url.pathname}${url.search}`;
  const current = `${window.location.pathname}${window.location.search}`;

  if (target === current) {
    // Same URL: history.pushState would add a duplicate entry, so only the
    // match needs refreshing.
    syncFromLocation();
    return;
  }

  if (options.replace === true) {
    window.history.replaceState(null, '', target);
  } else {
    window.history.pushState(null, '', target);
  }

  syncFromLocation();
}

function syncFromLocation(): void {
  const path = stripBase(window.location.pathname);
  // Resolve against the table so the match carries its pattern and params -
  // the pages read `route.params`, which a raw location snapshot cannot fill.
  currentMatch = resolve(ROUTES, path, window.location.search)
    ?? { pattern: '', path, params: {}, query: parseQuery(window.location.search) };
}

/**
 * Starts listening for history changes.
 *
 * Idempotent, and paired with stopRouter so a test can start it more than once
 * in a single module instance.
 */
export function startRouter(): void {
  if (started) return;
  started = true;

  listener = () => syncFromLocation();
  window.addEventListener('popstate', listener);
  syncFromLocation();
}

export function stopRouter(): void {
  if (listener !== null) {
    window.removeEventListener('popstate', listener);
  }
  listener = null;
  started = false;
  currentMatch = null;
}
