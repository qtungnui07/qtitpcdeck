/*
 * Navigation state, ported from the Angular NavigationService.
 *
 * The nav model is the same: four groups of main items, three bottom items, and
 * the same localStorage key for the collapsed sidebar.
 *
 * Labels go through the localization store rather than the bundled translator
 * directly, so a language change re-renders the sidebar. The notification badge
 * and activity ring read the notification centre, which is why the nav model is
 * a getter rather than a constant.
 */

import { AppStrings, Strings } from '@macro-deck/runtime';
import { translateKey } from './localization.svelte';
import { notificationCenter } from './notification-center.svelte';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  action?: string;
  disabled?: boolean;
  badge?: string;
  indicator?: string | null;
  activity?: boolean;
}

export const SIDEBAR_COLLAPSED_KEY = 'md.sidebar.userCollapsed';

export const SIDEBAR_EXPANDED_WIDTH = 220;
export const SIDEBAR_COLLAPSED_WIDTH = 64;

export const MIN_CONTENT_WIDTH_REM = 44;

/**
 * Whether the workspace is too narrow for the sidebar to stay expanded.
 *
 * The sidebar's own width is excluded from the measurement on purpose: if it
 * were included, collapsing the sidebar would widen the workspace, which would
 * un-constrain it, which would expand the sidebar again.
 */
export function isWorkspaceConstrained(availableWidth: number, rootFontSizePx: number): boolean {
  return availableWidth - SIDEBAR_EXPANDED_WIDTH < MIN_CONTENT_WIDTH_REM * rootFontSizePx;
}

export function formatBuildVersion(
  version: string,
  isDevelopmentBuild: boolean,
  commit: string | null,
): string {
  return isDevelopmentBuild ? `dev/${commit ?? 'unknown'}` : version;
}

function readPersistedCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writePersistedCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // A blocked localStorage must not break the toggle.
  }
}

/*
 * State is held in plain `$state` primitives rather than in a wrapper object
 * with getters. Svelte 5 tracks reads statically: a getter on a plain object
 * that reads a rune is not a dependency the compiler can see, so a template
 * binding through one updates only by luck. Exporting the runes directly, and
 * `$derived` for anything computed, gives every consumer a real dependency.
 */
let userCollapsed = $state(false);
let spaceConstrained = $state(false);
let constraintOverride = $state(false);
let connectionPanelOpen = $state(false);
let notificationPanelOpen = $state(false);
let appVersion = $state('');
let isBeta = $state(false);
let isDevelopmentBuild = $state(false);
let developmentCommit = $state<string | null>(null);

let started = false;

export const navigation = {
  get isSidebarCollapsed(): boolean {
    return userCollapsed || (spaceConstrained && !constraintOverride);
  },
  get isConnectionPanelOpen(): boolean {
    return connectionPanelOpen;
  },
  get isNotificationPanelOpen(): boolean {
    return notificationPanelOpen;
  },
  get appVersion(): string {
    return appVersion;
  },
  get isBeta(): boolean {
    return isBeta;
  },
  get versionLabel(): string {
    return formatBuildVersion(appVersion, isDevelopmentBuild, developmentCommit);
  },
  get isDevelopmentBuild(): boolean {
    return isDevelopmentBuild;
  },

  get mainNavGroups(): NavItem[][] {
    const text = (key: string): string => translateKey(key);

    return [
      [{ id: 'deck', label: text(AppStrings.Nav.Deck), icon: 'grid', route: '/deck' }],
      [
        { id: 'scripts', label: text(AppStrings.Nav.Scripts), icon: 'list-play', route: '/scripts' },
        { id: 'automations', label: text(AppStrings.Nav.Automations), icon: 'zap', route: '/automations' },
      ],
      [
        { id: 'variables', label: text(AppStrings.Nav.Variables), icon: 'braces-x', route: '/variables' },
        { id: 'integrations', label: text(AppStrings.Nav.Integrations), icon: 'puzzle', route: '/integrations' },
        { id: 'library', label: text(AppStrings.Nav.Library), icon: 'layers', route: '/library/icon-packs' },
      ],
      [{ id: 'store', label: text(AppStrings.Nav.Store), icon: 'store', route: '/store' }],
    ];
  },

  get bottomNavItems(): NavItem[] {
    return [
      {
        id: 'notifications',
        label: translateKey(AppStrings.Nav.Notifications),
        icon: 'bell',
        action: 'open-notifications',
        // The count says what is waiting; the ring says something behind it is
        // still running. Two separate signals, so both can show at once.
        indicator: notificationCenter.hasNotifications ? notificationCenter.badgeText : null,
        activity: notificationCenter.hasActiveProgress,
      },
      {
        id: 'developer',
        label: translateKey(AppStrings.Nav.DeveloperTools),
        icon: 'code',
        route: '/developer',
      },
      {
        id: 'settings',
        label: translateKey(Strings.Settings.Title),
        icon: 'settings',
        action: 'open-settings',
      },
    ];
  },
};

/**
 * Reads the persisted sidebar state and seeds the version label.
 *
 * Idempotent, and paired with stopNavigation so a test can start it more than
 * once in a single module instance.
 */
export function startNavigation(): void {
  if (started) return;
  started = true;

  userCollapsed = readPersistedCollapsed();
  appVersion = translateKey(Strings.Common.Loading);
}

export function stopNavigation(): void {
  started = false;
  userCollapsed = false;
  spaceConstrained = false;
  constraintOverride = false;
  connectionPanelOpen = false;
  notificationPanelOpen = false;
  appVersion = '';
  isBeta = false;
  isDevelopmentBuild = false;
  developmentCommit = null;
}

export function toggleSidebar(): void {
  if (navigation.isSidebarCollapsed) {
    userCollapsed = false;
    if (spaceConstrained) {
      constraintOverride = true;
    }
    writePersistedCollapsed(false);
  } else {
    userCollapsed = true;
    constraintOverride = false;
    writePersistedCollapsed(true);
  }
}

export function setSpaceConstrained(constrained: boolean): void {
  if (constrained === spaceConstrained) return;
  spaceConstrained = constrained;
  constraintOverride = false;
}

export function toggleConnectionPanel(): void {
  const open = !connectionPanelOpen;
  connectionPanelOpen = open;
  if (open) {
    notificationPanelOpen = false;
  }
}

export function closeConnectionPanel(): void {
  connectionPanelOpen = false;
}

export function toggleNotificationPanel(): void {
  const open = !notificationPanelOpen;
  notificationPanelOpen = open;
  if (open) {
    connectionPanelOpen = false;
  }
}

export function closeNotificationPanel(): void {
  notificationPanelOpen = false;
}

export function setAppVersion(
  version: string,
  beta = false,
  developmentBuild = false,
  commit: string | null = null,
): void {
  appVersion = version;
  isBeta = beta;
  isDevelopmentBuild = developmentBuild;
  developmentCommit = developmentBuild ? commit : null;
}
