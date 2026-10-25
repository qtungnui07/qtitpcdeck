import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settingsEndpoints } from './endpoints';
import {
  loadAppearance,
  loadAutostart,
  loadCoreSettings,
  resetSettings,
  settingsStore,
  startSettings,
  stopSettings,
  updateAppearance,
  updateAutostart,
} from './settings.svelte';

vi.mock('./endpoints', () => ({
  settingsEndpoints: {
    getAppearance: vi.fn(),
    updateAppearance: vi.fn(),
    getAutostart: vi.fn(),
    updateAutostart: vi.fn(),
    getNetwork: vi.fn(),
    updateNetwork: vi.fn(),
    getLogging: vi.fn(),
    updateLogging: vi.fn(),
    getHttp: vi.fn(),
    updateHttp: vi.fn(),
    getDeveloper: vi.fn(),
    updateDeveloper: vi.fn(),
    getExtensionSettings: vi.fn(),
    updateExtensionSettings: vi.fn(),
    getLicense: vi.fn(),
    redeemPromoCode: vi.fn(),
    getAdb: vi.fn(),
    updateAdb: vi.fn(),
    restartAdbServer: vi.fn(),
    connectAdbDevice: vi.fn(),
    downloadPlatformTools: vi.fn(),
    getUsb: vi.fn(),
    refreshUsb: vi.fn(),
    updateUsb: vi.fn(),
    connectUsbDevice: vi.fn(),
    forgetUsbDevice: vi.fn(),
    getLockScreen: vi.fn(),
    updateLockScreen: vi.fn(),
    getDataDirectory: vi.fn(),
    openDataDirectory: vi.fn(),
    restartHost: vi.fn(),
  },
}));

describe('settingsStore', () => {
  beforeEach(() => {
    resetSettings();
    vi.clearAllMocks();
  });

  it('initializes with null settings', () => {
    expect(settingsStore.appearance).toBeNull();
    expect(settingsStore.autostart).toBeNull();
    expect(settingsStore.network).toBeNull();
    expect(settingsStore.logging).toBeNull();
    expect(settingsStore.http).toBeNull();
    expect(settingsStore.developer).toBeNull();
    expect(settingsStore.isLoading).toBe(false);
  });

  it('loads appearance settings', async () => {
    const mockAppearance = {
      themeMode: 'dark' as const,
      accentColor: '#3b82f6',
      accentColorSource: 'custom' as const,
      fontFamily: 'Segoe UI',
    };
    vi.mocked(settingsEndpoints.getAppearance).mockResolvedValueOnce(mockAppearance);

    const result = await loadAppearance();

    expect(result).toEqual(mockAppearance);
    expect(settingsStore.appearance).toEqual(mockAppearance);
    expect(settingsEndpoints.getAppearance).toHaveBeenCalledTimes(1);
  });

  it('updates appearance settings and applies theme changes', async () => {
    const updated = {
      themeMode: 'light' as const,
      accentColor: '#10b981',
      accentColorSource: 'custom' as const,
      fontFamily: 'Roboto',
    };
    vi.mocked(settingsEndpoints.updateAppearance).mockResolvedValueOnce(updated);

    const result = await updateAppearance(updated);

    expect(result).toEqual(updated);
    expect(settingsStore.appearance).toEqual(updated);
    expect(settingsEndpoints.updateAppearance).toHaveBeenCalledWith(updated);
  });

  it('loads autostart settings and updates autostart', async () => {
    const mockAutostart = {
      supported: true,
      enabled: true,
      openMinimized: false,
    };
    vi.mocked(settingsEndpoints.getAutostart).mockResolvedValueOnce(mockAutostart);
    await loadAutostart();
    expect(settingsStore.autostart).toEqual(mockAutostart);

    const updated = {
      supported: true,
      enabled: false,
      openMinimized: true,
      error: null,
      success: true,
    };
    vi.mocked(settingsEndpoints.updateAutostart).mockResolvedValueOnce(updated);
    const res = await updateAutostart(updated);
    expect(res).toEqual(updated);
    expect(settingsStore.autostart).toEqual(updated);
  });

  it('loads core settings concurrently', async () => {
    vi.mocked(settingsEndpoints.getAppearance).mockResolvedValueOnce({
      themeMode: 'dark',
      accentColor: '#000',
      accentColorSource: 'custom',
      fontFamily: '',
    });
    vi.mocked(settingsEndpoints.getAutostart).mockResolvedValueOnce({
      supported: true,
      enabled: true,
      openMinimized: false,
    });
    vi.mocked(settingsEndpoints.getNetwork).mockResolvedValueOnce({
      publicPort: 8080,
      tlsEnabled: false,
    } as any);
    vi.mocked(settingsEndpoints.getLogging).mockResolvedValueOnce({
      minimumLevel: 'Information',
      defaultMinimumLevel: 'Information',
    } as any);
    vi.mocked(settingsEndpoints.getHttp).mockResolvedValueOnce({
      customUserAgent: null,
      effectiveUserAgent: 'MacroDeck',
      defaultUserAgent: 'MacroDeck',
    } as any);
    vi.mocked(settingsEndpoints.getDeveloper).mockResolvedValueOnce({
      enabled: true,
    } as any);

    await loadCoreSettings();

    expect(settingsStore.appearance?.themeMode).toBe('dark');
    expect(settingsStore.autostart?.enabled).toBe(true);
    expect(settingsStore.network?.publicPort).toBe(8080);
    expect(settingsStore.logging?.minimumLevel).toBe('Information');
    expect(settingsStore.http?.effectiveUserAgent).toBe('MacroDeck');
    expect(settingsStore.developer?.enabled).toBe(true);
    expect(settingsStore.isLoading).toBe(false);
  });

  it('starts and stops websocket event listeners cleanly', () => {
    expect(() => startSettings()).not.toThrow();
    expect(() => stopSettings()).not.toThrow();
  });
});
