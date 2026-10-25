<script lang="ts">
  /*
   * The sidebar rail.
   *
   * The width is driven by the collapsed state rather than by a CSS class, so
   * the transition runs on the same property the layout reads. The icon column
   * width is published as a custom property because the nav items size their
   * first grid column from it.
   */
  import NavItem from './NavItem.svelte';
  import {
    SIDEBAR_COLLAPSED_WIDTH,
    SIDEBAR_EXPANDED_WIDTH,
    navigation,
    type NavItem as NavItemModel,
  } from '$lib/navigation.svelte';

  interface Props {
    activeRouteId: string | null;
    activeAction?: string | null;
    onAction?: (action: string) => void;
  }

  let { activeRouteId, activeAction = null, onAction = () => {} }: Props = $props();

  const collapsedWidthCss = `${SIDEBAR_COLLAPSED_WIDTH}px`;

  /*
   * Read through a local derived rather than inline in the template. The store
   * exposes `isSidebarCollapsed` as a getter on a plain object, and a template
   * expression that reads it inside a `style:` directive is not re-evaluated
   * when the underlying rune changes - the class binding happens to work, the
   * style binding does not. A `$derived` gives the compiler a dependency it can
   * track.
   */
  const isCollapsed = $derived(navigation.isSidebarCollapsed);
  const widthPx = $derived(isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH);

  function isActive(item: NavItemModel): boolean {
    if (item.action !== undefined) {
      return item.action === activeAction;
    }
    return item.route !== undefined && item.id === activeRouteId;
  }
</script>

<aside
  class="sidebar"
  class:collapsed={isCollapsed}
  style:--sidebar-collapsed-width={collapsedWidthCss}
  style:width="{widthPx}px"
>
  <nav class="sidebar-main">
    {#each navigation.mainNavGroups as group, index (index)}
      <div class="sidebar-group">
        {#each group as item (item.id)}
          <NavItem {item} isCollapsed={isCollapsed} active={isActive(item)} {onAction} />
        {/each}
      </div>
      {#if index < navigation.mainNavGroups.length - 1}
        <div class="sidebar-divider" aria-hidden="true"></div>
      {/if}
    {/each}
  </nav>

  <div class="sidebar-divider"></div>

  <nav class="sidebar-bottom">
    {#each navigation.bottomNavItems as item (item.id)}
      <NavItem {item} isCollapsed={isCollapsed} active={isActive(item)} {onAction} />
    {/each}
  </nav>
</aside>

<style>
  .sidebar {
    /*
     * Icon column of every nav item: exactly the content width of the collapsed
     * rail, so an icon sits centred while collapsed and on that same x while
     * expanded. Nothing in an item then moves during the width transition.
     */
    --nav-icon-column: calc(var(--sidebar-collapsed-width) - 1px - 2 * var(--space-2));
    height: 100%;
    background-color: var(--color-bg-secondary);
    border-inline-end: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    transition: width var(--transition-slow);
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .sidebar {
      transition: none;
    }
  }

  /*
   * The nav column is the part that gives when the window is too short for every
   * destination: it scrolls, while the bottom section stays put. The x-axis stays
   * clipped for the label width transition.
   */
  .sidebar-main {
    flex: 1;
    padding: var(--space-2);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    overflow-x: hidden;
    overflow-y: auto;
  }

  /* Items inside a group sit tight together; the gap above separates the groups. */
  .sidebar-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  /* Every divider spans exactly the width of the items above and below it. */
  .sidebar-divider {
    border-top: 1px solid var(--color-border);
  }

  /* The one between the two sections sits outside their padding, so it carries the gutter itself. */
  .sidebar > .sidebar-divider {
    margin-inline: var(--space-2);
  }

  .sidebar-bottom {
    flex-shrink: 0;
    padding: var(--space-2);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    overflow: hidden;
  }
</style>
