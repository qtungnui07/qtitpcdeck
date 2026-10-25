/*
 * Session state, ported from the Angular AuthService.
 *
 * The behaviour is deliberately identical, because the host's session rules are
 * unforgiving: the refresh cookie is shared between `/` and `/admin`, and two
 * tabs rotating it at the same instant trips the host's reuse detection, which
 * revokes every session the user has. So the cross-tab lock, the single-flight
 * refresh, and the "unreachable is not a refusal" distinction all carry over
 * unchanged.
 *
 * What changed is only the container: Angular signals became runes, and the
 * injected environment tokens became module-level seams a test can replace.
 */

import {
  isUnreachable,
  runExclusively,
  browserLockEnvironment,
  type AuthScope,
  type DeviceSessionRevokedEvent,
  type RefreshOutcome,
  type TokenResponse,
  TransportError,
} from '@macro-deck/runtime';
import { api, disconnect, onNotificationOf, reconnectNow, resolveBaseUrl, setAuthHooks, startApi } from './api.svelte';
import { adoptDevice, buildLoginInfo } from './device-identity';
import { authEndpoints } from './endpoints';
import { shellBridge } from './shell-bridge';

export type AuthState = 'unknown' | 'setupRequired' | 'loggedOut' | 'authenticated';

export interface AuthResult {
  ok: boolean;
  message?: string;
}

/** The desktop admin UI requires admin scope, matching AUTH_REQUIRED_SCOPE in app.config.ts. */
const REQUIRED_SCOPE: AuthScope | null = 'admin';

const REFRESH_LEEWAY_SECONDS = 60;
const MIN_REFRESH_DELAY_MS = 5000;

const INITIAL_SESSION_RETRY_DELAY_MS = 2000;
const MAX_SESSION_RETRY_DELAY_MS = 60000;

const LOOPBACK_REAUTH_GUARD_MS = 30000;
const LOOPBACK_REAUTH_MARKER = 'md.auth.loopbackReauthAt';

const REFRESH_LOCK_NAME = 'md.auth.refreshLock';

/*
 * State is held in plain `$state` primitives, not in a wrapper object behind
 * getters. Svelte 5 tracks reads statically, so a getter that reads a rune is
 * not a dependency the compiler can see.
 */
let state = $state<AuthState>('unknown');
let scope = $state<AuthScope | null>(null);
let username = $state<string | null>(null);
let startupProfileId = $state<string | null>(null);
let trusted = $state(false);

let accessToken: string | null = null;
let accessTokenExpiresAt: number | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshPromise: Promise<RefreshOutcome> | null = null;
let sessionRetryTimer: ReturnType<typeof setTimeout> | null = null;
let sessionRetryDelayMs = INITIAL_SESSION_RETRY_DELAY_MS;
let deviceRevokedSubscribed = false;
let started = false;

export const auth = {
  get state(): AuthState {
    return state;
  },
  get scope(): AuthScope | null {
    return scope;
  },
  get username(): string | null {
    return username;
  },
  get startupProfileId(): string | null {
    return startupProfileId;
  },
  get trusted(): boolean {
    return trusted;
  },
  get isAuthenticated(): boolean {
    return state === 'authenticated';
  },
};

/**
 * Wires the auth hooks into the API client and starts the connection.
 *
 * Idempotent: the app calls it once at startup, and a second call is a no-op
 * rather than a second set of hooks.
 */
export function startAuth(): void {
  if (started) return;
  started = true;

  setAuthHooks({
    accessToken: () => accessToken,
    onUnauthorized: () => handleUnauthorized(),
    onConnectionUnauthorized: () => {
      void handleConnectionUnauthorized();
    },
    onForbidden: () => handleForbidden(),
  });

  subscribeToDeviceSessionRevoked();
  void startApi().then(() => bootstrap());
}

/**
 * Undoes startAuth: clears the session and forgets the hooks, so the next
 * startAuth bootstraps from scratch.
 *
 * The app never calls this - it exists so a test can exercise startup more than
 * once in a single module instance, which the `started` guard would otherwise
 * make impossible.
 */
export function stopAuth(): void {
  clearRefreshTimer();
  clearSessionRetryTimer();
  clearSession();
  setAuthHooks({});
  started = false;
  deviceRevokedSubscribed = false;
  state = 'unknown';
  trusted = false;
}

export async function bootstrap(): Promise<void> {
  try {
    // The auth endpoints are HTTP, so they need the host URL but not the socket.
    // Resolving here rather than relying on startApi means bootstrap works when
    // called on its own, which is how a test drives it.
    if ((await resolveBaseUrl()) === null) return;

    const status = await authEndpoints.status();

    // Inside the desktop shell an untrusted status means the window lost its
    // loopback session (the host restarted under a new secret): the shell
    // re-enters through a fresh session code.
    if (!status.trusted && requestLoopbackReauthentication()) {
      return;
    }

    if (!status.setupComplete) {
      state = 'setupRequired';
      return;
    }

    // Only transport-level trust (loopback/desktop) skips tokens. A status that
    // is merely cookie-authenticated (media cookie surviving a reload) still
    // needs a real refresh, otherwise the socket-ticket request would go out
    // token-less and fail.
    if (status.trusted) {
      trusted = true;
      scope = status.scope ?? 'admin';
      username = status.username ?? null;
      state = 'authenticated';
      return;
    }

    const outcome = await tryRefresh();
    if (outcome === 'unreachable') {
      // A host that answers /api/auth/status but not /api/auth/refresh - a
      // captive portal, a host mid-restart - is not a host that has refused the
      // session. Leaving the state at 'unknown' keeps the caller retrying
      // instead of falling through to a login form the still-good refresh
      // cookie should never have to see.
      return;
    }
    state = outcome === 'ok' ? 'authenticated' : 'loggedOut';
  } catch {
  }
}

export async function login(
  loginUsername: string,
  password: string,
  loginScope: AuthScope,
): Promise<AuthResult> {
  try {
    const response = await authEndpoints.login({
      username: loginUsername,
      password,
      scope: loginScope,
      device: buildLoginInfo(),
    });
    applySession(response);
    if (!hasSufficientScope()) {
      clearSession();
      return { ok: false, message: 'Not authorized.' };
    }
    adoptDevice(response.device);
    state = 'authenticated';
    return { ok: true };
  } catch (error) {
    return toAuthResult(error, 'Login failed.');
  }
}

export async function logout(): Promise<void> {
  try {
    await authEndpoints.logout();
  } catch {
  }
  clearSession();
  state = 'loggedOut';
  disconnect();
}

export async function setup(setupUsername: string, password: string): Promise<AuthResult> {
  try {
    await authEndpoints.setup({ username: setupUsername, password });
    state = 'unknown';
    await bootstrap();
    return { ok: true };
  } catch (error) {
    return toAuthResult(error, 'Setup failed.');
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
  try {
    await authEndpoints.changePassword({ currentPassword, newPassword });
    return { ok: true };
  } catch (error) {
    return toAuthResult(error, 'Could not change the password.');
  }
}

export async function resetPassword(newPassword: string): Promise<AuthResult> {
  try {
    await authEndpoints.resetPassword({ newPassword });
    return { ok: true };
  } catch (error) {
    return toAuthResult(error, 'Could not change the password.');
  }
}

export async function changeUsername(currentPassword: string, newUsername: string): Promise<AuthResult> {
  try {
    await authEndpoints.changeUsername({ currentPassword, newUsername });
    username = newUsername.trim();
    return { ok: true };
  } catch (error) {
    return toAuthResult(error, 'Could not change the username.');
  }
}

/** Called when the window regains focus, to refresh a token that is about to expire. */
export async function resume(): Promise<void> {
  if (state !== 'authenticated' || trusted) return;
  if (!isAccessTokenExpiringSoon()) return;

  const outcome = await tryRefresh();
  if (outcome === 'invalid' && state === 'authenticated') {
    sessionLost();
  } else if (outcome === 'unreachable') {
    scheduleSessionRetry();
  }
}

function isAccessTokenExpiringSoon(): boolean {
  if (accessTokenExpiresAt === null) return true;
  return Date.now() >= accessTokenExpiresAt - REFRESH_LEEWAY_SECONDS * 1000;
}

function refreshExclusively(): Promise<RefreshOutcome> {
  // A lock that failed means the refresh was never attempted, which is what
  // 'unreachable' says. Rejecting instead would leave every caller's retry
  // unarmed, and those timers are the only thing keeping a still-good session
  // alive while the host cannot be reached.
  return runExclusively(REFRESH_LOCK_NAME, () => refreshOnce(), browserLockEnvironment())
    .catch<RefreshOutcome>(() => 'unreachable');
}

async function handleUnauthorized(): Promise<boolean> {
  if (trusted) {
    requestLoopbackReauthentication();
    return false;
  }

  const outcome = await tryRefresh();
  if (outcome === 'invalid') {
    if (state === 'authenticated') sessionLost();
    return false;
  }
  if (outcome === 'unreachable') {
    scheduleSessionRetry();
    return false;
  }
  return true;
}

function handleForbidden(): void {
  if (trusted || state !== 'authenticated') return;
  if (!hasSufficientScope()) sessionLost();
}

function subscribeToDeviceSessionRevoked(): void {
  if (deviceRevokedSubscribed) return;
  deviceRevokedSubscribed = true;
  onNotificationOf<DeviceSessionRevokedEvent>('DeviceSessionRevokedEvent', () => {
    if (state === 'authenticated') sessionLost();
  });
}

async function handleConnectionUnauthorized(): Promise<void> {
  if (trusted) {
    requestLoopbackReauthentication();
    return;
  }

  const outcome = await tryRefresh();
  if (outcome === 'ok') {
    reconnectNow();
  } else if (outcome === 'invalid') {
    sessionLost();
  } else {
    // Not a refusal - the session stands, and the socket is left exactly where
    // the API client put it. retrySession()'s eventual reconnectNow() is what
    // nudges it again, once the host answers.
    scheduleSessionRetry();
  }
}

// Once per 30 s per window: a shell that cannot restore trust must fall through
// to the ordinary setup and login paths instead of reloading forever.
function requestLoopbackReauthentication(): boolean {
  const reauthenticate = shellBridge()?.reauthenticate;
  if (!reauthenticate) return false;

  const now = Date.now();
  const last = readLastReauthAttempt();
  if (last !== null && now - last < LOOPBACK_REAUTH_GUARD_MS) return false;

  recordReauthAttempt(now);
  reauthenticate().catch(() => {});
  return true;
}

function readLastReauthAttempt(): number | null {
  try {
    const value = Number(sessionStorage.getItem(LOOPBACK_REAUTH_MARKER));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function recordReauthAttempt(at: number): void {
  try {
    sessionStorage.setItem(LOOPBACK_REAUTH_MARKER, String(at));
  } catch {
  }
}

function tryRefresh(): Promise<RefreshOutcome> {
  refreshPromise ??= refreshExclusively().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function refreshOnce(): Promise<RefreshOutcome> {
  let response: TokenResponse;
  try {
    response = await authEndpoints.refresh();
  } catch (error) {
    return isUnreachable(error) ? 'unreachable' : 'invalid';
  }

  // A 2xx carrying no token is a captive portal answering in the host's place,
  // not the host refusing the session - the cookie was never actually asked.
  if (typeof response?.accessToken !== 'string') return 'unreachable';

  applySession(response);
  if (!hasSufficientScope()) {
    clearSession();
    return 'invalid';
  }
  return 'ok';
}

function scheduleSessionRetry(): void {
  if (sessionRetryTimer !== null) return;
  if (trusted || state !== 'authenticated') return;

  const delayMs = sessionRetryDelayMs;
  sessionRetryTimer = setTimeout(() => {
    sessionRetryTimer = null;
    void retrySession();
  }, delayMs);
  sessionRetryDelayMs = Math.min(delayMs * 2, MAX_SESSION_RETRY_DELAY_MS);
}

async function retrySession(): Promise<void> {
  if (trusted || state !== 'authenticated') return;

  const outcome = await tryRefresh();
  if (outcome === 'ok') {
    sessionRetryDelayMs = INITIAL_SESSION_RETRY_DELAY_MS;
    reconnectNow();
  } else if (outcome === 'invalid') {
    sessionLost();
  } else {
    scheduleSessionRetry();
  }
}

function clearSessionRetryTimer(): void {
  sessionRetryDelayMs = INITIAL_SESSION_RETRY_DELAY_MS;
  if (sessionRetryTimer === null) return;
  clearTimeout(sessionRetryTimer);
  sessionRetryTimer = null;
}

function hasSufficientScope(): boolean {
  if (REQUIRED_SCOPE === null) return true;
  return scope === 'admin' || scope === REQUIRED_SCOPE;
}

function applySession(response: TokenResponse): void {
  accessToken = response.accessToken;
  scope = response.scope;
  username = response.username;
  startupProfileId = response.device?.startupProfileId ?? null;
  accessTokenExpiresAt = Date.now() + response.expiresInSeconds * 1000;
  scheduleRefresh(response.expiresInSeconds);
}

function scheduleRefresh(expiresInSeconds: number): void {
  clearRefreshTimer();
  const delayMs = Math.max((expiresInSeconds - REFRESH_LEEWAY_SECONDS) * 1000, MIN_REFRESH_DELAY_MS);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void tryRefresh().then(outcome => {
      if (state !== 'authenticated') return;
      if (outcome === 'invalid') sessionLost();
      else if (outcome === 'unreachable') scheduleSessionRetry();
    });
  }, delayMs);
}

function sessionLost(): void {
  clearSession();
  state = 'loggedOut';
  disconnect();
}

function clearSession(): void {
  accessToken = null;
  accessTokenExpiresAt = null;
  scope = null;
  username = null;
  startupProfileId = null;
  // The Angular service never clears its `_trusted` flag, which leaves a
  // logged-out window still believing it holds loopback trust: handleUnauthorized
  // then skips the refresh and asks the shell to re-authenticate instead of
  // showing the login form. Trust is a property of the session, so it goes with
  // the rest of it.
  trusted = false;
  clearRefreshTimer();
  clearSessionRetryTimer();
}

function clearRefreshTimer(): void {
  if (refreshTimer === null) return;
  clearTimeout(refreshTimer);
  refreshTimer = null;
}

function toAuthResult(error: unknown, fallback: string): AuthResult {
  return {
    ok: false,
    message: error instanceof TransportError ? error.message : fallback,
  };
}

export { api };
