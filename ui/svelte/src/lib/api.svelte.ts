/*
 * The connection to the host.
 *
 * The Angular ApiService is 2145 lines, but almost none of it is transport: it
 * is ~250 typed endpoint wrappers over `this.http(...)`. The transport itself
 * already lives in @macro-deck/runtime as HttpClient + UiConnection, written
 * framework-free for exactly this reason, so this file wires those two together
 * and exposes the result as Svelte state. The endpoint wrappers are added as
 * pages need them rather than all at once.
 *
 * Two things the runtime does not do, and this file does:
 *
 *  - `connectionState` is a rune, so a component can bind to it. The runtime
 *    store is callback-based; a subscription bridges the two.
 *  - `onNotification` is exposed as a plain subscribe function rather than an
 *    RxJS Observable, matching how the rest of the Svelte app is written.
 */

import {
  HttpClient,
  TransportError,
  UiConnection,
  UI_CLIENT_FEATURE_OPEN_URL,
  type UiConnectionState,
} from '@macro-deck/runtime';
import { resolveHostUrl } from './host-url';

export type ConnectionState = UiConnectionState;

export { TransportError };

/*
 * State is held in plain `$state` primitives, not in a wrapper object behind
 * getters. Svelte 5 tracks reads statically, so a getter that reads a rune is
 * not a dependency the compiler can see.
 */
let connectionState = $state<ConnectionState>('disconnected');
let baseUrl = $state('');

let http: HttpClient | null = null;
let connection: UiConnection | null = null;
let started = false;

/** Auth hooks, registered by the auth store. Without them requests go out unauthenticated. */
let accessTokenProvider: (() => string | null) | null = null;
let unauthorizedHandler: (() => Promise<boolean>) | null = null;
let connectionUnauthorizedHandler: (() => void) | null = null;
let forbiddenHandler: (() => void) | null = null;

const clientId = crypto.randomUUID();

export const api = {
  get connectionState(): ConnectionState {
    return connectionState;
  },
  get isConnected(): boolean {
    return connectionState === 'connected';
  },
  get baseUrl(): string {
    return baseUrl;
  },
  get clientId(): string {
    return clientId;
  },
};

export function setAuthHooks(hooks: {
  accessToken?: () => string | null;
  onUnauthorized?: () => Promise<boolean>;
  onConnectionUnauthorized?: () => void;
  onForbidden?: () => void;
}): void {
  accessTokenProvider = hooks.accessToken ?? null;
  unauthorizedHandler = hooks.onUnauthorized ?? null;
  connectionUnauthorizedHandler = hooks.onConnectionUnauthorized ?? null;
  forbiddenHandler = hooks.onForbidden ?? null;
}

/**
 * Resolves the host URL and opens the socket.
 *
 * Idempotent: the app calls it once at startup, and a second call is a no-op
 * rather than a second connection. Returns once the host URL is known, so a
 * caller that wants to make an HTTP request straight away can await it.
 */
export async function startApi(): Promise<void> {
  if (started) return;
  started = true;

  ensureHttpClient();

  connection = new UiConnection({
    http: http as HttpClient,
    baseUrl: () => baseUrl,
    clientId,
    features: [UI_CLIENT_FEATURE_OPEN_URL],
    // A refused socket ticket is a different situation from a refused request:
    // the Angular service routes it to its own handler, which reconnects rather
    // than retrying the request. The runtime offers one hook, so the distinction
    // is made here by which handler is registered.
    onUnauthorized: async () => {
      if (connectionUnauthorizedHandler !== null) {
        connectionUnauthorizedHandler();
        return false;
      }
      return unauthorizedHandler?.() ?? false;
    },
  });

  connection.state.subscribe(state => {
    connectionState = state;
    if (state === 'connected') {
      for (const listener of connectedListeners.slice()) listener();
    }
  });

  await resolveBaseUrl();
  // stopApi may have run while the host URL was being resolved, in which case
  // there is no connection left to open.
  connection?.connect();
}

function ensureHttpClient(): HttpClient {
  http ??= new HttpClient({
    baseUrl: () => baseUrl,
    accessToken: () => accessTokenProvider?.() ?? undefined,
    onUnauthorized: () => unauthorizedHandler?.() ?? Promise.resolve(false),
    onForbidden: () => forbiddenHandler?.(),
  });
  return http;
}

/**
 * Resolves the host URL if it is not known yet.
 *
 * Separate from startApi because an HTTP request needs only the URL, not the
 * socket: bootstrap() calls the auth endpoints before the socket is up, and a
 * test drives bootstrap() on its own.
 */
export async function resolveBaseUrl(): Promise<string | null> {
  if (baseUrl !== '') return baseUrl;
  const resolved = await resolveHostUrl();
  if (resolved === null || resolved === '') return null;
  baseUrl = resolved;
  return resolved;
}

/**
 * Undoes startApi: closes the socket and forgets the resolved host, so the next
 * startApi connects from scratch.
 *
 * The app never calls this - it exists so a test can exercise startup more than
 * once in a single module instance, which the `started` guard would otherwise
 * make impossible.
 */
export function stopApi(): void {
  connection?.disconnect();
  connection = null;
  http = null;
  started = false;
  connectionState = 'disconnected';
  baseUrl = '';
  connectedListeners.length = 0;
}

export async function connect(): Promise<void> {
  await resolveBaseUrl();
  connection?.connect();
}

export function disconnect(): void {
  connection?.disconnect();
}

export function reconnectNow(): void {
  connection?.reconnectNow();
}

const connectedListeners: Array<() => void> = [];

/** Runs `listener` every time the socket reaches `connected`, including now if it already has. */
export function onConnected(listener: () => void): () => void {
  connectedListeners.push(listener);
  if (connectionState === 'connected') listener();
  return () => {
    const at = connectedListeners.indexOf(listener);
    if (at >= 0) connectedListeners.splice(at, 1);
  };
}

/** Subscribes to every host notification. Returns an unsubscribe function. */
export function onNotification(listener: (method: string, params: unknown) => void): () => void {
  return connection?.onNotification(listener) ?? (() => {});
}

/** Subscribes to one notification method, with `params` typed by the caller. */
export function onNotificationOf<T>(
  method: string,
  listener: (params: T) => void,
): () => void {
  return onNotification((received, params) => {
    if (received === method) listener(params as T);
  });
}

/**
 * Sends a request over the socket.
 *
 * Rejects when the socket is closed rather than resolving to null: a caller
 * that asked for data and got nothing needs to know the difference between
 * "the host said no" and "there is no host".
 */
export function request<T>(method: string, payload?: unknown): Promise<T> {
  if (connection === null) {
    return Promise.reject(new Error('The UI connection is not open.'));
  }
  return connection.request<T>(method, payload);
}

/** Sends a request and swallows a closed socket, for fire-and-forget calls. */
export async function invoke(method: string, ...args: unknown[]): Promise<void> {
  try {
    await request<void>(method, args);
  } catch (error) {
    console.warn(`UI WebSocket request '${method}' failed:`, error);
  }
}

/** Sends a request and returns null instead of throwing, for optional data. */
export async function invokeResult<T>(method: string, ...args: unknown[]): Promise<T | null> {
  try {
    return await request<T>(method, args);
  } catch (error) {
    console.warn(`UI WebSocket request '${method}' failed:`, error);
    return null;
  }
}

function requireHttp(): HttpClient {
  return ensureHttpClient();
}

export function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return requireHttp().get<T>(path, signal);
}

export function post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  return requireHttp().post<T>(path, body, signal);
}

export function put<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  return requireHttp().put<T>(path, body, signal);
}

export function patch<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  return requireHttp().patch<T>(path, body, signal);
}

export function del<T>(path: string, signal?: AbortSignal): Promise<T> {
  return requireHttp().delete<T>(path, signal);
}

/** Downloads a binary payload as a Blob and parses the filename from Content-Disposition if present. */
export async function getBlob(
  path: string,
  signal?: AbortSignal,
): Promise<{ blob: Blob; fileName?: string }> {
  const response = await requireHttp().fetchWithAuth('GET', path, undefined, signal);
  if (!response.ok) {
    throw new TransportError(response.status, `Failed to download: ${response.statusText}`);
  }
  const disposition = response.headers.get('Content-Disposition');
  let fileName: string | undefined;
  if (disposition) {
    const extended = /filename\*=(?:UTF-8|utf-8)''([^;]+)/i.exec(disposition);
    if (extended) {
      try {
        fileName = decodeURIComponent(extended[1].trim());
      } catch {
        // Fall back to ASCII filename
      }
    }
    if (!fileName) {
      const plain = /filename="?([^";]+)"?/i.exec(disposition);
      if (plain) fileName = plain[1].trim();
    }
  }
  const blob = await response.blob();
  return { blob, fileName };
}

/** Sends a multipart FormData payload without serializing as JSON. */
export async function postForm<T>(path: string, form: FormData, signal?: AbortSignal): Promise<T> {
  const url = (baseUrl || '') + path;
  const token = accessTokenProvider?.();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response = await fetch(url, {
    method: 'POST',
    headers,
    body: form,
    signal,
    cache: 'no-store',
  });

  if (response.status === 403) {
    forbiddenHandler?.();
  } else if (response.status === 401 && unauthorizedHandler) {
    const retry = await unauthorizedHandler();
    if (retry) {
      const retryToken = accessTokenProvider?.();
      const retryHeaders: Record<string, string> = {};
      if (retryToken) retryHeaders['Authorization'] = `Bearer ${retryToken}`;
      response = await fetch(url, {
        method: 'POST',
        headers: retryHeaders,
        body: form,
        signal,
        cache: 'no-store',
      });
    }
  }

  const text = await response.text();
  if (!response.ok) {
    let problem: { title?: string; detail?: string; message?: string; code?: string } | undefined;
    try {
      problem = JSON.parse(text);
    } catch {
      // Non-JSON response, ignore parse error.
    }
    const message =
      problem?.title ?? problem?.detail ?? problem?.message ?? response.statusText ?? `HTTP ${response.status}`;
    throw new TransportError(response.status, message, problem?.code);
  }

  return (text.length === 0 ? undefined : JSON.parse(text)) as T;
}

/** The raw fetch, for callers that need the Response (downloads, status codes). */
export function fetchWithAuth(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  return requireHttp().fetchWithAuth(method, path, body, signal, extraHeaders);
}
