/*
 * Application settings state, ported from the Angular Settings/Services.
 *
 * Manages host configuration across categories (Appearance, Autostart, Network,
 * Logging, HTTP, Developer, Extensions, License, ADB, Native USB, Host Maintenance).
 *
 * State is managed with Svelte 5 runes ($state) behind a read-only settingsStore getter,
 * and synchronizes with WebSocket push notifications where supported.
 */

import {
  type AdbStateChangedEvent,
  type AppearanceChangedEvent,
  type CompanionLicenseStatus,
  type ConnectAdbDeviceRequest,
  type ConnectAdbDeviceResponse,
  type ConnectNativeUsbDeviceRequest,
  type ConnectNativeUsbDeviceResponse,
  type DeveloperSettingsChangedEvent,
  type DownloadAdbPlatformToolsResponse,
  type ForgetNativeUsbDeviceRequest,
  type ForgetNativeUsbDeviceResponse,
  type GetAdbSettingsResponse,
  type GetAppearanceSettingsResponse,
  type GetAutostartSettingsResponse,
  type GetDataDirectoryResponse,
  type GetDeveloperSettingsResponse,
  type GetExtensionSettingsResponse,
  type GetHttpSettingsResponse,
  type GetLockScreenSettingsResponse,
  type GetLoggingSettingsResponse,
  type GetNativeUsbSettingsResponse,
  type GetNetworkSettingsResponse,
  type NativeUsbStateChangedEvent,
  type OpenDataDirectoryResponse,
  type RedeemCompanionPromoCodeResponse,
  type RestartAdbServerResponse,
  type RestartApplicationResponse,
  type UpdateAdbSettingsRequest,
  type UpdateAdbSettingsResponse,
  type UpdateAppearanceSettingsRequest,
  type UpdateAppearanceSettingsResponse,
  type UpdateAutostartSettingsRequest,
  type UpdateAutostartSettingsResponse,
  type UpdateDeveloperSettingsRequest,
  type UpdateDeveloperSettingsResponse,
  type UpdateExtensionSettingsRequest,
  type UpdateExtensionSettingsResponse,
  type UpdateHttpSettingsRequest,
  type UpdateHttpSettingsResponse,
  type UpdateLockScreenSettingsRequest,
  type UpdateLockScreenSettingsResponse,
  type UpdateLoggingSettingsRequest,
  type UpdateLoggingSettingsResponse,
  type UpdateNativeUsbSettingsRequest,
  type UpdateNativeUsbSettingsResponse,
  type UpdateNetworkSettingsRequest,
  type UpdateNetworkSettingsResponse,
  type UpdateNetworkTlsCertificateRequest,
} from '@macro-deck/runtime';
import { onNotificationOf } from './api.svelte';
import { settingsEndpoints } from './endpoints';
import { setAccentColor, setFontFamily, setThemeMode } from './theme.svelte';

let appearance = $state<GetAppearanceSettingsResponse | null>(null);
let autostart = $state<GetAutostartSettingsResponse | null>(null);
let network = $state<GetNetworkSettingsResponse | null>(null);
let logging = $state<GetLoggingSettingsResponse | null>(null);
let http = $state<GetHttpSettingsResponse | null>(null);
let developer = $state<GetDeveloperSettingsResponse | null>(null);
let extensions = $state<GetExtensionSettingsResponse | null>(null);
let license = $state<CompanionLicenseStatus | null>(null);
let adb = $state<GetAdbSettingsResponse | null>(null);
let usb = $state<GetNativeUsbSettingsResponse | null>(null);
let lockScreen = $state<GetLockScreenSettingsResponse | null>(null);
let dataDirectory = $state<GetDataDirectoryResponse | null>(null);

let isLoading = $state(false);
let loadError = $state<string | null>(null);

let unsubscribeAppearance: (() => void) | null = null;
let unsubscribeDeveloper: (() => void) | null = null;
let unsubscribeAdb: (() => void) | null = null;
let unsubscribeUsb: (() => void) | null = null;

export const settingsStore = {
  get appearance() {
    return appearance;
  },
  get autostart() {
    return autostart;
  },
  get network() {
    return network;
  },
  get logging() {
    return logging;
  },
  get http() {
    return http;
  },
  get developer() {
    return developer;
  },
  get extensions() {
    return extensions;
  },
  get license() {
    return license;
  },
  get adb() {
    return adb;
  },
  get usb() {
    return usb;
  },
  get lockScreen() {
    return lockScreen;
  },
  get dataDirectory() {
    return dataDirectory;
  },
  get isLoading() {
    return isLoading;
  },
  get loadError() {
    return loadError;
  },
};

export async function loadAppearance(): Promise<GetAppearanceSettingsResponse | null> {
  try {
    const res = await settingsEndpoints.getAppearance();
    appearance = res;
    return res;
  } catch (error) {
    console.error('Failed to load appearance settings:', error);
    return null;
  }
}

export async function updateAppearance(
  req: UpdateAppearanceSettingsRequest,
): Promise<UpdateAppearanceSettingsResponse> {
  const res = await settingsEndpoints.updateAppearance(req);
  appearance = res;
  if (res.themeMode) {
    setThemeMode(res.themeMode);
  }
  if (res.accentColor) {
    setAccentColor(res.accentColor);
  }
  if (res.fontFamily !== undefined) {
    setFontFamily(res.fontFamily);
  }
  return res;
}

export async function loadAutostart(): Promise<GetAutostartSettingsResponse | null> {
  try {
    const res = await settingsEndpoints.getAutostart();
    autostart = res;
    return res;
  } catch (error) {
    console.error('Failed to load autostart settings:', error);
    return null;
  }
}

export async function updateAutostart(
  req: UpdateAutostartSettingsRequest,
): Promise<UpdateAutostartSettingsResponse> {
  const res = await settingsEndpoints.updateAutostart(req);
  autostart = res;
  return res;
}

export async function loadNetwork(): Promise<GetNetworkSettingsResponse | null> {
  try {
    const res = await settingsEndpoints.getNetwork();
    network = res;
    return res;
  } catch (error) {
    console.error('Failed to load network settings:', error);
    return null;
  }
}

export async function updateNetwork(
  req: UpdateNetworkSettingsRequest,
): Promise<UpdateNetworkSettingsResponse> {
  const res = await settingsEndpoints.updateNetwork(req);
  network = res;
  return res;
}

export async function updateNetworkTlsCertificate(
  req: UpdateNetworkTlsCertificateRequest,
): Promise<UpdateNetworkSettingsResponse> {
  const res = await settingsEndpoints.updateNetworkTlsCertificate(req);
  network = res;
  return res;
}

export async function reissueNetworkTlsCertificate(): Promise<UpdateNetworkSettingsResponse> {
  const res = await settingsEndpoints.reissueNetworkTlsCertificate();
  network = res;
  return res;
}

export async function regenerateNetworkTlsCertificateAuthority(): Promise<UpdateNetworkSettingsResponse> {
  const res = await settingsEndpoints.regenerateNetworkTlsCertificateAuthority();
  network = res;
  return res;
}

export async function loadLogging(): Promise<GetLoggingSettingsResponse | null> {
  try {
    const res = await settingsEndpoints.getLogging();
    logging = res;
    return res;
  } catch (error) {
    console.error('Failed to load logging settings:', error);
    return null;
  }
}

export async function updateLogging(
  req: UpdateLoggingSettingsRequest,
): Promise<UpdateLoggingSettingsResponse> {
  const res = await settingsEndpoints.updateLogging(req);
  logging = res;
  return res;
}

export async function loadHttp(): Promise<GetHttpSettingsResponse | null> {
  try {
    const res = await settingsEndpoints.getHttp();
    http = res;
    return res;
  } catch (error) {
    console.error('Failed to load http settings:', error);
    return null;
  }
}

export async function updateHttp(
  req: UpdateHttpSettingsRequest,
): Promise<UpdateHttpSettingsResponse> {
  const res = await settingsEndpoints.updateHttp(req);
  http = res;
  return res;
}

export async function loadDeveloper(): Promise<GetDeveloperSettingsResponse | null> {
  try {
    const res = await settingsEndpoints.getDeveloper();
    developer = res;
    return res;
  } catch (error) {
    console.error('Failed to load developer settings:', error);
    return null;
  }
}

export async function updateDeveloper(
  req: UpdateDeveloperSettingsRequest,
): Promise<UpdateDeveloperSettingsResponse> {
  const res = await settingsEndpoints.updateDeveloper(req);
  developer = res;
  return res;
}

export async function loadExtensionSettings(): Promise<GetExtensionSettingsResponse | null> {
  try {
    const res = await settingsEndpoints.getExtensionSettings();
    extensions = res;
    return res;
  } catch (error) {
    console.error('Failed to load extension settings:', error);
    return null;
  }
}

export async function updateExtensionSettings(
  req: UpdateExtensionSettingsRequest,
): Promise<UpdateExtensionSettingsResponse> {
  const res = await settingsEndpoints.updateExtensionSettings(req);
  extensions = res;
  return res;
}

export async function loadLicense(): Promise<CompanionLicenseStatus | null> {
  try {
    const res = await settingsEndpoints.getLicense();
    license = res;
    return res;
  } catch (error) {
    console.error('Failed to load license settings:', error);
    return null;
  }
}

export async function redeemPromoCode(
  code: string,
): Promise<RedeemCompanionPromoCodeResponse> {
  return await settingsEndpoints.redeemPromoCode(code);
}

export async function loadAdb(): Promise<GetAdbSettingsResponse | null> {
  try {
    const res = await settingsEndpoints.getAdb();
    adb = res;
    return res;
  } catch (error) {
    console.error('Failed to load ADB settings:', error);
    return null;
  }
}

export async function updateAdb(
  req: UpdateAdbSettingsRequest,
): Promise<UpdateAdbSettingsResponse> {
  const res = await settingsEndpoints.updateAdb(req);
  adb = res;
  return res;
}

export async function restartAdbServer(): Promise<RestartAdbServerResponse> {
  return await settingsEndpoints.restartAdbServer();
}

export async function connectAdbDevice(
  req: ConnectAdbDeviceRequest,
): Promise<ConnectAdbDeviceResponse> {
  return await settingsEndpoints.connectAdbDevice(req);
}

export async function downloadAdbPlatformTools(): Promise<DownloadAdbPlatformToolsResponse> {
  return await settingsEndpoints.downloadPlatformTools();
}

export async function loadUsb(): Promise<GetNativeUsbSettingsResponse | null> {
  try {
    const res = await settingsEndpoints.getUsb();
    usb = res;
    return res;
  } catch (error) {
    console.error('Failed to load USB settings:', error);
    return null;
  }
}

export async function refreshUsb(): Promise<GetNativeUsbSettingsResponse | null> {
  try {
    const res = await settingsEndpoints.refreshUsb();
    usb = res;
    return res;
  } catch (error) {
    console.error('Failed to refresh USB settings:', error);
    return null;
  }
}

export async function updateUsb(
  req: UpdateNativeUsbSettingsRequest,
): Promise<UpdateNativeUsbSettingsResponse> {
  const res = await settingsEndpoints.updateUsb(req);
  usb = res;
  return res;
}

export async function connectUsbDevice(
  req: ConnectNativeUsbDeviceRequest,
): Promise<ConnectNativeUsbDeviceResponse> {
  return await settingsEndpoints.connectUsbDevice(req);
}

export async function forgetUsbDevice(
  req: ForgetNativeUsbDeviceRequest,
): Promise<ForgetNativeUsbDeviceResponse> {
  return await settingsEndpoints.forgetUsbDevice(req);
}

export async function loadLockScreen(): Promise<GetLockScreenSettingsResponse | null> {
  try {
    const res = await settingsEndpoints.getLockScreen();
    lockScreen = res;
    return res;
  } catch (error) {
    console.error('Failed to load lock screen settings:', error);
    return null;
  }
}

export async function updateLockScreen(
  req: UpdateLockScreenSettingsRequest,
): Promise<UpdateLockScreenSettingsResponse> {
  const res = await settingsEndpoints.updateLockScreen(req);
  lockScreen = res;
  return res;
}

export async function loadDataDirectory(): Promise<GetDataDirectoryResponse | null> {
  try {
    const res = await settingsEndpoints.getDataDirectory();
    dataDirectory = res;
    return res;
  } catch (error) {
    console.error('Failed to load data directory info:', error);
    return null;
  }
}

export async function openDataDirectory(): Promise<OpenDataDirectoryResponse> {
  return await settingsEndpoints.openDataDirectory();
}

export async function restartHost(reason?: string): Promise<RestartApplicationResponse> {
  return await settingsEndpoints.restartHost(reason);
}

export async function loadCoreSettings(): Promise<void> {
  isLoading = true;
  loadError = null;
  try {
    await Promise.allSettled([
      loadAppearance(),
      loadAutostart(),
      loadNetwork(),
      loadLogging(),
      loadHttp(),
      loadDeveloper(),
    ]);
  } catch (error) {
    console.error('Failed to load settings batch:', error);
    loadError = error instanceof Error ? error.message : String(error);
  } finally {
    isLoading = false;
  }
}

export function startSettings(): void {
  unsubscribeAppearance = onNotificationOf<AppearanceChangedEvent>(
    'AppearanceChangedEvent',
    event => {
      appearance = {
        themeMode: event.themeMode,
        accentColor: event.accentColor,
        accentColorSource: event.accentColorSource,
        fontFamily: event.fontFamily,
      };
      if (event.themeMode) {
        setThemeMode(event.themeMode);
      }
      if (event.accentColor) {
        setAccentColor(event.accentColor);
      }
      if (event.fontFamily !== undefined) {
        setFontFamily(event.fontFamily);
      }
    },
  );

  unsubscribeDeveloper = onNotificationOf<DeveloperSettingsChangedEvent>(
    'DeveloperSettingsChangedEvent',
    event => {
      if (developer) {
        developer = { ...developer, ...event };
      }
    },
  );

  unsubscribeAdb = onNotificationOf<AdbStateChangedEvent>('AdbStateChangedEvent', () => {
    void loadAdb();
  });

  unsubscribeUsb = onNotificationOf<NativeUsbStateChangedEvent>('NativeUsbStateChangedEvent', () => {
    void loadUsb();
  });
}

export function stopSettings(): void {
  unsubscribeAppearance?.();
  unsubscribeAppearance = null;

  unsubscribeDeveloper?.();
  unsubscribeDeveloper = null;

  unsubscribeAdb?.();
  unsubscribeAdb = null;

  unsubscribeUsb?.();
  unsubscribeUsb = null;
}

export function resetSettings(): void {
  stopSettings();
  appearance = null;
  autostart = null;
  network = null;
  logging = null;
  http = null;
  developer = null;
  extensions = null;
  license = null;
  adb = null;
  usb = null;
  lockScreen = null;
  dataDirectory = null;
  isLoading = false;
  loadError = null;
}
