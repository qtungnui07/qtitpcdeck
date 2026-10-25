<script lang="ts">
  /*
   * The app root.
   *
   * Startup order matters: the theme has to be applied before the shell paints,
   * or the first frame flashes the wrong background, and the router has to be
   * listening before the shell reads the current route.
   *
   * The service stores come after the theme but before the router, because the
   * shell reads their state as it renders: the sidebar badge needs the
   * notification list, and the statusbar needs the connection state.
   *
   * The auth gate mirrors app.component's switch in the Angular app: the shell
   * only renders for an authenticated session, the first-run setup screen and
   * the admin login stand in front of it, and 'unknown' (still probing, or the
   * host unreachable) holds on the splash instead of flashing a login form the
   * next bootstrap round may never need.
   */
  import Shell from '$lib/components/Shell.svelte';
  import ShellDialogs from '$lib/components/ShellDialogs.svelte';
  import SetupScreen from '$lib/components/SetupScreen.svelte';
  import LoginScreen from '$lib/components/LoginScreen.svelte';
  import { auth } from '$lib/auth.svelte';
  import { startTheme } from '$lib/theme.svelte';
  import { startNavigation } from '$lib/navigation.svelte';
  import { startAuth } from '$lib/auth.svelte';
  import { startLocalization } from '$lib/localization.svelte';
  import { startNotificationCenter } from '$lib/notification-center.svelte';
  import { startAnnouncements } from '$lib/announcements.svelte';
  import { startVariables } from '$lib/variables.svelte';
  import { startVariableCatalog } from '$lib/variable-catalog.svelte';
  import { startIntegrations } from '$lib/integrations.svelte';
  import { startRouter } from '$lib/router.svelte';
  import { startFolders, loadFolders } from '$lib/folders.svelte';
  import { startProfiles, loadProfiles } from '$lib/profiles.svelte';
  import { startWidgetTypes, loadWidgetTypes } from '$lib/widget-types.svelte';
  import { onConnected } from '$lib/api.svelte';

  startTheme();
  startNavigation();
  startLocalization();
  startAuth();
  startNotificationCenter();
  startAnnouncements();
  startVariables();
  startVariableCatalog();
  startIntegrations();
  startFolders();
  startProfiles();
  startWidgetTypes();
  startRouter();

  /*
   * The deck's data: profiles first (the folder list is scoped to the selected
   * one), then the folders themselves. Reloaded on every (re)connect so a host
   * restart brings fresh state, the way the Angular APP_INITIALIZER plus its
   * connection handlers did.
   */
  onConnected(() => {
    void (async () => {
      await loadProfiles();
      await loadFolders();
      void loadWidgetTypes();
    })();
  });
</script>

{#if auth.state === 'authenticated'}
  <Shell />
  <ShellDialogs />
{:else if auth.state === 'setupRequired'}
  <SetupScreen />
{:else if auth.state === 'loggedOut'}
  <LoginScreen />
{:else}
  <div class="splash" role="status">
    <div class="splash-brand" aria-hidden="true"></div>
    <p class="splash-text">Connecting to the host…</p>
  </div>
{/if}

<style>
  .splash {
    min-height: 100vh;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: var(--space-4, 1rem);
    background: var(--color-bg-primary);
    color: var(--color-text-secondary);
  }

  .splash-brand {
    width: 4rem;
    height: 4rem;
    border-radius: var(--radius-lg, 10px);
    background: linear-gradient(135deg, var(--color-accent), var(--color-accent-hover, var(--color-accent)));
    animation: splash-pulse 1.2s ease-in-out infinite alternate;
  }

  @keyframes splash-pulse {
    from {
      opacity: 0.55;
    }
    to {
      opacity: 1;
    }
  }

  .splash-text {
    margin: 0;
    font-size: var(--text-sm, 0.875rem);
  }
</style>
