<script lang="ts">
  /*
   * The app shell: statusbar, sidebar, routed content, footer.
   *
   * The Angular shell also mounted six modals (settings, update, what's new,
   * announcement, rating prompt, GitHub star prompt) and two side panels. All of
   * those need services that arrive in phase 2, so the shell renders the frame
   * and the routed page only. The connection panel toggle in the statusbar is
   * wired to the navigation store so the button is not dead, but nothing renders
   * behind it yet.
   *
   * The ResizeObserver is the one piece of behaviour worth keeping now: it is
   * what collapses the sidebar on a narrow window, and it is independent of the
   * service layer.
   */
  import { onMount } from 'svelte';
  import Statusbar from './Statusbar.svelte';
  import Sidebar from './Sidebar.svelte';
  import FooterBar from './FooterBar.svelte';
  import RouteView from './RouteView.svelte';
  import ToastHost from './ToastHost.svelte';
  import ConnectionPanel from './ConnectionPanel.svelte';
  import NotificationPanel from './NotificationPanel.svelte';
  import { route, routeIdFor } from '$lib/router.svelte';
  import { ROUTES } from '$lib/routes';
  import {
    SIDEBAR_COLLAPSED_WIDTH,
    isWorkspaceConstrained,
    navigation,
    setSpaceConstrained,
    toggleNotificationPanel,
  } from '$lib/navigation.svelte';
  import { openSettings } from '$lib/settings-modal.svelte';

  let shellContent = $state<HTMLElement | null>(null);

  const activeRouteId = $derived(routeIdFor(ROUTES, route.path));

  const activeNavAction = $derived(
    navigation.isNotificationPanelOpen ? 'open-notifications' : null,
  );

  const collapsedSidebarWidthCss = `${SIDEBAR_COLLAPSED_WIDTH}px`;

  function onNavAction(action: string): void {
    if (action === 'open-notifications') {
      toggleNotificationPanel();
    } else if (action === 'open-settings') {
      openSettings();
    }
  }

  onMount(() => {
    const element = shellContent;
    if (element === null) return;

    /*
     * The full sidebar+main row: its width does not depend on the sidebar's own
     * collapsed state, so measuring it (rather than .shell-main) cannot feed
     * back into itself.
     */
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? element.getBoundingClientRect().width;
      const rootFontSizePx = parseFloat(getComputedStyle(document.documentElement).fontSize);
      setSpaceConstrained(isWorkspaceConstrained(width, rootFontSizePx));
    });
    observer.observe(element);

    return () => observer.disconnect();
  });
</script>

<div class="shell" style:--sidebar-collapsed-width={collapsedSidebarWidthCss}>
  <Statusbar />

  <div class="shell-content" bind:this={shellContent}>
    <Sidebar {activeRouteId} activeAction={activeNavAction} onAction={onNavAction} />

    <main class="shell-main">
      <RouteView />
    </main>
  </div>

  <FooterBar />

  <ToastHost />

  <ConnectionPanel open={navigation.isConnectionPanelOpen} />

  <NotificationPanel open={navigation.isNotificationPanelOpen} />
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: var(--font-sans);
    font-size: var(--text-base);
    line-height: var(--leading-normal);
  }

  .shell-content {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  .shell-main {
    flex: 1;
    min-width: 0;
    overflow: auto;
  }
</style>
