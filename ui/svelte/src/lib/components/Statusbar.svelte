<script lang="ts">
  /*
   * The window's title bar.
   *
   * Inside the Tauri shell this bar is the drag region, and on macOS it has to
   * clear the native traffic lights - hence the spacer and the `data-tauri-drag-region`
   * attributes. The profile selector that normally sits in the centre needs the
   * deck store, so the centre is empty until that page is migrated.
   */
  import { AppStrings } from '@macro-deck/runtime';
  import { navigation, toggleConnectionPanel, toggleSidebar } from '$lib/navigation.svelte';
  import { translateKey } from '$lib/localization.svelte';
  import { api } from '$lib/api.svelte';
  import { shellBridge } from '$lib/shell-bridge';

  const isShell = shellBridge() !== undefined;
  const isMacOS = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
  const isShellMacOS = isShell && isMacOS;

  const connectionPanelTitle = $derived(translateKey(AppStrings.Shell.ConnectionPanel.Title));
  const developmentBuildLabel = $derived(translateKey(AppStrings.Shell.Statusbar.DevelopmentBuild));

  /*
   * The connection state is read through a local derived for the same reason the
   * sidebar width is: a template expression that reads a getter on a plain
   * object is not a dependency the compiler can track.
   */
  const connectionState = $derived(api.connectionState);
  const isConnected = $derived(api.isConnected);
</script>

<header class="statusbar" data-tauri-drag-region={isShell ? '' : undefined}>
  <div class="statusbar-left" data-tauri-drag-region={isShell ? '' : undefined}>
    {#if isShellMacOS}
      <div class="traffic-light-spacer" data-tauri-drag-region=""></div>
    {/if}
    <button class="toggle-btn" onclick={toggleSidebar} aria-label="Toggle sidebar">
      <span class="icon icon-sidebar icon-lg" class:rotated={navigation.isSidebarCollapsed}></span>
    </button>
    {#if navigation.isDevelopmentBuild}
      <span class="build-channel-badge" data-tauri-drag-region={isShell ? '' : undefined}>
        {developmentBuildLabel}
      </span>
    {/if}
  </div>

  <div class="statusbar-center" data-tauri-drag-region={isShell ? '' : undefined}></div>

  <div class="statusbar-right" data-tauri-drag-region={isShell ? '' : undefined}>
    <span
      class="connection-dot"
      class:connected={isConnected}
      data-state={connectionState}
      title={connectionState}
      aria-hidden="true"
    ></span>
    <button
      type="button"
      class="toggle-btn"
      class:active={navigation.isConnectionPanelOpen}
      aria-pressed={navigation.isConnectionPanelOpen}
      aria-label={connectionPanelTitle}
      title={connectionPanelTitle}
      onclick={toggleConnectionPanel}
    >
      <span class="icon icon-wifi icon-lg"></span>
    </button>
  </div>
</header>

<style>
  /*
   * This bar is the window's title bar inside the macOS shell, and the native
   * traffic lights are centered against its height by STATUS_BAR_HEIGHT in
   * ui/bootstrapper/src/window.rs. Changing the height means changing that too -
   * the 3.25rem is 52px at the default 16px root.
   */
  .statusbar {
    height: 3.25rem;
    background-color: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 0 var(--space-4);
    flex-shrink: 0;
  }

  /*
   * Clears the native traffic lights. The shell insets them 19pt from the left,
   * as far as from the top, so the block ends 79pt in (19 + two 23pt gaps + a
   * 14pt button) and this leaves 3px of slack. px, not rem: the buttons are a
   * native size and ignore the root font size, so a rem spacer would drift onto
   * them when the reader enlarges their browser font.
   */
  .traffic-light-spacer {
    width: 82px;
    flex-shrink: 0;
  }

  .statusbar-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  /*
   * The sidebar toggle sits on the same vertical line as the nav icons below it:
   * the collapsed rail is centred on half its own width (its border aside), and
   * the bar's own padding is taken off. Only when it leads the bar - behind the
   * macOS traffic lights there is no line to meet.
   */
  .statusbar-left > .toggle-btn:first-child {
    margin-inline-start: calc(
      (var(--sidebar-collapsed-width, 4rem) - 1px - var(--control-height-compact)) / 2 - var(--space-4)
    );
  }

  /* Inlined from the Angular `ds.badge` mixin - the Svelte app has no Sass. */
  .build-channel-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0.125rem var(--space-2);
    border-radius: 999px;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    line-height: var(--leading-tight);
    white-space: nowrap;

    flex-shrink: 0;
    border: 1px solid color-mix(in srgb, var(--color-warning) 42%, transparent);
    background-color: var(--color-warning-muted);
    color: var(--color-warning);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    user-select: none;
  }

  .toggle-btn {
    width: var(--control-height-compact);
    height: var(--control-height-compact);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    background: none;
    border: none;
    color: var(--color-text-secondary);
    transition: all var(--transition-normal);
  }

  .toggle-btn:hover {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  /* Marks the panel a toggle owns as open (the network side panel). */
  .toggle-btn.active {
    background-color: var(--color-accent-muted);
    color: var(--color-accent);
  }

  .toggle-btn .icon {
    transition: transform var(--transition-slow);
  }

  .toggle-btn .icon.rotated {
    transform: rotate(180deg);
  }

  .statusbar-center {
    display: flex;
    justify-content: center;
  }

  .statusbar-right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  /*
   * The connection state, as a dot rather than a word: the statusbar has no room
   * for text, and the state is a colour the reader learns once. The title carries
   * the word for anyone who needs it.
   */
  .connection-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background-color: var(--color-text-muted);
    flex-shrink: 0;
    transition: background-color var(--transition-normal);
  }

  .connection-dot[data-state='connecting'],
  .connection-dot[data-state='reconnecting'] {
    background-color: var(--color-warning);
  }

  .connection-dot.connected {
    background-color: var(--color-success);
  }
</style>
