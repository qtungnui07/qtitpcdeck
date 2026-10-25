<script lang="ts">
  /*
   * Stateful action button for Store extensions.
   * Handles:
   *  - Not installed -> Install
   *  - In-flight operation -> Progress bar
   *  - Failed -> Retry
   *  - Installed, update available -> Update
   *  - Installed, latest -> Installed / Uninstall
   */
  import {
    AppStrings,
    Strings,
    type StoreExtensionKind,
  } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';
  import {
    cancelStoreOperation,
    installStoreExtension,
    retryStoreOperation,
    storeOperationStore,
    uninstallStoreExtension,
  } from '$lib/store-operations.svelte';
  import {
    storeOperationPercent,
    storeOperationStateLabelKey,
  } from '$lib/store-display';
  import Button from './Button.svelte';

  interface Props {
    kind: StoreExtensionKind;
    packageId: string;
    targetVersion?: string;
    installedVersion?: string | null;
    isInstalled?: boolean;
    hasUpdate?: boolean;
    size?: 'compact' | 'md';
    onUninstallRequested?: () => void;
  }

  const {
    kind,
    packageId,
    targetVersion,
    installedVersion: _installedVersion,
    isInstalled = false,
    hasUpdate = false,
    size = 'compact',
    onUninstallRequested,
  }: Props = $props();

  const activeOp = $derived(
    storeOperationStore.findActiveOperation(kind, packageId)
  );

  const percent = $derived(
    activeOp ? storeOperationPercent(activeOp) : null
  );

  const isInstalling = $derived(
    activeOp !== null &&
      (activeOp.state === 'Queued' ||
        activeOp.state === 'Downloading' ||
        activeOp.state === 'Validating' ||
        activeOp.state === 'BackingUp' ||
        activeOp.state === 'Installing')
  );

  const isFailed = $derived(
    activeOp?.state === 'Failed'
  );

  async function handleInstall() {
    if (activeOp) return;
    await installStoreExtension(kind, packageId, targetVersion);
  }

  async function handleCancel() {
    if (!activeOp) return;
    await cancelStoreOperation(activeOp.id);
  }

  async function handleRetry() {
    if (!activeOp) return;
    await retryStoreOperation(activeOp.id);
  }

  function handleUninstall() {
    if (onUninstallRequested) {
      onUninstallRequested();
    } else {
      uninstallStoreExtension(kind, packageId);
    }
  }
</script>

<div class="store-install-button-wrapper {size}">
  {#if isInstalling}
    <div class="progress-container">
      <div class="progress-bar-fill" style="width: {percent ?? 10}%"></div>
      <span class="progress-label">
        {#if percent !== null}
          {percent}%
        {:else if activeOp}
          {translateKey(storeOperationStateLabelKey(activeOp.state) ?? AppStrings.Store.Installing)}
        {:else}
          {translateKey(Strings.Common.Loading)}
        {/if}
      </span>
      <button
        type="button"
        class="cancel-btn"
        title={translateKey(Strings.Common.Cancel)}
        onclick={handleCancel}
      >
        ✕
      </button>
    </div>
  {:else if isFailed}
    <Button variant="danger" size={size} onclick={handleRetry}>
      {translateKey(AppStrings.Store.RetryInstallation)}
    </Button>
  {:else if hasUpdate}
    <Button variant="primary" size={size} onclick={handleInstall}>
      {translateKey(AppStrings.Store.UpdateTo)}
    </Button>
  {:else if isInstalled}
    <div class="installed-group">
      <span class="installed-badge">
        ✓ {translateKey(AppStrings.Store.Installed)}
      </span>
      <button
        type="button"
        class="uninstall-icon-btn"
        title={translateKey(AppStrings.Store.Uninstall)}
        onclick={handleUninstall}
      >
        🗑
      </button>
    </div>
  {:else}
    <Button variant="primary" size={size} onclick={handleInstall}>
      {translateKey(AppStrings.Store.Install)}
    </Button>
  {/if}
</div>

<style>
  .store-install-button-wrapper {
    display: inline-flex;
    align-items: center;
  }

  .progress-container {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    min-width: 120px;
    height: 2rem;
    padding: 0 0.5rem;
    background: var(--bg-surface-secondary, #27272a);
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: var(--radius-md, 6px);
    overflow: hidden;
    font-size: 0.75rem;
  }

  .progress-bar-fill {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    background: var(--primary-accent, #3b82f6);
    opacity: 0.35;
    transition: width 0.2s ease;
    z-index: 0;
  }

  .progress-label {
    position: relative;
    z-index: 1;
    font-weight: 500;
    color: var(--text-color, #f4f4f5);
  }

  .cancel-btn {
    position: relative;
    z-index: 1;
    background: transparent;
    border: none;
    color: var(--text-muted, #a1a1aa);
    cursor: pointer;
    font-size: 0.75rem;
    padding: 2px 4px;
    border-radius: 4px;
  }

  .cancel-btn:hover {
    color: var(--danger-color, #ef4444);
    background: rgba(239, 68, 68, 0.15);
  }

  .installed-group {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .installed-badge {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--success-color, #10b981);
  }

  .uninstall-icon-btn {
    background: transparent;
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 4px;
    color: var(--text-muted, #a1a1aa);
    cursor: pointer;
    padding: 2px 6px;
    font-size: 0.8125rem;
    line-height: 1;
  }

  .uninstall-icon-btn:hover {
    color: var(--danger-color, #ef4444);
    border-color: var(--danger-color, #ef4444);
    background: rgba(239, 68, 68, 0.1);
  }

  .sm .progress-container {
    height: 1.75rem;
    min-width: 100px;
    font-size: 0.6875rem;
  }
</style>
