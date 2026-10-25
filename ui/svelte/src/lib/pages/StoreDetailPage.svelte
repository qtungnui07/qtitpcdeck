<script lang="ts">
  /*
   * Extension detail page (/store/:kind/:packageId).
   * Displays full description, screenshots, trust badge, rating breakdown,
   * dependencies, repository links, issues list, and action buttons.
   */
  import {
    AppStrings,
    Strings,
    type StoreExtensionKind,
  } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';
  import {
    loadStoreDetail,
    loadStoreIssues,
    loadStoreSimilar,
    storeDetailStore,
  } from '$lib/store-detail.svelte';
  import {
    formatBytes,
    getStoreIconUrl,
    getStoreScreenshotUrl,
    storeKindIcon,
    storeKindLabelKey,
    storeTrustLabelKey,
  } from '$lib/store-display';
  import { navigate } from '$lib/router.svelte';
  import Button from '$lib/components/Button.svelte';
  import StoreInstallButton from '$lib/components/StoreInstallButton.svelte';
  import StoreCommunityNotice from '$lib/components/StoreCommunityNotice.svelte';
  import StoreExtensionCard from '$lib/components/StoreExtensionCard.svelte';

  interface Props {
    kind: StoreExtensionKind;
    packageId: string;
  }

  const { kind, packageId }: Props = $props();

  const extension = $derived(storeDetailStore.extension);
  const trustKey = $derived(
    extension ? storeTrustLabelKey(extension.kind, extension.trust) : null
  );
  const iconUrl = $derived(
    extension?.iconSha256
      ? getStoreIconUrl(kind, packageId, extension.iconSha256)
      : null
  );

  let selectedScreenshot = $state<string | null>(null);

  $effect(() => {
    if (kind && packageId) {
      loadStoreDetail(kind, packageId);
      loadStoreIssues(kind, packageId);
      loadStoreSimilar(kind, packageId);
    }
  });
</script>

<div class="store-detail-page">
  <div class="top-nav">
    <button type="button" class="back-link" onclick={() => navigate('/store')}>
      ← {translateKey(AppStrings.Store.Page.BackToStore)}
    </button>
  </div>

  {#if storeDetailStore.isLoading}
    <div class="loading-state">
      <p>{translateKey(Strings.Common.Loading)}</p>
    </div>
  {:else if storeDetailStore.loadError || !extension}
    <div class="error-state">
      <h2>{storeDetailStore.loadError ?? 'Not Found'}</h2>
      <Button variant="primary" onclick={() => navigate('/store')}>
        {translateKey(AppStrings.Store.Page.BackToStore)}
      </Button>
    </div>
  {:else}
    <div class="detail-container">
      <!-- Main Header Banner -->
      <header class="detail-header">
        <div class="header-identity">
          <div class="icon-frame">
            {#if iconUrl}
              <img src={iconUrl} alt={extension.name} class="detail-icon" />
            {:else}
              <span class="detail-fallback-icon">{storeKindIcon(extension.kind)}</span>
            {/if}
          </div>

          <div class="identity-info">
            <div class="title-row">
              <h1>{extension.name}</h1>
              {#if trustKey}
                <span class="trust-badge verified">
                  ✓ {translateKey(trustKey)}
                </span>
              {/if}
            </div>

            <div class="meta-row">
              {#if extension.publisher}
                <span class="author">by {extension.publisher}</span>
                <span class="bullet">•</span>
              {/if}
              <span class="kind-label">{translateKey(storeKindLabelKey(extension.kind) ?? AppStrings.Store.KindLabel.Plugin)}</span>
              <span class="bullet">•</span>
              <span class="version">v{extension.latestVersion}</span>
              {#if extension.downloadSize}
                <span class="bullet">•</span>
                <span class="size">{formatBytes(extension.downloadSize)}</span>
              {/if}
            </div>
          </div>
        </div>

        <div class="header-actions">
          <StoreInstallButton
            kind={extension.kind}
            packageId={extension.id}
            targetVersion={extension.latestVersion}
            installedVersion={extension.installedVersion}
            isInstalled={extension.installState === 'Installed' || extension.installState === 'UpdateAvailable'}
            hasUpdate={extension.installState === 'UpdateAvailable'}
            size="md"
          />
        </div>
      </header>

      {#if extension.trust !== 'PublisherVerified'}
        <StoreCommunityNotice publisher={extension.publisher ?? ''} />
      {/if}

      <!-- Screenshots Carousel/List -->
      {#if extension.screenshots && extension.screenshots.length > 0}
        <section class="screenshots-section">
          <h2>Screenshots</h2>
          <div class="screenshots-list">
            {#each extension.screenshots as screenshot}
              {@const url = getStoreScreenshotUrl(extension.kind, extension.id, screenshot.index, screenshot.sha256 ?? '')}
              <button
                type="button"
                class="screenshot-thumb-btn"
                onclick={() => (selectedScreenshot = url)}
              >
                <img src={url} alt={screenshot.caption ?? `Screenshot ${screenshot.index + 1}`} loading="lazy" />
              </button>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Body Grid: Description + Sidebar Meta -->
      <div class="content-grid">
        <main class="main-column">
          <section class="description-section">
            <h2>{translateKey(AppStrings.Store.Page.Tabs.Description)}</h2>
            <div class="description-text">
              {#if extension.longDescription}
                <pre class="markdown-preview">{extension.longDescription}</pre>
              {:else if extension.description}
                <p>{extension.description}</p>
              {/if}
            </div>
          </section>

          <!-- Issues Section if available -->
          {#if storeDetailStore.issues && storeDetailStore.issues.issues?.length}
            <section class="issues-section">
              <h2>Issues</h2>
              <div class="issues-list">
                {#each storeDetailStore.issues.issues as issue}
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noreferrer"
                    class="issue-row"
                  >
                    <span class="issue-number">#{issue.number}</span>
                    <span class="issue-title">{issue.title}</span>
                  </a>
                {/each}
              </div>
            </section>
          {/if}
        </main>

        <aside class="side-column">
          <div class="meta-card">
            <h3>{translateKey(AppStrings.Store.Page.DetailsHeading)}</h3>

            {#if extension.publisher}
              <div class="meta-item">
                <span class="meta-label">{translateKey(AppStrings.Store.Page.PublisherField)}</span>
                <span class="meta-val">{extension.publisher}</span>
              </div>
            {/if}

            {#if extension.license}
              <div class="meta-item">
                <span class="meta-label">{translateKey(AppStrings.Store.Page.LicenseField)}</span>
                <span class="meta-val">{extension.license}</span>
              </div>
            {/if}

            {#if extension.downloadSize}
              <div class="meta-item">
                <span class="meta-label">{translateKey(AppStrings.Store.Page.SizeField)}</span>
                <span class="meta-val">{formatBytes(extension.downloadSize)}</span>
              </div>
            {/if}

            {#if extension.homepage}
              <div class="meta-item">
                <span class="meta-label">{translateKey(AppStrings.Store.Page.HomepageLink)}</span>
                <a
                  href={extension.homepage}
                  target="_blank"
                  rel="noreferrer"
                  class="meta-link"
                >
                  Homepage ↗
                </a>
              </div>
            {/if}

            {#if extension.repository}
              <div class="meta-item">
                <span class="meta-label">{translateKey(AppStrings.Store.Page.RepositoryLink)}</span>
                <a
                  href={extension.repository}
                  target="_blank"
                  rel="noreferrer"
                  class="meta-link"
                >
                  Repository ↗
                </a>
              </div>
            {/if}
          </div>
        </aside>
      </div>

      <!-- Similar Items Section -->
      {#if storeDetailStore.similar.length > 0}
        <section class="similar-section">
          <h2>{translateKey(AppStrings.Store.Page.SimilarHeading)}</h2>
          <div class="similar-grid">
            {#each storeDetailStore.similar as item (item.id + item.kind)}
              <StoreExtensionCard {item} />
            {/each}
          </div>
        </section>
      {/if}
    </div>
  {/if}
</div>

{#if selectedScreenshot}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="lightbox"
    role="dialog"
    tabindex="-1"
    onclick={() => (selectedScreenshot = null)}
  >
    <img src={selectedScreenshot} alt="Enlarged screenshot" />
  </div>
{/if}

<style>
  .store-detail-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: 1.5rem 2.5rem;
    box-sizing: border-box;
    gap: 1.5rem;
  }

  .back-link {
    background: transparent;
    border: none;
    color: var(--primary-accent, #3b82f6);
    font-size: 0.875rem;
    cursor: pointer;
    padding: 0;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .detail-container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border-color, #2d2d38);
  }

  .header-identity {
    display: flex;
    gap: 1.25rem;
    align-items: center;
  }

  .icon-frame {
    width: 72px;
    height: 72px;
    border-radius: var(--radius-lg, 12px);
    overflow: hidden;
    background: var(--bg-surface-secondary, #2a2a35);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .detail-icon {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .detail-fallback-icon {
    font-size: 2.5rem;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .title-row h1 {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-color, #f4f4f5);
  }

  .trust-badge {
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .trust-badge.verified {
    background: #10b981;
    color: #fff;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-muted, #a1a1aa);
    margin: 0.25rem 0;
  }

  .bullet {
    opacity: 0.5;
  }

  .screenshots-section h2,
  .description-section h2,
  .issues-section h2,
  .similar-section h2 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-color, #f4f4f5);
    margin: 0 0 1rem 0;
  }

  .screenshots-list {
    display: flex;
    gap: 1rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
  }

  .screenshot-thumb-btn {
    border: 1px solid var(--border-color, #2d2d38);
    background: transparent;
    padding: 0;
    border-radius: var(--radius-md, 6px);
    overflow: hidden;
    cursor: pointer;
    flex-shrink: 0;
    width: 240px;
    height: 140px;
  }

  .screenshot-thumb-btn img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .content-grid {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 2rem;
  }

  .markdown-preview {
    font-family: inherit;
    white-space: pre-wrap;
    line-height: 1.6;
    color: var(--text-color, #d4d4d8);
    margin: 0;
  }

  .meta-card {
    background: var(--bg-surface-primary, #1e1e24);
    border: 1px solid var(--border-color, #2d2d38);
    border-radius: var(--radius-lg, 8px);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .meta-card h3 {
    margin: 0 0 0.5rem 0;
    font-size: 0.9375rem;
    color: var(--text-color, #f4f4f5);
  }

  .meta-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.8125rem;
  }

  .meta-label {
    color: var(--text-muted, #a1a1aa);
  }

  .meta-val {
    color: var(--text-color, #f4f4f5);
  }

  .meta-link {
    color: var(--primary-accent, #3b82f6);
    text-decoration: none;
  }

  .meta-link:hover {
    text-decoration: underline;
  }

  .similar-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .lightbox {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 2rem;
  }

  .lightbox img {
    max-width: 90vw;
    max-height: 90vh;
    object-fit: contain;
    border-radius: 8px;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1rem;
    text-align: center;
    gap: 1rem;
  }
</style>
