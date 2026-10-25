<script lang="ts">
  /*
   * Installed extensions page (/store/installed).
   * Displays all currently installed extensions (Plugins, Icon Packs) with
   * update checks, batch update action, and uninstall confirmation.
   */
  import {
    AppStrings,
    Strings,
    type StoreCatalogItemBody,
    type StoreExtensionKind,
  } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';
  import {
    checkStoreUpdates,
    installAllStoreUpdates,
    loadStoreUpdates,
    storeUpdatesStore,
  } from '$lib/store-updates.svelte';
  import {
    loadStoreOperations,
    uninstallStoreExtension,
  } from '$lib/store-operations.svelte';
  import {
    loadCatalog,
    storeCatalogStore,
  } from '$lib/store-catalog.svelte';
  import { navigate } from '$lib/router.svelte';
  import Button from '$lib/components/Button.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import StoreExtensionCard from '$lib/components/StoreExtensionCard.svelte';
  import { storeUninstallMessageKey } from '$lib/store-display';

  let confirmingUninstall = $state<{
    kind: StoreExtensionKind;
    packageId: string;
    name: string;
  } | null>(null);

  // Filter catalog items to only installed ones
  const installedItems = $derived(
    storeCatalogStore.items.filter(
      item => item.installState === 'Installed' || item.installState === 'UpdateAvailable'
    )
  );

  async function handleCheckUpdates() {
    await checkStoreUpdates();
  }

  async function handleUpdateAll() {
    await installAllStoreUpdates();
  }

  function requestUninstall(item: StoreCatalogItemBody) {
    confirmingUninstall = {
      kind: item.kind,
      packageId: item.id,
      name: item.name,
    };
  }

  async function confirmUninstall() {
    if (!confirmingUninstall) return;
    const { kind, packageId } = confirmingUninstall;
    confirmingUninstall = null;
    await uninstallStoreExtension(kind, packageId);
    await loadCatalog({ installed: true });
  }

  $effect(() => {
    loadStoreUpdates();
    loadStoreOperations();
    loadCatalog({ installed: true });
  });
</script>

<div class="installed-page">
  <header class="page-header">
    <div class="header-main">
      <div class="title-section">
        <div class="breadcrumbs">
          <button type="button" class="crumb-link" onclick={() => navigate('/store')}>
            ← {translateKey(AppStrings.Store.Page.BackToStore)}
          </button>
        </div>
        <h1>{translateKey(AppStrings.Store.Page.TabInstalled)}</h1>
      </div>

      <div class="header-actions">
        {#if storeUpdatesStore.count > 0}
          <Button
            variant="primary"
            size="compact"
            disabled={storeUpdatesStore.installing}
            onclick={handleUpdateAll}
          >
            {storeUpdatesStore.installing
              ? translateKey(Strings.Common.Loading)
              : translateKey(AppStrings.Store.Page.UpdateAllAction)}
          </Button>
        {/if}

        <Button
          variant="secondary"
          size="compact"
          disabled={storeUpdatesStore.isLoading}
          onclick={handleCheckUpdates}
        >
          {storeUpdatesStore.isLoading
            ? '⟳ …'
            : `⟳ ${translateKey(AppStrings.Store.Page.RefreshAction)}`}
        </Button>
      </div>
    </div>
  </header>

  <main class="page-content">
    {#if storeCatalogStore.isLoading && installedItems.length === 0}
      <div class="loading-state">
        <p>{translateKey(Strings.Common.Loading)}</p>
      </div>
    {:else if installedItems.length === 0}
      <div class="empty-state">
        <h2>{translateKey(AppStrings.Store.Page.InstalledEmptyHeading)}</h2>
        <p>{translateKey(AppStrings.Store.Page.InstalledEmptyMessage)}</p>
        <Button variant="primary" onclick={() => navigate('/store')}>
          {translateKey(AppStrings.Store.Page.BackToStore)}
        </Button>
      </div>
    {:else}
      <div class="installed-grid">
        {#each installedItems as item (item.id + item.kind)}
          <StoreExtensionCard {item} onuninstall={() => requestUninstall(item)} />
        {/each}
      </div>
    {/if}
  </main>
</div>

{#if confirmingUninstall}
  <ConfirmDialog
    heading={translateKey(AppStrings.Store.Uninstall)}
    message={translateKey(
      storeUninstallMessageKey(confirmingUninstall.kind),
      { name: confirmingUninstall.name }
    )}
    confirmText={translateKey(Strings.Common.Delete)}
    danger={true}
    cancelText={translateKey(Strings.Common.Cancel)}
    onconfirm={confirmUninstall}
    oncancel={() => (confirmingUninstall = null)}
  />
{/if}

<style>
  .installed-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: 1.5rem 2rem;
    box-sizing: border-box;
    gap: 1.5rem;
  }

  .page-header {
    border-bottom: 1px solid var(--border-color, #2d2d38);
    padding-bottom: 1.25rem;
  }

  .header-main {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .crumb-link {
    background: transparent;
    border: none;
    color: var(--primary-accent, #3b82f6);
    font-size: 0.8125rem;
    cursor: pointer;
    padding: 0;
    margin-bottom: 0.5rem;
  }

  .crumb-link:hover {
    text-decoration: underline;
  }

  .title-section h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-color, #f4f4f5);
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .page-content {
    flex: 1;
  }

  .installed-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1rem;
    text-align: center;
    color: var(--text-muted, #a1a1aa);
    gap: 1rem;
  }

  .empty-state h2 {
    color: var(--text-color, #f4f4f5);
    margin: 0;
  }
</style>
