/*
 * Who this browser is, as far as the host is concerned.
 *
 * Ported from DeviceIdentityService. The storage keys are identical, so a
 * device that registered through the Angular build is still recognised here.
 */

import { collectUserAgentInfo, type DeviceClientType, type DeviceCredential, type DeviceLoginInfo } from '@macro-deck/runtime';

/** The desktop admin UI, matching CLIENT_TYPE in app.config.ts. */
export const CLIENT_TYPE: DeviceClientType = 'admin-ui';

const STORAGE_KEY_ID = `md.device.${CLIENT_TYPE}.id`;
const STORAGE_KEY_SECRET = `md.device.${CLIENT_TYPE}.secret`;

let deviceId: string | null = null;
let deviceSecret: string | null = null;
let loaded = false;

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    deviceId = localStorage.getItem(STORAGE_KEY_ID);
    deviceSecret = localStorage.getItem(STORAGE_KEY_SECRET);
  } catch {
    deviceId = null;
    deviceSecret = null;
  }
}

export function currentDeviceId(): string | null {
  load();
  return deviceId;
}

export function buildLoginInfo(): DeviceLoginInfo {
  load();
  const info = collectUserAgentInfo();
  return {
    deviceId: deviceId ?? undefined,
    deviceSecret: deviceSecret ?? undefined,
    clientType: CLIENT_TYPE,
    proposedName: info.proposedName,
    platform: info.platform ?? undefined,
    browser: info.browser ?? undefined,
    formFactor: info.formFactor,
    // No build version in the web workspace (package.json is 0.0.0) - reserved
    // for a future native app.
    appVersion: undefined,
  };
}

export function adoptDevice(credential: DeviceCredential | undefined): void {
  load();
  if (!credential?.deviceId) return;

  deviceId = credential.deviceId;
  deviceSecret = credential.deviceSecret ?? deviceSecret;

  try {
    localStorage.setItem(STORAGE_KEY_ID, credential.deviceId);
    if (credential.deviceSecret) {
      localStorage.setItem(STORAGE_KEY_SECRET, credential.deviceSecret);
    }
  } catch {
  }
}

/** Forgets the stored credential. Only a test needs this. */
export function resetDeviceIdentity(): void {
  deviceId = null;
  deviceSecret = null;
  loaded = false;
}
