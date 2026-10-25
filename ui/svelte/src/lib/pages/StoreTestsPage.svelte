<script lang="ts">
  /*
   * Store tests page (/store/tests).
   * Displays available test builds from joined test tracks,
   * allowing users to inspect and install pre-release builds.
   */
  import {
    AppStrings,
    Strings,
    type StoreTestBody,
    type StoreTestBuildBody,
  } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';
  import {
    installStoreTestBuild,
    loadStoreTests,
    storeTestsStore,
  } from '$lib/store-tests.svelte';
  import { formatBytes } from '$lib/store-display';
  import { navigate } from '$lib/router.svelte';
  import Button from '$lib/components/Button.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

  const tests = $derived(storeTestsStore.tests);
  const isLoading = $derived(storeTestsStore.isLoading);
  const loadError = $derived(storeTestsStore.loadError);

  let pendingInstall = $state<{
    test: StoreTestBody;
    build: StoreTestBuildBody;
  } | null>(null);

  function requestInstall(test: StoreTestBody, build: StoreTestBuildBody) {
    pendingInstall = { test, build };
  }

  async function handleConfirmInstall() {
    if (!pendingInstall) return;
    const { test, build } = pendingInstall;
    pendingInstall = null;
    await installStoreTestBuild(test.packageId, build.id, true);
    await loadStoreTests();
  }

  $effect(() => {
    loadStoreTests();
  });
</script>

<div class="store-tests-page">
  <header class="page-header">
    <div class="breadcrumbs">
      <button type="button" class="crumb-link" onclick={() => navigate('/store')}>
        ← {translateKey(AppStrings.Store.Page.BackToStore)}
      </button>
    </div>
    <div class="header-main">
      <div class="title-section">
        <h1>{translateKey(AppStrings.Store.Tests.Title)}</h1>
        <p class="subtitle">{translateKey(AppStrings.Store.Tests.Intro)}</p>
      </div>
    </div>
  </header>

  <main class="page-content">
    {#if isLoading}
      <div class="loading-state">
        <p>{translateKey(Strings.Common.Loading)}</p>
      </div>
    {:else if loadError}
      <div class="error-state">
        <h2>{loadError}</h2>
        <Button variant="primary" onclick={() => loadStoreTests()}>
          {translateKey(Strings.Common.Retry)}
        </Button>
      </div>
    {:else if tests.length === 0}
      <div class="empty-state">
        <h2>{translateKey(AppStrings.Store.Tests.EmptyHeading)}</h2>
        <p>{translateKey(AppStrings.Store.Tests.EmptyMessage)}</p>
      </div>
    {:else}
      <div class="tests-list">
        {#each tests as test (test.packageId)}
          <article class="test-card">
            <div class="test-header">
              <div class="test-title-col">
                <h3>{test.displayName}</h3>
                <span class="package-id">{test.packageId}</span>
              </div>
              <div class="test-status-col">
                {#if test.installedTestBuildId}
                  <span class="status-badge test-active">
                    {translateKey(AppStrings.Store.TestBuildActive)}: v{test.installedVersion}
                  </span>
                {:else if test.installedVersion}
                  <span class="status-badge store-installed">
                    {translateKey(AppStrings.Store.InstalledVersion)}: v{test.installedVersion}
                  </span>
                {/if}
              </div>
            </div>

            <div class="builds-section">
              <h4>{translateKey(AppStrings.Store.Tests.BuildLabel)}</h4>
              <div class="builds-grid">
                {#each test.builds as build (build.id)}
                  <div class="build-item {test.installedTestBuildId === build.id ? 'active-build' : ''}">
                    <div class="build-summary">
                      <span class="build-version">v{build.version}</span>
                      <span class="bullet">•</span>
                      <span class="build-size">{formatBytes(build.sizeInBytes)}</span>
                      {#if build.availableAt}
                        <span class="bullet">•</span>
                        <span class="commit">{new Date(build.availableAt).toLocaleDateString()}</span>
                      {/if}
                    </div>

                    {#if build.changelog}
                      <p class="build-changelog">{build.changelog}</p>
                    {/if}

                    <div class="build-actions">
                      {#if test.installedTestBuildId === build.id}
                        <span class="installed-tag">✓ {translateKey(AppStrings.Store.Installed)}</span>
                      {:else}
                        <Button
                          variant="primary"
                          size="compact"
                          onclick={() => requestInstall(test, build)}
                        >
                          {translateKey(AppStrings.Store.Tests.InstallTestBuild)}
                        </Button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </main>
</div>

{#if pendingInstall}
  <ConfirmDialog
    heading={translateKey(AppStrings.Store.Tests.ConfirmHeading)}
    message={translateKey(
      pendingInstall.test.installedVersion
        ? AppStrings.Store.Tests.ConfirmReplaceMessage
        : AppStrings.Store.Tests.ConfirmMessage
    )}
    confirmText={translateKey(AppStrings.Store.Install)}
    cancelText={translateKey(Strings.Common.Cancel)}
    onconfirm={handleConfirmInstall}
    oncancel={() => (pendingInstall = null)}
  />
{/if}

<style>
  .store-tests-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: 1.5rem 2.5rem;
    box-sizing: border-box;
    gap: 1.5rem;
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

  .page-header {
    border-bottom: 1px solid var(--border-color, #2d2d38);
    padding-bottom: 1.25rem;
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

  .tests-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .test-card {
    background: var(--bg-surface-secondary, #1f1f28);
    border: 1px solid var(--border-color, #2d2d38);
    border-radius: var(--radius-lg, 8px);
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .test-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid var(--border-color, #2d2d38);
    padding-bottom: 0.75rem;
  }

  .test-title-col h3 {
    margin: 0;
    font-size: 1.125rem;
    color: var(--text-color, #f4f4f5);
  }

  .package-id {
    font-size: 0.8125rem;
    color: var(--text-muted, #a1a1aa);
    font-family: var(--font-mono, monospace);
  }

  .status-badge {
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    border-radius: var(--radius-sm, 4px);
    font-weight: 600;
  }

  .status-badge.test-active {
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .status-badge.store-installed {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .builds-section h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-muted, #a1a1aa);
  }

  .builds-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .build-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--bg-surface-primary, #181820);
    border: 1px solid var(--border-color, #2d2d38);
    border-radius: var(--radius-md, 6px);
    gap: 1rem;
  }

  .build-item.active-build {
    border-color: var(--primary-accent, #3b82f6);
  }

  .build-summary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .build-version {
    font-weight: 600;
    color: var(--text-color, #f4f4f5);
  }

  .bullet {
    color: var(--text-muted, #71717a);
  }

  .build-size,
  .commit {
    font-size: 0.8125rem;
    color: var(--text-muted, #a1a1aa);
  }

  .commit {
    font-family: var(--font-mono, monospace);
  }

  .build-changelog {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-muted, #a1a1aa);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .installed-tag {
    font-size: 0.8125rem;
    color: #4ade80;
    font-weight: 600;
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
    gap: 0.5rem;
  }

  .empty-state h2 {
    color: var(--text-color, #f4f4f5);
    margin: 0;
  }
</style>
