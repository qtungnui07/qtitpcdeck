<script lang="ts">
  /*
   * Settings modal presenting application and host settings by category.
   *
   * Connects to settingsStore and settings-modal store.
   * Supports categories: appearance, startup, network, logging, http, developer,
   * extensions, license, adb, usb, about.
   */
  import { onMount } from 'svelte';
  import { Strings } from '@macro-deck/runtime';
  import Modal from './Modal.svelte';
  import Button from './Button.svelte';
  import Checkbox from './Checkbox.svelte';
  import { translateKey } from '$lib/localization.svelte';
  import {
    closeSettings,
    setSettingsCategory,
    settingsModal,
    type SettingsCategory,
  } from '$lib/settings-modal.svelte';
  import {
    loadCoreSettings,
    settingsStore,
    updateAppearance,
    updateAutostart,
    updateDeveloper,
    updateHttp,
    updateLogging,
    openDataDirectory,
    restartHost,
  } from '$lib/settings.svelte';

  const categories: Array<{ id: SettingsCategory; label: string }> = [
    { id: 'appearance', label: 'Appearance' },
    { id: 'startup', label: 'Startup' },
    { id: 'network', label: 'Network' },
    { id: 'logging', label: 'Logging' },
    { id: 'http', label: 'HTTP / Web' },
    { id: 'developer', label: 'Developer' },
    { id: 'extensions', label: 'Extensions' },
    { id: 'license', label: 'License' },
    { id: 'adb', label: 'Android (ADB)' },
    { id: 'usb', label: 'USB Devices' },
    { id: 'about', label: 'About' },
  ];

  onMount(() => {
    void loadCoreSettings();
  });

  async function onThemeChange(mode: 'system' | 'light' | 'dark') {
    if (!settingsStore.appearance) return;
    await updateAppearance({
      ...settingsStore.appearance,
      themeMode: mode,
    });
  }

  async function onAccentColorChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!settingsStore.appearance) return;
    await updateAppearance({
      ...settingsStore.appearance,
      accentColor: input.value,
      accentColorSource: 'custom',
    });
  }

  async function onAutostartToggle(enabled: boolean) {
    if (!settingsStore.autostart) return;
    await updateAutostart({
      ...settingsStore.autostart,
      enabled,
    });
  }

  async function onStartMinimizedToggle(openMinimized: boolean) {
    if (!settingsStore.autostart) return;
    await updateAutostart({
      ...settingsStore.autostart,
      openMinimized,
    });
  }

  async function onDeveloperModeToggle(enabled: boolean) {
    if (!settingsStore.developer) return;
    await updateDeveloper({
      ...settingsStore.developer,
      enabled,
    });
  }

  async function onUserAgentChange(e: Event) {
    const input = e.target as HTMLInputElement;
    await updateHttp({
      userAgent: input.value || null,
    });
  }

  async function onLoggingLevelChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    if (!settingsStore.logging) return;
    await updateLogging({
      ...settingsStore.logging,
      minimumLevel: select.value as any,
    });
  }
</script>

{#if settingsModal.isOpen}
  <Modal
    heading={translateKey(Strings.Settings.Title)}
    size="large"
    onclose={closeSettings}
  >
    <div class="settings-layout">
      <nav class="settings-sidebar" aria-label="Settings categories">
        <ul class="settings-nav-list">
          {#each categories as cat}
            <li>
              <button
                type="button"
                class="settings-nav-button"
                class:active={settingsModal.activeCategory === cat.id}
                onclick={() => setSettingsCategory(cat.id)}
              >
                {cat.label}
              </button>
            </li>
          {/each}
        </ul>
      </nav>

      <div class="settings-content">
        {#if settingsModal.activeCategory === 'appearance'}
          <section class="settings-section">
            <h3>Appearance</h3>
            <p class="section-desc">Customize how Macro-Deck looks on your system.</p>

            <div class="setting-group">
              <label class="group-label">Theme Mode</label>
              <div class="theme-buttons">
                <Button
                  variant={settingsStore.appearance?.themeMode === 'system' ? 'primary' : 'secondary'}
                  onclick={() => onThemeChange('system')}
                >
                  System
                </Button>
                <Button
                  variant={settingsStore.appearance?.themeMode === 'light' ? 'primary' : 'secondary'}
                  onclick={() => onThemeChange('light')}
                >
                  Light
                </Button>
                <Button
                  variant={settingsStore.appearance?.themeMode === 'dark' ? 'primary' : 'secondary'}
                  onclick={() => onThemeChange('dark')}
                >
                  Dark
                </Button>
              </div>
            </div>

            <div class="setting-group">
              <label for="accent-color" class="group-label">Accent Color</label>
              <div class="color-picker-row">
                <input
                  id="accent-color"
                  type="color"
                  value={settingsStore.appearance?.accentColor || '#3b82f6'}
                  onchange={onAccentColorChange}
                  class="color-input"
                />
                <span class="color-value">{settingsStore.appearance?.accentColor || '#3b82f6'}</span>
              </div>
            </div>
          </section>

        {:else if settingsModal.activeCategory === 'startup'}
          <section class="settings-section">
            <h3>Startup</h3>
            <p class="section-desc">Manage startup behavior and system tray launch.</p>

            <div class="setting-item">
              <Checkbox
                checked={settingsStore.autostart?.enabled ?? false}
                onchange={onAutostartToggle}
              >
                Start Macro-Deck automatically on system login
              </Checkbox>
            </div>

            <div class="setting-item">
              <Checkbox
                checked={settingsStore.autostart?.openMinimized ?? false}
                disabled={!settingsStore.autostart?.enabled}
                onchange={onStartMinimizedToggle}
              >
                Start minimized to system tray
              </Checkbox>
            </div>
          </section>

        {:else if settingsModal.activeCategory === 'network'}
          <section class="settings-section">
            <h3>Network & Companion</h3>
            <p class="section-desc">Port and TLS configuration for connecting client devices.</p>

            <div class="setting-group">
              <label class="group-label">Public Port</label>
              <input
                type="number"
                class="text-input"
                value={settingsStore.network?.publicPort ?? 8191}
                readonly
              />
            </div>

            <div class="setting-item">
              <Checkbox
                checked={settingsStore.network?.tlsEnabled ?? false}
                disabled
              >
                Enable secure TLS / HTTPS
              </Checkbox>
            </div>
          </section>

        {:else if settingsModal.activeCategory === 'logging'}
          <section class="settings-section">
            <h3>Logging</h3>
            <p class="section-desc">Control diagnostic output verbosity.</p>

            <div class="setting-group">
              <label for="log-level-select" class="group-label">Minimum Log Level</label>
              <select
                id="log-level-select"
                class="select-input"
                value={settingsStore.logging?.minimumLevel ?? 'Information'}
                onchange={onLoggingLevelChange}
              >
                <option value="Trace">Trace (Verbose)</option>
                <option value="Debug">Debug</option>
                <option value="Information">Information</option>
                <option value="Warning">Warning</option>
                <option value="Error">Error</option>
              </select>
            </div>
          </section>

        {:else if settingsModal.activeCategory === 'http'}
          <section class="settings-section">
            <h3>HTTP & Web Services</h3>
            <p class="section-desc">Web server and client user agent settings.</p>

            <div class="setting-group">
              <label for="user-agent-input" class="group-label">Custom User-Agent</label>
              <input
                id="user-agent-input"
                type="text"
                class="text-input"
                placeholder={settingsStore.http?.defaultUserAgent ?? 'Default User-Agent'}
                value={settingsStore.http?.customUserAgent ?? ''}
                onchange={onUserAgentChange}
              />
            </div>
          </section>

        {:else if settingsModal.activeCategory === 'developer'}
          <section class="settings-section">
            <h3>Developer Options</h3>
            <p class="section-desc">Tools and endpoints for extension and theme authors.</p>

            <div class="setting-item">
              <Checkbox
                checked={settingsStore.developer?.enabled ?? false}
                onchange={onDeveloperModeToggle}
              >
                Enable Developer Mode
              </Checkbox>
            </div>
          </section>

        {:else if settingsModal.activeCategory === 'about'}
          <section class="settings-section">
            <h3>About Macro-Deck</h3>
            <p class="section-desc">Host environment and system diagnostics.</p>

            <div class="actions-row">
              <Button variant="secondary" onclick={() => openDataDirectory()}>
                Open Data Directory
              </Button>
              <Button variant="danger" onclick={() => restartHost('User requested restart')}>
                Restart Host
              </Button>
            </div>
          </section>

        {:else}
          <section class="settings-section">
            <h3>{settingsModal.activeCategory}</h3>
            <p class="section-desc">Configuration options for this category.</p>
          </section>
        {/if}
      </div>
    </div>

    {#snippet footer()}
      <Button variant="secondary" onclick={closeSettings}>
        {translateKey(Strings.Common.Close)}
      </Button>
    {/snippet}
  </Modal>
{/if}

<style>
  .settings-layout {
    display: flex;
    min-height: 400px;
    height: 60vh;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 6px;
    overflow: hidden;
  }

  .settings-sidebar {
    width: 200px;
    border-right: 1px solid var(--border-color, #e2e8f0);
    background: var(--bg-surface-secondary, #f8fafc);
    overflow-y: auto;
  }

  .settings-nav-list {
    list-style: none;
    margin: 0;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .settings-nav-button {
    width: 100%;
    text-align: left;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-color, #334155);
    transition: background 0.15s ease;
  }

  .settings-nav-button:hover {
    background: var(--bg-hover, #e2e8f0);
  }

  .settings-nav-button.active {
    background: var(--primary-color, #3b82f6);
    color: #ffffff;
    font-weight: 500;
  }

  .settings-content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    background: var(--bg-surface, #ffffff);
  }

  .settings-section h3 {
    margin: 0 0 6px 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .section-desc {
    margin: 0 0 20px 0;
    font-size: 0.875rem;
    color: var(--text-muted, #64748b);
  }

  .setting-group {
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-color, #1e293b);
  }

  .theme-buttons {
    display: flex;
    gap: 10px;
  }

  .color-picker-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .color-input {
    width: 40px;
    height: 40px;
    padding: 0;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 4px;
    cursor: pointer;
  }

  .color-value {
    font-family: monospace;
    font-size: 0.875rem;
  }

  .setting-item {
    margin-bottom: 16px;
  }

  .text-input,
  .select-input {
    padding: 8px 12px;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 4px;
    background: var(--bg-input, #ffffff);
    font-size: 0.875rem;
    max-width: 300px;
  }

  .actions-row {
    display: flex;
    gap: 12px;
    margin-top: 16px;
  }
</style>
