<script lang="ts">
  /*
   * The notification panel behind the sidebar bell, ported from the Angular
   * NotificationPanelComponent.
   *
   * The list itself lives in the notification-center store (fed by the
   * UserNotificationsChangedEvent push); this is the surface that reads it, the
   * read/clear controls, and the dispatcher for the actions the host attaches
   * to an entry.
   */
  import {
    AppStrings,
    type UserNotification,
    type UserNotificationAction,
  } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';
  import { closeNotificationPanel } from '$lib/navigation.svelte';
  import {
    dismiss,
    dismissAll,
    markAllRead,
    markRead,
    notificationCenter,
  } from '$lib/notification-center.svelte';
  import { navigate } from '$lib/router.svelte';
  import { openSettings } from '$lib/settings-modal.svelte';
  import { openExternal } from '$lib/external-link';
  import SidePanel from './SidePanel.svelte';
  import NotificationItem from './NotificationItem.svelte';
  import EmptyState from './EmptyState.svelte';

  interface Props {
    open: boolean;
  }

  let { open }: Props = $props();

  const DOWNLOAD_PAGE_URL = 'https://macro-deck.app/download';
  const TROUBLESHOOTING_GUIDE_URL = 'https://docs.macro-deck.app/guide/troubleshooting/';

  function onAction(notification: UserNotification, action: UserNotificationAction): void {
    switch (action.kind) {
      case 'OpenIntegration':
        if (action.target) navigate(`/integrations/${encodeURIComponent(action.target)}`);
        break;
      case 'OpenLogs':
        navigate('/developer');
        break;
      case 'OpenIconPacks':
        navigate('/library/icon-packs');
        break;
      case 'OpenUpdateSettings':
        openSettings('about');
        break;
      case 'OpenExtensionStore':
        navigate(action.target === 'installed' ? '/store/installed' : '/store');
        break;
      case 'OpenUpdateDetails':
        // The update dialog is not ported yet; its settings section carries the
        // update controls that do exist here.
        openSettings('about');
        break;
      case 'DismissNotification':
        dismiss(notification.id);
        return;
      case 'OpenDownloadPage':
        openExternal(DOWNLOAD_PAGE_URL);
        break;
      case 'OpenTroubleshootingGuide':
        openExternal(action.target
          ? `${TROUBLESHOOTING_GUIDE_URL}#${encodeURIComponent(action.target)}`
          : TROUBLESHOOTING_GUIDE_URL);
        break;
      default:
        return;
    }

    closeNotificationPanel();
  }
</script>

{#if open}
  <SidePanel
    open
    edge="end"
    width="26rem"
    heading={translateKey(AppStrings.Nav.Notifications)}
    closeLabel={translateKey(AppStrings.Shell.Notifications.Close)}
    onclose={closeNotificationPanel}
  >
    {#snippet actions()}
      {#if notificationCenter.hasUnread}
        <button type="button" class="np-header-btn" onclick={markAllRead}>
          {translateKey(AppStrings.Shell.Notifications.MarkAllRead)}
        </button>
      {/if}
      {#if notificationCenter.hasDismissable}
        <button type="button" class="np-header-btn" onclick={dismissAll}>
          {translateKey(AppStrings.Shell.Notifications.ClearAll)}
        </button>
      {/if}
    {/snippet}

    <div class="np-body">
      {#if notificationCenter.notifications.length === 0}
        <EmptyState
          compact
          icon="bell"
          heading={translateKey(AppStrings.Shell.Notifications.EmptyHeading)}
          message={translateKey(AppStrings.Shell.Notifications.EmptyMessage)}
        />
      {:else}
        <div class="np-list">
          {#each notificationCenter.notifications as notification (notification.id)}
            <NotificationItem
              {notification}
              onaction={onAction}
              ondismiss={dismiss}
              onmarkread={markRead}
            />
          {/each}
        </div>
      {/if}
    </div>
  </SidePanel>
{/if}

<style>
  .np-body {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .np-list {
    display: flex;
    flex-direction: column;
    margin: 0 calc(-1 * var(--space-3, 0.75rem));
  }

  .np-header-btn {
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 0.375rem;
    background: transparent;
    color: var(--color-text-secondary);
    font-size: var(--text-xs, 0.75rem);
    cursor: pointer;
    white-space: nowrap;
  }

  .np-header-btn:hover {
    color: var(--color-text-primary);
    background-color: var(--color-bg-hover, rgba(255, 255, 255, 0.06));
  }
</style>
