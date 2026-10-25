<script lang="ts">
  /*
   * Renders the page for the current route.
   *
   * Every destination is a placeholder for now - the real pages need the service
   * layer, which is phase 2. The mapping is a plain switch rather than a
   * component registry so that adding a page is a one-line change and the
   * compiler flags a route id that has no page.
   */
  import { AppStrings, bundledTranslator } from '@macro-deck/runtime';
  import { route, routeIdFor } from '$lib/router.svelte';
  import { ROUTES } from '$lib/routes';
  import PlaceholderPage from './PlaceholderPage.svelte';
  import VariablesPage from '$lib/pages/VariablesPage.svelte';
  import IntegrationsPage from '$lib/pages/IntegrationsPage.svelte';
  import IntegrationDetailPage from '$lib/pages/IntegrationDetailPage.svelte';
  import LibraryPage from '$lib/pages/LibraryPage.svelte';
  import DeckPage from '$lib/pages/DeckPage.svelte';
  import WidgetEditorPage from '$lib/pages/WidgetEditorPage.svelte';
  import StorePage from '$lib/pages/StorePage.svelte';
  import StoreInstalledPage from '$lib/pages/StoreInstalledPage.svelte';
  import StoreDetailPage from '$lib/pages/StoreDetailPage.svelte';
  import StoreTestsPage from '$lib/pages/StoreTestsPage.svelte';
  import ScriptsPage from '$lib/pages/ScriptsPage.svelte';
  import AutomationsPage from '$lib/pages/AutomationsPage.svelte';
  import DeveloperPage from '$lib/pages/DeveloperPage.svelte';

  const TITLES: Record<string, string> = {
    deck: bundledTranslator(AppStrings.Nav.Deck),
    'widget-editor': bundledTranslator(AppStrings.Nav.Deck),
    scripts: bundledTranslator(AppStrings.Nav.Scripts),
    automations: bundledTranslator(AppStrings.Nav.Automations),
    integrations: bundledTranslator(AppStrings.Nav.Integrations),
    'integration-detail': bundledTranslator(AppStrings.Nav.Integrations),
    library: bundledTranslator(AppStrings.Nav.Library),
    'library-icon-packs': bundledTranslator(AppStrings.Nav.Library),
    'library-fonts': bundledTranslator(AppStrings.Nav.Library),
    store: bundledTranslator(AppStrings.Nav.Store),
    'store-installed': bundledTranslator(AppStrings.Nav.Store),
    'store-tests': bundledTranslator(AppStrings.Nav.Store),
    'store-detail': bundledTranslator(AppStrings.Nav.Store),
    variables: bundledTranslator(AppStrings.Nav.Variables),
    developer: bundledTranslator(AppStrings.Nav.DeveloperTools),
  };

  const routeId = $derived(routeIdFor(ROUTES, route.path));
  const title = $derived((routeId !== null ? TITLES[routeId] : undefined) ?? 'Không tìm thấy trang');
</script>

{#if routeId === null}
  <div class="not-found">
    <h1>Không tìm thấy trang</h1>
    <p class="lede">Không có route nào khớp với <code>{route.path}</code>.</p>
  </div>
{:else if routeId === 'deck'}
  <DeckPage />
{:else if routeId === 'widget-editor'}
  <WidgetEditorPage />
{:else if routeId === 'scripts'}
  <ScriptsPage />
{:else if routeId === 'automations'}
  <AutomationsPage />
{:else if routeId === 'variables'}
  <VariablesPage />
{:else if routeId === 'integrations'}
  <IntegrationsPage />
{:else if routeId === 'integration-detail'}
  <IntegrationDetailPage />
{:else if routeId === 'library' || routeId === 'library-icon-packs' || routeId === 'library-fonts'}
  <LibraryPage />
{:else if routeId === 'store'}
  <StorePage />
{:else if routeId === 'store-installed'}
  <StoreInstalledPage />
{:else if routeId === 'store-tests'}
  <StoreTestsPage />
{:else if routeId === 'store-detail'}
  <StoreDetailPage kind={route.params.kind as any} packageId={route.params.extensionId ?? ''} />
{:else if routeId === 'developer'}
  <DeveloperPage />
{:else}
  <PlaceholderPage {title} {routeId} params={route.params} />
{/if}

<style>
  .not-found {
    padding: var(--space-6) var(--space-5);
    max-width: 48rem;
  }

  h1 {
    margin: 0 0 var(--space-3);
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
  }

  .lede {
    margin: 0;
    color: var(--color-text-secondary);
  }

  code {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    padding: 0.125rem var(--space-2);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-tertiary);
    color: var(--color-accent);
  }
</style>
