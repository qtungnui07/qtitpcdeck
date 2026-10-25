import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import App from './App.svelte';
import { stopTheme } from '$lib/theme.svelte';
import { stopNavigation } from '$lib/navigation.svelte';
import { stopRouter } from '$lib/router.svelte';
import { stopAuth } from '$lib/auth.svelte';
import { stopLocalization } from '$lib/localization.svelte';
import { stopNotificationCenter } from '$lib/notification-center.svelte';
import { stopApi } from '$lib/api.svelte';

/*
 * These tests exercise the shell, the nav and the theme stores, all of which
 * render only for an authenticated session. The auth store itself has its own
 * suite; here it is held at 'authenticated' so the gate in App.svelte lets the
 * shell through without a host to bootstrap against.
 */
vi.mock('$lib/auth.svelte', () => ({
  auth: {
    state: 'authenticated',
    scope: 'admin',
    username: 'tester',
    startupProfileId: null,
    trusted: false,
    isAuthenticated: true,
  },
  startAuth: vi.fn(),
  bootstrap: vi.fn(),
  stopAuth: vi.fn(),
  login: vi.fn(),
  setup: vi.fn(),
  logout: vi.fn(),
  resume: vi.fn(),
  changePassword: vi.fn(),
  resetPassword: vi.fn(),
  changeUsername: vi.fn(),
}));

/*
 * jsdom has no matchMedia, and the theme store reads it at startup. Stubbing it
 * here rather than in the setup file keeps the stub next to the only test that
 * needs it - the store is the sole consumer.
 */
function stubMatchMedia(prefersDark: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('dark') ? prefersDark : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

/** Puts the app at a path before it mounts, the way a deep link would. */
function atPath(path: string): void {
  window.history.replaceState(null, '', path);
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
    stubMatchMedia(true);
    atPath('/');
  });

  /*
   * Every store guards its startup so the app can call it on each mount without
   * stacking listeners, which means the first test would otherwise consume the
   * one startup each module allows. The stop* functions hand them back.
   */
  afterEach(() => {
    stopTheme();
    stopNavigation();
    stopRouter();
    stopNotificationCenter();
    stopLocalization();
    stopAuth();
    stopApi();
    vi.unstubAllGlobals();
  });

  it('renders the shell frame', () => {
    render(App);
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
  });

  it('shows the connection state in the statusbar', () => {
    render(App);
    const dot = document.querySelector('.connection-dot');
    expect(dot).not.toBeNull();
    // No host is reachable in jsdom, so the socket never opens.
    expect(dot?.getAttribute('data-state')).toBe('disconnected');
  });

  it('shows no notification badge when the list is empty', () => {
    render(App);
    expect(document.querySelector('.nav-indicator')).toBeNull();
  });

  it('shows no activity ring when nothing is running', () => {
    render(App);
    expect(document.querySelector('.nav-activity')).toBeNull();
  });

  it('resolves the system preference to dark when the system asks for dark', () => {
    render(App);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('resolves the system preference to light when the system asks for light', () => {
    stubMatchMedia(false);
    render(App);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('seeds the accent token with the Nord Frost default', () => {
    render(App);
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#88C0D0');
  });

  it('restores a cached accent instead of the default', () => {
    localStorage.setItem('md.appearance.accentColor', '#BF616A');
    render(App);
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#BF616A');
  });

  it('restores a cached theme mode instead of following the system', () => {
    localStorage.setItem('md.appearance.themeMode', 'light');
    render(App);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('redirects the root path to the deck page', () => {
    render(App);
    expect(window.location.pathname).toBe('/');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Deck');
  });

  it('renders the page for the current route', () => {
    atPath('/variables');
    render(App);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Variables');
  });

  it('renders a not-found page for an unknown route', () => {
    atPath('/nope');
    render(App);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Không tìm thấy trang');
  });

  it('marks the nav item for the current route as active', () => {
    atPath('/automations');
    render(App);
    const link = screen.getByRole('link', { name: 'Automations' });
    expect(link.classList.contains('active')).toBe(true);
  });

  it('does not mark other nav items as active', () => {
    atPath('/automations');
    render(App);
    const link = screen.getByRole('link', { name: 'Scripts' });
    expect(link.classList.contains('active')).toBe(false);
  });

  it('renders every main nav destination', () => {
    render(App);
    for (const label of ['Deck', 'Scripts', 'Automations', 'Variables', 'Integrations', 'Library', 'Store']) {
      expect(screen.getByRole('link', { name: label })).toBeTruthy();
    }
  });

  it('renders the bottom nav destinations', () => {
    render(App);
    expect(screen.getByRole('link', { name: 'Developer Tools' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
  });

  it('navigates when a nav item is clicked', async () => {
    render(App);
    const link = screen.getByRole('link', { name: 'Store' });
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    expect(window.location.pathname).toBe('/store');
  });

  it('collapses the sidebar when the toggle is clicked', async () => {
    render(App);
    const toggle = screen.getByRole('button', { name: 'Toggle sidebar' });
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    expect(localStorage.getItem('md.sidebar.userCollapsed')).toBe('1');
  });

  /*
   * The width is bound through a `$derived` in Sidebar.svelte. An earlier
   * version read the store's getter inline in the template, which Svelte 5
   * cannot track, so the class toggled while the width stayed put. Asserting the
   * inline style catches that: the class alone would still pass.
   */
  it('narrows the sidebar when it collapses', async () => {
    render(App);
    const sidebar = document.querySelector('aside.sidebar') as HTMLElement;
    expect(sidebar.style.width).toBe('220px');

    screen.getByRole('button', { name: 'Toggle sidebar' }).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    expect(sidebar.style.width).toBe('64px');
  });

  it('widens the sidebar again when it expands', async () => {
    render(App);
    const sidebar = document.querySelector('aside.sidebar') as HTMLElement;
    const toggle = screen.getByRole('button', { name: 'Toggle sidebar' });

    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    expect(sidebar.style.width).toBe('220px');
  });

  it('restores a collapsed sidebar from storage', () => {
    localStorage.setItem('md.sidebar.userCollapsed', '1');
    render(App);
    const sidebar = document.querySelector('aside.sidebar') as HTMLElement;
    expect(sidebar.style.width).toBe('64px');
  });
});
