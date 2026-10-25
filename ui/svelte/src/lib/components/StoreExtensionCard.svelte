<script lang="ts">
  /*
   * Extension card for the Store browse/search grid.
   * Displays icon, title, publisher, trust badge, version, summary,
   * and quick install/status button. Clicking the card navigates to the detail page.
   */
  import type { StoreCatalogItemBody } from '@macro-deck/runtime';
  import { navigate } from '$lib/router.svelte';
  import {
    getStoreIconUrl,
    storeKindIcon,
    storeTrustLabelKey,
  } from '$lib/store-display';
  import { translateKey } from '$lib/localization.svelte';
  import StoreInstallButton from './StoreInstallButton.svelte';

  interface Props {
    item: StoreCatalogItemBody;
    onuninstall?: () => void;
  }

  const { item, onuninstall }: Props = $props();

  const iconUrl = $derived(
    item.hasIcon && item.iconSha256
      ? getStoreIconUrl(item.kind, item.id, item.iconSha256)
      : null
  );

  const trustKey = $derived(storeTrustLabelKey(item.kind, item.trust));

  function handleCardClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('.action-area')) {
      return;
    }
    navigate(`/store/${item.kind}/${encodeURIComponent(item.id)}`);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="store-card" onclick={handleCardClick} role="button" tabindex="0">
  <div class="card-header">
    <div class="icon-container">
      {#if iconUrl}
        <img src={iconUrl} alt={item.name} class="extension-icon" loading="lazy" />
      {:else}
        <span class="fallback-icon">{storeKindIcon(item.kind)}</span>
      {/if}
    </div>

    <div class="header-info">
      <div class="title-row">
        <h3 class="name" title={item.name}>{item.name}</h3>
        {#if trustKey}
          <span class="trust-badge" title={translateKey(trustKey)}>
            ✓
          </span>
        {/if}
      </div>

      <div class="author-row">
        <span class="author">{item.publisher ?? ''}</span>
        <span class="version">v{item.latestVersion}</span>
      </div>
    </div>
  </div>

  {#if item.description}
    <p class="summary">{item.description}</p>
  {/if}

  <div class="card-footer">
    <div class="stats">
      {#if item.installedVersion}
        <span class="installed-info">Installed: v{item.installedVersion}</span>
      {/if}
    </div>

    <div class="action-area">
      <StoreInstallButton
        kind={item.kind}
        packageId={item.id}
        targetVersion={item.latestVersion}
        installedVersion={item.installedVersion}
        isInstalled={item.installState === 'Installed' || item.installState === 'UpdateAvailable'}
        hasUpdate={item.installState === 'UpdateAvailable'}
        size="compact"
        onUninstallRequested={onuninstall}
      />
    </div>
  </div>
</div>

<style>
  .store-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 1rem;
    background: var(--bg-surface-primary, #1e1e24);
    border: 1px solid var(--border-color, #2d2d38);
    border-radius: var(--radius-lg, 8px);
    cursor: pointer;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    user-select: none;
    text-align: left;
  }

  .store-card:hover {
    transform: translateY(-2px);
    border-color: var(--primary-accent, #3b82f6);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }

  .card-header {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .icon-container {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: var(--radius-md, 6px);
    overflow: hidden;
    background: var(--bg-surface-secondary, #2a2a35);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .extension-icon {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .fallback-icon {
    font-size: 1.5rem;
  }

  .header-info {
    flex: 1;
    min-width: 0;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .name {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-color, #f4f4f5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .trust-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    font-size: 0.625rem;
    font-weight: bold;
    flex-shrink: 0;
    background: #10b981;
    color: #fff;
  }

  .author-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-muted, #a1a1aa);
    margin-top: 0.125rem;
  }

  .author {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .version {
    opacity: 0.8;
  }

  .summary {
    margin: 0.75rem 0 1rem 0;
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-muted, #a1a1aa);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 2.25rem;
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-color, #2d2d38);
    font-size: 0.75rem;
  }

  .action-area {
    flex-shrink: 0;
  }
</style>
