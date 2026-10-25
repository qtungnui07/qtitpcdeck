<script lang="ts">
  /*
   * The connection panel, ported from the Angular ConnectionPanelComponent:
   * the QR + pairing code a phone pairs through, the instance identity, and
   * the addresses the host listens on, each expandable into links to the
   * configuration UI and the web client.
   *
   * The Angular version rendered this in a side panel; the Svelte app has no
   * side-panel frame yet, so it rides the standard modal until that exists.
   */
  import { AppStrings, type ConnectionEndpoint } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';
  import { closeConnectionPanel } from '$lib/navigation.svelte';
  import { connectionInfo, groupEndpoints, loadConnectionInfo } from '$lib/connection-info.svelte';
  import SidePanel from './SidePanel.svelte';
  import ConnectQr from './ConnectQr.svelte';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  let expanded = $state<string | null>(null);

  const groups = $derived(connectionInfo.info ? groupEndpoints(connectionInfo.info.endpoints) : []);
  const anySsl = $derived((connectionInfo.info?.endpoints ?? []).some((endpoint) => endpoint.ssl));

  $effect(() => {
    if (open) {
      void loadConnectionInfo();
    }
  });

  function endpointKey(endpoint: ConnectionEndpoint): string {
    return `${endpoint.ssl ? 'https' : 'http'}://${endpoint.address}:${endpoint.port}`;
  }

  function sslLabel(endpoint: ConnectionEndpoint): string {
    return translateKey(
      endpoint.ssl
        ? AppStrings.Shell.ConnectionPanel.EncryptedConnection
        : AppStrings.Shell.ConnectionPanel.UnencryptedConnection,
    );
  }

  function toggle(endpoint: ConnectionEndpoint): void {
    const key = endpointKey(endpoint);
    expanded = expanded === key ? null : key;
  }

  function openEndpoint(endpoint: ConnectionEndpoint, target: 'config' | 'client'): void {
    const suffix = target === 'client' ? '' : '/admin';
    window.open(`${endpointKey(endpoint)}${suffix}`, '_blank', 'noopener,noreferrer');
    expanded = null;
    closeConnectionPanel();
  }
</script>

{#if open}
  <SidePanel
    open
    edge="end"
    width="24rem"
    heading={translateKey(AppStrings.Shell.ConnectionPanel.Title)}
    closeLabel={translateKey(AppStrings.Shell.ConnectionPanel.Close)}
    onclose={closeConnectionPanel}
  >
    <div class="cp-body">
      {#if connectionInfo.loading}
        <div class="cp-placeholder">{translateKey(AppStrings.Shell.ConnectionPanel.Loading)}</div>
      {:else if connectionInfo.info === null}
        <div class="cp-placeholder">{translateKey(AppStrings.Shell.ConnectionPanel.Unavailable)}</div>
      {:else if connectionInfo.info.publicListenerUnavailable}
        <div class="cp-placeholder">
          {translateKey(AppStrings.Shell.ConnectionPanel.PublicListenerUnavailable)}
        </div>
      {:else}
        <ConnectQr info={connectionInfo.info} />

        <div class="cp-section">
          <span class="cp-label">{translateKey(AppStrings.Shell.ConnectionPanel.Identity)}</span>
          {#if connectionInfo.info.identityFingerprint}
            <span class="cp-fingerprint">{connectionInfo.info.identityFingerprint}</span>
          {:else}
            <span class="cp-value cp-muted">{translateKey(AppStrings.Shell.ConnectionPanel.IdentityUnavailable)}</span>
          {/if}
        </div>

        <div class="cp-section">
          <span class="cp-label">{translateKey(AppStrings.Shell.ConnectionPanel.Instance)}</span>
          <span class="cp-value">{connectionInfo.info.instanceName}</span>
        </div>

        <div class="cp-section">
          <span class="cp-label">{translateKey(AppStrings.Shell.ConnectionPanel.Addresses)}</span>
          {#if groups.length > 0}
            <div class="cp-interfaces">
              {#each groups as group (group.address)}
                {#each group.endpoints as endpoint (endpointKey(endpoint))}
                  <div class="cp-interface-group" class:cp-interface-group-open={expanded === endpointKey(endpoint)}>
                    <button
                      type="button"
                      class="cp-interface"
                      aria-expanded={expanded === endpointKey(endpoint)}
                      onclick={() => toggle(endpoint)}
                    >
                      <span class="cp-interface-lock" role="img" aria-label={sslLabel(endpoint)}>
                        {endpoint.ssl ? '🔒' : '🔓'}
                      </span>
                      <span class="cp-interface-url">{endpointKey(endpoint)}</span>
                      <span class="cp-interface-chevron" aria-hidden="true">›</span>
                    </button>

                    {#if expanded === endpointKey(endpoint)}
                      <div class="cp-targets">
                        <button type="button" class="cp-target" onclick={() => openEndpoint(endpoint, 'config')}>
                          <span class="cp-target-name">{translateKey(AppStrings.Shell.ConnectionPanel.ConfigurationUi)}</span>
                          <span aria-hidden="true">→</span>
                        </button>
                        <button type="button" class="cp-target" onclick={() => openEndpoint(endpoint, 'client')}>
                          <span class="cp-target-name">{translateKey(AppStrings.Shell.ConnectionPanel.WebClient)}</span>
                          <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    {/if}
                  </div>
                {/each}
              {/each}
            </div>
          {:else}
            <span class="cp-value cp-muted">{translateKey(AppStrings.Shell.ConnectionPanel.NoInterfaces)}</span>
          {/if}
        </div>

        {#if anySsl}
          <p class="cp-hint">{translateKey(AppStrings.Shell.ConnectionPanel.SelfSignedHint)}</p>
        {/if}
      {/if}
    </div>
  </SidePanel>
{/if}

<style>
  .cp-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
  }

  .cp-placeholder {
    color: var(--color-text-muted);
    font-size: var(--text-sm, 0.875rem);
    padding: var(--space-4, 1rem);
    text-align: center;
  }

  .cp-section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .cp-label {
    color: var(--color-text-secondary);
    font-size: var(--text-xs, 0.75rem);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .cp-value {
    color: var(--color-text-primary);
    font-size: var(--text-sm, 0.875rem);
  }

  .cp-fingerprint {
    font-family: var(--font-mono);
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-primary);
    overflow-wrap: anywhere;
  }

  .cp-muted {
    color: var(--color-text-muted);
  }

  .cp-interfaces {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .cp-interface-group {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    overflow: hidden;
  }

  .cp-interface {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    width: 100%;
    padding: 0.5rem var(--space-2, 0.5rem);
    background: none;
    border: none;
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: var(--text-sm, 0.875rem);
    text-align: left;
  }

  .cp-interface:hover {
    background: var(--color-bg-tertiary);
  }

  .cp-interface-url {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cp-interface-chevron {
    color: var(--color-text-muted);
  }

  .cp-targets {
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg-tertiary);
  }

  .cp-target {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2, 0.5rem);
    padding: 0.5rem var(--space-3, 0.75rem);
    background: none;
    border: none;
    color: var(--color-accent);
    cursor: pointer;
    font-size: var(--text-sm, 0.875rem);
    text-align: left;
  }

  .cp-target:hover {
    background: var(--color-bg-secondary);
  }

  .cp-hint {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-xs, 0.75rem);
  }
</style>
