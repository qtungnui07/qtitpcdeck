/*
 * Which notification actions this client can carry out.
 *
 * The host ships actions for surfaces the Svelte port does not own yet
 * (restarting the shell, installing a host update, granting plugin ADB or
 * companion-device consent). Offering those buttons would be a dead end, so
 * they are left out until the service behind them exists here.
 */

import type { UserNotificationActionKind } from '@macro-deck/runtime';

export const SUPPORTED_NOTIFICATION_ACTIONS: ReadonlySet<UserNotificationActionKind> = new Set<UserNotificationActionKind>([
  'OpenIntegration',
  'OpenLogs',
  'OpenIconPacks',
  'OpenUpdateSettings',
  'OpenExtensionStore',
  'OpenUpdateDetails',
  'DismissNotification',
  'OpenDownloadPage',
  'OpenTroubleshootingGuide',
]);
