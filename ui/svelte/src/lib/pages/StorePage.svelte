<script lang="ts">
  /*
   * Community Store Main Page (/store).
   * Supports:
   *  - Search input with debounce
   *  - Kind filter tabs (All, Plugins, Icon Packs)
   *  - Category selector
   *  - Section selector (Popular, Recently Updated, Newest, Name)
   *  - Infinite scroll / Load more
   *  - Refresh registry button
   */
  import {
    AppStrings,
    Strings,
    type StoreCatalogSection,
    type StoreExtensionKind,
  } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';
  import {
    loadCategories,
    loadMoreCatalog,
    refreshStoreRegistry,
    reloadCatalog,
    loadCatalog,
    storeCatalogStore,
  } from '$lib/store-catalog.svelte';
  import {
    loadStoreUpdates,
    storeUpdatesStore,
  } from '$lib/store-updates.svelte';
  import {
    loadStoreOperations,
  } from '$lib/store-operations.svelte';
  import { navigate } from '$lib/router.svelte';
  import Button from '$lib/components/Button.svelte';
  import StoreExtensionCard from '$lib/components/StoreExtensionCard.svelte';

  let searchTerm = $state('');
  let selectedKind = $state<StoreExtensionKind | undefined>(undefined);
  let selectedCategory = $state<string | undefined>(undefined);
  let selectedSection = $state<StoreCatalogSection>('popular');

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function doSearch() {
    loadCatalog({
      search: searchTerm.trim() || undefined,
      kinds: selectedKind ? [selectedKind] : undefined,
      category: selectedCategory,
      section: selectedSection,
    });
  }

  function triggerSearch() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      doSearch();
    }, 250);
  }

  function handleKindChange(kind?: StoreExtensionKind) {
    selectedKind = kind;
    doSearch();
  }

  function handleSectionChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    selectedSection = target.value as StoreCatalogSection;
    doSearch();
  }

  function handleCategoryChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    selectedCategory = target.value || undefined;
    doSearch();
  }

  $effect(() => {
    loadCategories();
    loadStoreUpdates();
    loadStoreOperations();
    reloadCatalog();
  });
</script>

<div class="store-page">
  <header class="store-header">
    <div class="header-main">
      <div class="title-section">
        <h1>{translateKey(AppStrings.Store.Page.Title)}</h1>
        <p class="subtitle">{translateKey(AppStrings.Store.Page.Subtitle)}</p>
      </div>

      <div class="header-actions">
        {#if storeUpdatesStore.count > 0}
          <Button
            variant="primary"
            size="compact"
            onclick={() => navigate('/store/installed')}
          >
            {translateKey(AppStrings.Store.Page.TabInstalledWithUpdates, {
              count: storeUpdatesStore.count,
            })}
          </Button>
        {/if}

        <Button
          variant="secondary"
          size="compact"
          onclick={() => navigate('/store/installed')}
        >
          {translateKey(AppStrings.Store.Page.TabInstalled)}
        </Button>

        <Button
          variant="secondary"
          size="compact"
          disabled={storeCatalogStore.refreshing}
          onclick={() => refreshStoreRegistry()}
        >
          {storeCatalogStore.refreshing ? '⟳ …' : `⟳ ${translateKey(AppStrings.Store.Page.RefreshAction)}`}
        </Button>
      </div>
    </div>

    <!-- Controls Bar -->
    <div class="controls-bar">
      <div class="search-box">
        <input
          type="search"
          placeholder={translateKey(AppStrings.Store.Page.SearchPlaceholder)}
          bind:value={searchTerm}
          oninput={triggerSearch}
        />
      </div>

      <div class="filters">
        <div class="kind-tabs" role="tablist">
          <button
            type="button"
            class="tab-btn {!selectedKind ? 'active' : ''}"
            onclick={() => handleKindChange(undefined)}
          >
            {translateKey(AppStrings.Store.Page.KindAll)}
          </button>
          <button
            type="button"
            class="tab-btn {selectedKind === 'Plugin' ? 'active' : ''}"
            onclick={() => handleKindChange('Plugin')}
          >
            {translateKey(AppStrings.Store.Page.KindPlugins)}
          </button>
          <button
            type="button"
            class="tab-btn {selectedKind === 'IconPack' ? 'active' : ''}"
            onclick={() => handleKindChange('IconPack')}
          >
            {translateKey(AppStrings.Store.Page.KindIconPacks)}
          </button>
        </div>

        {#if storeCatalogStore.categories.length > 0}
          <select class="select-input" onchange={handleCategoryChange}>
            <option value="">{translateKey(AppStrings.Store.Page.CategoriesHeading)}</option>
            {#each storeCatalogStore.categories as cat}
              <option value={cat.id}>{cat.id}</option>
            {/each}
          </select>
        {/if}

        <select class="select-input" value={selectedSection} onchange={handleSectionChange}>
          <option value="popular">{translateKey(AppStrings.Store.Page.SortPopular)}</option>
          <option value="recentlyUpdated">{translateKey(AppStrings.Store.Page.SortRecentlyUpdated)}</option>
          <option value="newest">{translateKey(AppStrings.Store.Page.SortNewest)}</option>
          <option value="name">{translateKey(AppStrings.Store.Page.SortName)}</option>
        </select>
      </div>
    </div>
  </header>

  <main class="store-content">
    {#if storeCatalogStore.isLoading && storeCatalogStore.items.length === 0}
      <div class="loading-state">
        <span class="spinner"></span>
        <p>{translateKey(Strings.Common.Loading)}</p>
      </div>
    {:else if storeCatalogStore.loadError}
      <div class="error-state">
        <p>{storeCatalogStore.loadError}</p>
        <Button variant="secondary" onclick={() => reloadCatalog()}>
          {translateKey(Strings.Common.Retry)}
        </Button>
      </div>
    {:else if storeCatalogStore.items.length === 0}
      <div class="empty-state">
        <h2>{translateKey(AppStrings.Store.Page.NoResultsHeading)}</h2>
        <p>{translateKey(AppStrings.Store.Page.NoResultsMessage)}</p>
      </div>
    {:else}
      <div class="catalog-grid">
        {#each storeCatalogStore.items as item (item.id + item.kind)}
          <StoreExtensionCard {item} />
        {/each}
      </div>

      {#if storeCatalogStore.hasMore}
        <div class="load-more-section">
          <Button
            variant="secondary"
            disabled={storeCatalogStore.isLoadingMore}
            onclick={() => loadMoreCatalog()}
          >
            {#if storeCatalogStore.isLoadingMore}
              {translateKey(Strings.Common.Loading)}
            {:else}
              {translateKey(AppStrings.Store.Page.LoadMoreAction)}
            {/if}
          </Button>
        </div>
      {/if}
    {/if}
  </main>
</div>

<style>
  .store-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: 1.5rem 2rem;
    box-sizing: border-box;
    gap: 1.5rem;
  }

  .store-header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border-bottom: 1px solid var(--border-color, #2d2d38);
    padding-bottom: 1.25rem;
  }

  .header-main {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .title-section h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-color, #f4f4f5);
  }

  .subtitle {
    margin: 0.25rem 0 0 0;
    font-size: 0.875rem;
    color: var(--text-muted, #a1a1aa);
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .controls-bar {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
  }

  .search-box {
    flex: 1;
    min-width: 240px;
    max-width: 400px;
  }

  .search-box input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md, 6px);
    border: 1px solid var(--border-color, #3f3f46);
    background: var(--bg-surface-secondary, #18181b);
    color: var(--text-color, #f4f4f5);
    font-size: 0.875rem;
  }

  .search-box input:focus {
    outline: none;
    border-color: var(--primary-accent, #3b82f6);
  }

  .filters {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .kind-tabs {
    display: inline-flex;
    background: var(--bg-surface-secondary, #18181b);
    border-radius: var(--radius-md, 6px);
    padding: 2px;
    border: 1px solid var(--border-color, #3f3f46);
  }

  .tab-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    background: transparent;
    border: none;
    color: var(--text-muted, #a1a1aa);
    border-radius: 4px;
    cursor: pointer;
  }

  .tab-btn.active {
    background: var(--bg-surface-primary, #27272a);
    color: var(--text-color, #f4f4f5);
    font-weight: 500;
  }

  .select-input {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    border-radius: var(--radius-md, 6px);
    border: 1px solid var(--border-color, #3f3f46);
    background: var(--bg-surface-secondary, #18181b);
    color: var(--text-color, #f4f4f5);
    cursor: pointer;
  }

  .select-input:focus {
    outline: none;
    border-color: var(--primary-accent, #3b82f6);
  }

  .store-content {
    flex: 1;
  }

  .catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .load-more-section {
    display: flex;
    justify-content: center;
    padding: 2rem 0;
  }

  .loading-state,
  .empty-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1rem;
    text-align: center;
    color: var(--text-muted, #a1a1aa);
  }

  .empty-state h2 {
    color: var(--text-color, #f4f4f5);
    margin: 0 0 0.5rem 0;
  }
</style>
