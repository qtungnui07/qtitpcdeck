/*
 * Store display and formatting helpers.
 *
 * Ported from Angular desktop-ui utils: store-operation-display.ts,
 * format-bytes.ts, semver-compare.ts, and store-rating-format.ts.
 */

import {
  AppStrings,
  type StoreExtensionKind,
  type StoreExtensionTrust,
  type StoreOperationBody,
  type StoreOperationState,
} from '@macro-deck/runtime';
import { api } from './api.svelte';
import { translateKey } from './localization.svelte';

const TERMINAL_STATES: ReadonlySet<StoreOperationState> = new Set(['Completed', 'Failed', 'Cancelled']);

export function isTerminalStoreOperationState(state: StoreOperationState): boolean {
  return TERMINAL_STATES.has(state);
}

const STATE_LABEL_KEYS: Record<StoreOperationState, string> = {
  Queued: AppStrings.Store.Queued,
  Downloading: AppStrings.Store.Downloading,
  Validating: AppStrings.Store.Validating,
  BackingUp: AppStrings.Store.BackingUp,
  Installing: AppStrings.Store.Installing,
  Completed: AppStrings.Store.Installed,
  Failed: AppStrings.Store.Failed,
  Cancelled: AppStrings.Store.Cancelled,
};

export function storeOperationStateLabelKey(state: StoreOperationState): string | null {
  return STATE_LABEL_KEYS[state] ?? null;
}

export function storeOperationPercent(operation: StoreOperationBody): number | null {
  if (operation.state === 'Validating' || operation.state === 'BackingUp' || operation.state === 'Installing') {
    return null;
  }
  if (!operation.totalBytes || operation.totalBytes <= 0) {
    return null;
  }
  const percent = (operation.bytesDownloaded / operation.totalBytes) * 100;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
    return '';
  }

  if (bytes < 1024) {
    return `${Math.round(bytes)} ${UNITS[0]}`;
  }

  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const decimals = value < 10 ? 1 : 0;
  return `${value.toFixed(decimals)} ${UNITS[unit]}`;
}

export function storeOperationByteReadout(operation: StoreOperationBody): string {
  const downloaded = formatBytes(operation.bytesDownloaded);
  if (!operation.totalBytes || operation.totalBytes <= 0) {
    return downloaded;
  }

  return translateKey(AppStrings.Store.DownloadReadout, {
    downloaded,
    total: formatBytes(operation.totalBytes),
  });
}

export function storeTrustLabelKey(
  kindOrTrust: StoreExtensionKind | StoreExtensionTrust | string,
  maybeTrust?: StoreExtensionTrust | string,
): string | null {
  const trust = maybeTrust !== undefined ? maybeTrust : kindOrTrust;
  const kind = maybeTrust !== undefined ? (kindOrTrust as StoreExtensionKind) : 'Plugin';
  if (kind !== 'Plugin') {
    return null;
  }

  if (trust === 'PublisherVerified') {
    return AppStrings.Store.PublisherVerified;
  }

  return null;
}

const KIND_LABEL_KEYS: Record<StoreExtensionKind, string> = {
  Plugin: AppStrings.Store.KindLabel.Plugin,
  IconPack: AppStrings.Store.KindLabel.IconPack,
  ProfileTemplate: AppStrings.Store.KindLabel.ProfileTemplate,
};

export function storeKindLabelKey(kind: StoreExtensionKind): string | null {
  return KIND_LABEL_KEYS[kind] ?? null;
}

const KIND_ICONS: Record<StoreExtensionKind, string> = {
  Plugin: 'puzzle',
  IconPack: 'image',
  ProfileTemplate: 'layers',
};

export function storeKindIcon(kind: StoreExtensionKind): string {
  return KIND_ICONS[kind] ?? 'puzzle';
}

export function storeOperationErrorKey(code: string | null | undefined): string {
  switch (code) {
    case 'SignatureInvalid':
    case 'SignatureUntrusted':
    case 'SignatureUnverifiable':
      return AppStrings.Store.Error.SignatureUnverifiable;
    case 'RequiresNewerMacroDeck':
      return AppStrings.Store.Error.RequiresNewerMacroDeck;
    case 'VersionNotFound':
      return AppStrings.Store.Error.VersionNotFound;
    case 'UnsignedNotPermitted':
      return AppStrings.Store.Error.UnsignedNotPermitted;
    case 'TrustDowngrade':
      return AppStrings.Store.Error.TrustDowngrade;
    case 'ChecksumMismatch':
    case 'SizeMismatch':
      return AppStrings.Store.Error.DownloadMismatch;
    case 'DownloadFailed':
      return AppStrings.Store.Error.DownloadFailed;
    case 'ArtifactTooLarge':
      return AppStrings.Store.Error.ArtifactTooLarge;
    case 'MalformedPackage':
      return AppStrings.Store.Error.MalformedPackage;
    case 'Incompatible':
      return AppStrings.Store.Error.Incompatible;
    case 'Unsupported':
      return AppStrings.Store.Error.Unsupported;
    case 'PackageRemoved':
      return AppStrings.Store.Error.PackageRemoved;
    case 'PackageNotFound':
      return AppStrings.Store.Error.PackageNotFound;
    case 'RegistryUnavailable':
      return AppStrings.Store.Error.RegistryUnavailable;
    case 'Interrupted':
      return AppStrings.Store.Error.Interrupted;
    case 'Cancelled':
      return AppStrings.Store.Error.Cancelled;
    case 'SignInRequired':
      return AppStrings.Store.Error.SignInRequired;
    case 'TestBuildUnavailable':
      return AppStrings.Store.Error.TestBuildUnavailable;
    case 'TestConsentRequired':
      return AppStrings.Store.Error.TestConsentRequired;
    case 'TestBuildMismatch':
      return AppStrings.Store.Error.TestBuildMismatch;
    case 'InstallBlockedByTakeover':
      return AppStrings.Errors.Plugins.InstallBlockedByTakeover;
    default:
      return AppStrings.Store.Error.Failed;
  }
}

interface ParsedVersion {
  core: [number, number, number];
  prerelease: string[];
}

const IDENTIFIER = '(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)';
const SEMVER = new RegExp(
  `^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-(${IDENTIFIER}(?:\\.${IDENTIFIER})*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`,
);

function parseSemver(value: string | null | undefined): ParsedVersion | null {
  const match = SEMVER.exec(value ?? '');
  if (!match) {
    return null;
  }
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

function compareIdentifiers(left: string, right: string): number {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) {
    return Math.sign(Number(left) - Number(right));
  }
  if (leftNumeric !== rightNumeric) {
    return leftNumeric ? -1 : 1;
  }
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareVersions(left: string | null | undefined, right: string | null | undefined): number | null {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) {
    return null;
  }

  for (let i = 0; i < 3; i += 1) {
    if (a.core[i] !== b.core[i]) {
      return a.core[i] < b.core[i] ? -1 : 1;
    }
  }

  if (a.prerelease.length === 0 && b.prerelease.length === 0) {
    return 0;
  }
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;

  const count = Math.min(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < count; i += 1) {
    const diff = compareIdentifiers(a.prerelease[i], b.prerelease[i]);
    if (diff !== 0) return diff;
  }

  return Math.sign(a.prerelease.length - b.prerelease.length);
}

export function sameVersion(left: string | null | undefined, right: string | null | undefined): boolean {
  const order = compareVersions(left, right);
  if (order !== null) {
    return order === 0;
  }
  return (left ?? '').toLowerCase() === (right ?? '').toLowerCase();
}

export function isStoreDowngrade(operation: Pick<StoreOperationBody, 'kind' | 'version' | 'previousVersion'>): boolean {
  if (operation.kind !== 'Update' || !operation.previousVersion) {
    return false;
  }
  return (compareVersions(operation.version, operation.previousVersion) ?? 0) < 0;
}

const UNINSTALL_MESSAGE_KEYS: Record<StoreExtensionKind, string> = {
  Plugin: AppStrings.Store.UninstallMessagePlugin,
  IconPack: AppStrings.Store.UninstallMessageIconPack,
  ProfileTemplate: AppStrings.Store.UninstallMessageProfileTemplate,
};

export function storeUninstallMessageKey(kind: StoreExtensionKind): string {
  return UNINSTALL_MESSAGE_KEYS[kind] ?? AppStrings.Store.Uninstall;
}

export function formatStoreRating(value: number | null | undefined, locale = 'en-US'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  try {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  } catch {
    return value.toFixed(1);
  }
}

export function formatStoreCount(value: number | null | undefined, locale = 'en-US'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '0';
  }
  try {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value).toLowerCase();
  } catch {
    return String(value);
  }
}

export function getStoreIconUrl(kind: StoreExtensionKind, packageId: string, sha256?: string | null): string {
  const base = `${api.baseUrl}/api/store/media/${encodeURIComponent(kind)}/${encodeURIComponent(packageId)}/icon`;
  return sha256 ? `${base}?v=${encodeURIComponent(sha256)}` : base;
}

export function getStoreScreenshotUrl(
  kind: StoreExtensionKind,
  packageId: string,
  index: number,
  sha256?: string | null,
): string {
  const base = `${api.baseUrl}/api/store/media/${encodeURIComponent(kind)}/${encodeURIComponent(packageId)}/screenshots/${encodeURIComponent(String(index))}`;
  return sha256 ? `${base}?v=${encodeURIComponent(sha256)}` : base;
}
