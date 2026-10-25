<script lang="ts">
  /*
   * One row of the notification panel, ported from the Angular
   * NotificationItemComponent: severity, title, message, progress, relative
   * time and source, the actions the host attached to it, and the read/dismiss
   * controls.
   *
   * An action this client cannot carry out yet is not rendered at all: a button
   * that does nothing is worse than no button.
   */
  import {
    AppStrings,
    type UserNotification,
    type UserNotificationAction,
    type UserNotificationActionKind,
    type UserNotificationSeverity,
    type UserNotificationSourceCategory,
  } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';
  import { SUPPORTED_NOTIFICATION_ACTIONS } from '$lib/notification-actions';

  interface Props {
    notification: UserNotification;
    onaction: (notification: UserNotification, action: UserNotificationAction) => void;
    ondismiss: (id: string) => void;
    onmarkread: (id: string) => void;
  }

  let { notification, onaction, ondismiss, onmarkread }: Props = $props();

  const SEVERITY_ICON: Record<UserNotificationSeverity, string> = {
    Info: 'info',
    Success: 'check',
    Warning: 'alert-triangle',
    Error: 'alert-triangle',
  };

  const SOURCE_CATEGORY_LABEL: Record<UserNotificationSourceCategory, string> = {
    System: AppStrings.Feedback.Notification.Source.System,
    BuiltInIntegration: AppStrings.Feedback.Notification.Source.BuiltInIntegration,
    Plugin: AppStrings.Feedback.Notification.Source.Plugin,
  };

  const ACTION_LABEL: Record<Exclude<UserNotificationActionKind, 'None'>, string> = {
    OpenIntegration: AppStrings.Shell.Notifications.Action.OpenIntegration,
    OpenLogs: AppStrings.Shell.Notifications.Action.OpenLogs,
    OpenIconPacks: AppStrings.Shell.Notifications.Action.OpenIconPacks,
    OpenUpdateSettings: AppStrings.Shell.Notifications.Action.OpenUpdateSettings,
    OpenExtensionStore: AppStrings.Shell.Notifications.Action.OpenExtensionStore,
    RestartApplication: AppStrings.Shell.Notifications.Action.RestartApplication,
    OpenUpdateDetails: AppStrings.Shell.Notifications.Action.OpenUpdateDetails,
    InstallUpdate: AppStrings.Shell.Notifications.Action.InstallUpdate,
    DismissNotification: AppStrings.Shell.Notifications.Action.DismissNotification,
    EnablePluginAdb: AppStrings.Shell.Notifications.Action.EnablePluginAdb,
    OpenDownloadPage: AppStrings.Settings.Update.OpenDownloadPageAction,
    OpenTroubleshootingGuide: AppStrings.Shell.Notifications.Action.OpenTroubleshootingGuide,
    EnablePluginCompanionDevices: AppStrings.Shell.Notifications.Action.EnablePluginAdb,
  };

  const unread = $derived(notification.read === false);

  const severityClass = $derived(`ni-sev-${notification.severity.toLowerCase()}`);
  const severityIcon = $derived(SEVERITY_ICON[notification.severity] ?? 'info');

  const sourceCategoryLabel = $derived(
    notification.sourceCategory
      ? translateKey(SOURCE_CATEGORY_LABEL[notification.sourceCategory] ?? SOURCE_CATEGORY_LABEL.Plugin)
      : null,
  );
  const sourceName = $derived(
    notification.sourceCategory && notification.sourceCategory !== 'System' ? notification.sourceName ?? null : null,
  );

  const actionList = $derived.by(() => {
    const list = notification.actions && notification.actions.length > 0
      ? notification.actions
      : notification.action ? [notification.action] : [];
    return list.filter(action => SUPPORTED_NOTIFICATION_ACTIONS.has(action.kind));
  });

  const progressPercent = $derived.by(() => {
    const progress = notification.progress;
    if (!progress || !progress.total || progress.total <= 0) return null;
    return Math.min(100, Math.round((progress.processed / progress.total) * 100));
  });

  const progressLabel = $derived.by(() => {
    const progress = notification.progress;
    if (!progress) return '';
    return progress.total != null
      ? translateKey(AppStrings.Shell.Notifications.ProcessingOfTotal, {
        processed: progress.processed,
        total: progress.total,
      })
      : translateKey(AppStrings.Shell.Notifications.ProcessingCount, { processed: progress.processed });
  });

  const relativeTime = $derived(formatRelativeTime(notification.timestamp));

  function formatRelativeTime(timestamp: string): string {
    const then = new Date(timestamp).getTime();
    if (Number.isNaN(then)) return '';

    const diffSeconds = Math.round((Date.now() - then) / 1000);
    if (diffSeconds < 60) return translateKey(AppStrings.Shell.Notifications.JustNow);

    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes < 60) return translateKey(AppStrings.Shell.Notifications.MinutesAgo, { count: diffMinutes });

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return translateKey(AppStrings.Shell.Notifications.HoursAgo, { count: diffHours });

    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) return translateKey(AppStrings.Shell.Notifications.DaysAgo, { count: diffDays });

    return new Date(timestamp).toLocaleDateString();
  }

  function labelFor(action: UserNotificationAction): string {
    if (action.kind === 'None') return '';
    return translateKey(ACTION_LABEL[action.kind]);
  }

  function onAction(event: MouseEvent, action: UserNotificationAction): void {
    event.stopPropagation();
    onaction(notification, action);
  }
</script>

<div class="ni-row" class:ni-unread={unread}>
  <span class="ni-severity {severityClass}" aria-hidden="true">
    <span class="icon icon-{severityIcon} icon-sm"></span>
  </span>

  <div class="ni-body">
    <span class="ni-title">
      {#if unread}
        <span class="ni-unread-dot" role="img" aria-label={translateKey(AppStrings.Shell.Notifications.Unread)}></span>
      {/if}
      {notification.title}
    </span>

    {#if notification.message}
      <span class="ni-message">{notification.message}</span>
    {/if}

    {#if notification.progress}
      <div
        class="ni-progress-bar"
        class:ni-progress-indeterminate={progressPercent === null}
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={progressPercent ?? undefined}
      >
        {#if progressPercent !== null}
          <div class="ni-progress-fill" style:width="{progressPercent}%"></div>
        {/if}
      </div>
      <span class="ni-progress-label">{progressLabel}</span>
    {/if}

    <span class="ni-time">
      {relativeTime}
      {#if sourceCategoryLabel !== null}
        <span class="ni-source">
          {sourceCategoryLabel}
          {#if sourceName !== null}<span class="ni-source-name">{sourceName}</span>{/if}
        </span>
      {/if}
    </span>

    {#if actionList.length > 0}
      <div class="ni-actions">
        {#each actionList as action (action.kind)}
          <button type="button" class="ni-action" onclick={event => onAction(event, action)}>
            {labelFor(action)}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="ni-controls">
    {#if unread}
      <button
        type="button"
        class="ni-control"
        title={translateKey(AppStrings.Shell.Notifications.MarkRead)}
        aria-label={translateKey(AppStrings.Shell.Notifications.MarkRead)}
        onclick={event => { event.stopPropagation(); onmarkread(notification.id); }}
      >
        <span class="icon icon-check icon-sm" aria-hidden="true"></span>
      </button>
    {/if}

    <!-- Running work has no dismiss: it goes away by finishing. -->
    {#if !notification.progress}
      <button
        type="button"
        class="ni-control"
        title={translateKey(AppStrings.Shell.Notifications.Dismiss)}
        aria-label={translateKey(AppStrings.Shell.Notifications.Dismiss)}
        onclick={event => { event.stopPropagation(); ondismiss(notification.id); }}
      >
        <span class="icon icon-x icon-sm" aria-hidden="true"></span>
      </button>
    {/if}
  </div>
</div>

<style>
  .ni-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3, 0.75rem);
    padding: var(--space-3, 0.75rem);
    border-bottom: 1px solid var(--color-border);
  }

  .ni-unread {
    background-color: color-mix(in srgb, var(--color-accent) 8%, transparent);
  }

  .ni-severity {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    flex-shrink: 0;
    border-radius: 999px;
  }

  .ni-sev-info {
    background-color: color-mix(in srgb, var(--color-accent) 18%, transparent);
    color: var(--color-accent);
  }

  .ni-sev-success {
    background-color: color-mix(in srgb, var(--color-success, #a3be8c) 20%, transparent);
    color: var(--color-success, #a3be8c);
  }

  .ni-sev-warning {
    background-color: color-mix(in srgb, var(--color-warning, #ebcb8b) 22%, transparent);
    color: var(--color-warning, #ebcb8b);
  }

  .ni-sev-error {
    background-color: color-mix(in srgb, var(--color-danger, #bf616a) 20%, transparent);
    color: var(--color-danger, #bf616a);
  }

  .ni-body {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    flex: 1;
  }

  .ni-title {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: var(--text-sm, 0.875rem);
    font-weight: var(--font-semibold, 600);
    color: var(--color-text-primary);
    overflow-wrap: anywhere;
  }

  .ni-unread-dot {
    width: 0.4rem;
    height: 0.4rem;
    flex-shrink: 0;
    border-radius: 999px;
    background-color: var(--color-accent);
  }

  .ni-message {
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary);
    overflow-wrap: anywhere;
  }

  .ni-progress-bar {
    position: relative;
    height: 0.35rem;
    overflow: hidden;
    border-radius: 999px;
    background-color: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
  }

  .ni-progress-fill {
    height: 100%;
    border-radius: inherit;
    background-color: var(--color-accent);
    transition: width 200ms ease;
  }

  .ni-progress-indeterminate::after {
    content: '';
    position: absolute;
    inset: 0;
    width: 40%;
    border-radius: inherit;
    background-color: var(--color-accent);
    animation: ni-indeterminate 1.4s ease-in-out infinite;
  }

  @keyframes ni-indeterminate {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(260%); }
  }

  .ni-progress-label,
  .ni-time {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-muted);
  }

  .ni-time {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .ni-source {
    display: inline-flex;
    gap: 0.25rem;
    align-items: center;
  }

  .ni-source::before {
    content: '·';
    margin-right: 0.25rem;
  }

  .ni-source-name {
    font-weight: var(--font-medium, 500);
  }

  .ni-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.25rem;
  }

  .ni-action {
    padding: 0.25rem 0.625rem;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: transparent;
    color: var(--color-text-primary);
    font-size: var(--text-xs, 0.75rem);
    cursor: pointer;
  }

  .ni-action:hover {
    background-color: var(--color-bg-hover, rgba(255, 255, 255, 0.06));
    border-color: var(--color-accent);
  }

  .ni-controls {
    display: flex;
    gap: 0.125rem;
    flex-shrink: 0;
  }

  .ni-control {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: none;
    border-radius: 0.375rem;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .ni-control:hover {
    color: var(--color-text-primary);
    background-color: var(--color-bg-hover, rgba(255, 255, 255, 0.06));
  }
</style>
