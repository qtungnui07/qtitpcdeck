/*
 * Tests for the auth store.
 *
 * The host is stubbed at the fetch boundary, so these exercise the real
 * HttpClient and the real state machine rather than a mock of them. What is
 * worth pinning down is the set of distinctions the host's session rules depend
 * on: trusted versus token-authenticated, refused versus unreachable, and
 * insufficient scope.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { auth, bootstrap, login, logout, resetPassword, startAuth, stopAuth } from './auth.svelte';
import { resetDeviceIdentity } from './device-identity';

interface StubResponse {
  status?: number;
  body?: unknown;
  text?: string;
}

let routes: Map<string, StubResponse>;
let calls: Array<{ method: string; path: string; body: unknown }>;

function stubFetch(): void {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    const key = `${method} ${url.pathname}`;
    calls.push({
      method,
      path: url.pathname,
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    });

    const stub = routes.get(key);
    if (stub === undefined) {
      return new Response('', { status: 404, statusText: 'Not Found' });
    }

    const status = stub.status ?? 200;
    const text = stub.text ?? (stub.body === undefined ? '' : JSON.stringify(stub.body));
    return new Response(text, { status, statusText: status === 200 ? 'OK' : 'Error' });
  });
}

function tokenResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    accessToken: 'access-token',
    expiresInSeconds: 3600,
    scope: 'admin',
    username: 'admin',
    ...overrides,
  };
}

beforeEach(() => {
  routes = new Map();
  calls = [];
  resetDeviceIdentity();
  stubFetch();
  vi.stubGlobal('WebSocket', class {});
});

afterEach(() => {
  stopAuth();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('auth store', () => {
  it('starts unknown', () => {
    expect(auth.state).toBe('unknown');
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.trusted).toBe(false);
  });

  it('reports setupRequired when the host has no user yet', async () => {
    routes.set('GET /api/auth/status', { body: { setupComplete: false, trusted: false } });
    await bootstrap();
    expect(auth.state).toBe('setupRequired');
  });

  it('authenticates on transport trust without a token', async () => {
    routes.set('GET /api/auth/status', {
      body: { setupComplete: true, trusted: true, scope: 'admin', username: 'admin' },
    });
    await bootstrap();
    expect(auth.state).toBe('authenticated');
    expect(auth.trusted).toBe(true);
    expect(auth.username).toBe('admin');
    expect(auth.scope).toBe('admin');
  });

  it('defaults the scope to admin when a trusted status omits it', async () => {
    routes.set('GET /api/auth/status', { body: { setupComplete: true, trusted: true } });
    await bootstrap();
    expect(auth.scope).toBe('admin');
  });

  it('authenticates through a refresh when the status is not trusted', async () => {
    routes.set('GET /api/auth/status', { body: { setupComplete: true, trusted: false } });
    routes.set('POST /api/auth/refresh', { body: tokenResponse() });
    await bootstrap();
    expect(auth.state).toBe('authenticated');
    expect(auth.trusted).toBe(false);
  });

  it('logs out when the refresh is refused', async () => {
    routes.set('GET /api/auth/status', { body: { setupComplete: true, trusted: false } });
    routes.set('POST /api/auth/refresh', { status: 401, body: { title: 'Unauthorized' } });
    await bootstrap();
    expect(auth.state).toBe('loggedOut');
  });

  it('stays unknown when the refresh is unreachable', async () => {
    routes.set('GET /api/auth/status', { body: { setupComplete: true, trusted: false } });
    // No refresh route: the stub answers 404, which is a refusal, so this case
    // needs a transport failure instead.
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/auth/status') {
        return new Response(JSON.stringify({ setupComplete: true, trusted: false }), { status: 200 });
      }
      throw new TypeError('Failed to fetch');
    });

    await bootstrap();
    expect(auth.state).toBe('unknown');
  });

  it('stays unknown when the status call itself fails', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    await bootstrap();
    expect(auth.state).toBe('unknown');
  });

  it('logs in and adopts the session', async () => {
    routes.set('POST /api/auth/login', {
      body: tokenResponse({ device: { deviceId: 'device-1', startupProfileId: 'profile-1' } }),
    });

    const result = await login('admin', 'secret', 'admin');
    expect(result.ok).toBe(true);
    expect(auth.state).toBe('authenticated');
    expect(auth.username).toBe('admin');
    expect(auth.startupProfileId).toBe('profile-1');
  });

  it('sends the device identity with a login', async () => {
    routes.set('POST /api/auth/login', { body: tokenResponse() });
    await login('admin', 'secret', 'admin');

    const call = calls.find(entry => entry.path === '/api/auth/login');
    expect(call).toBeDefined();
    const body = call?.body as { device?: { clientType?: string } };
    expect(body.device?.clientType).toBe('admin-ui');
  });

  it('refuses a login whose scope is insufficient', async () => {
    routes.set('POST /api/auth/login', { body: tokenResponse({ scope: 'user' }) });
    const result = await login('admin', 'secret', 'admin');
    expect(result.ok).toBe(false);
    expect(auth.state).not.toBe('authenticated');
  });

  it('reports the transport message when a login is refused', async () => {
    routes.set('POST /api/auth/login', { status: 401, body: { title: 'Bad credentials' } });
    const result = await login('admin', 'wrong', 'admin');
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Bad credentials');
  });

  it('falls back to a generic message when the failure carries none', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    const result = await login('admin', 'secret', 'admin');
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Login failed.');
  });

  it('clears the session on logout', async () => {
    routes.set('GET /api/auth/status', {
      body: { setupComplete: true, trusted: true, scope: 'admin', username: 'admin' },
    });
    await bootstrap();
    expect(auth.state).toBe('authenticated');

    routes.set('POST /api/auth/logout', {});
    await logout();
    expect(auth.state).toBe('loggedOut');
    expect(auth.username).toBeNull();
    expect(auth.scope).toBeNull();
    expect(auth.trusted).toBe(false);
  });

  it('logs out even when the host refuses the logout call', async () => {
    routes.set('GET /api/auth/status', { body: { setupComplete: true, trusted: true } });
    await bootstrap();

    routes.set('POST /api/auth/logout', { status: 500, body: { title: 'Boom' } });
    await logout();
    expect(auth.state).toBe('loggedOut');
  });

  it('reports a password reset failure', async () => {
    routes.set('POST /api/auth/reset-password', { status: 400, body: { title: 'Too short' } });
    const result = await resetPassword('x');
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Too short');
  });

  it('starts and stops without a host', async () => {
    startAuth();
    await Promise.resolve();
    stopAuth();
    expect(auth.state).toBe('unknown');
  });

  it('is idempotent on start', () => {
    startAuth();
    startAuth();
    expect(auth.state).toBe('unknown');
  });
});
