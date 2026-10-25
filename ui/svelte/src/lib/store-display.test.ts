import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  formatBytes,
  formatStoreCount,
  formatStoreRating,
  getStoreIconUrl,
  getStoreScreenshotUrl,
  isStoreDowngrade,
  isTerminalStoreOperationState,
  storeKindIcon,
  storeOperationPercent,
} from './store-display';
import type { StoreOperationBody } from '@macro-deck/runtime';

describe('store-display utilities', () => {
  describe('compareVersions', () => {
    it('correctly compares semantic versions', () => {
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
      expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
      expect(compareVersions('1.0', '1.0.0')).toBeNull();
      expect(compareVersions('1.2.3-beta', '1.2.3')).toBe(-1);
      expect(compareVersions('1.2.3', '1.2.3-alpha')).toBe(1);
    });

    it('identifies downgrades', () => {
      expect(isStoreDowngrade({ kind: 'Update', version: '1.4.0', previousVersion: '1.5.0' })).toBe(true);
      expect(isStoreDowngrade({ kind: 'Update', version: '1.5.0', previousVersion: '1.4.0' })).toBe(false);
      expect(isStoreDowngrade({ kind: 'Update', version: '1.5.0', previousVersion: '1.5.0' })).toBe(false);
      expect(isStoreDowngrade({ kind: 'Install', version: '1.0.0', previousVersion: '2.0.0' })).toBe(false);
    });
  });

  describe('formatBytes', () => {
    it('formats 0 and empty bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('formats bytes, KB, MB, and GB', () => {
      expect(formatBytes(500)).toBe('500 B');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1.0 MB');
      expect(formatBytes(1073741824)).toBe('1.0 GB');
    });
  });

  describe('formatStoreCount and formatStoreRating', () => {
    it('formats compact counts', () => {
      expect(formatStoreCount(450)).toBe('450');
      expect(formatStoreCount(1200)).toBe('1.2k');
      expect(formatStoreCount(1500000)).toBe('1.5m');
    });

    it('formats rating display', () => {
      expect(formatStoreRating(4.56)).toBe('4.6');
      expect(formatStoreRating(null)).toBe('—');
      expect(formatStoreRating(undefined)).toBe('—');
    });
  });

  describe('media URLs', () => {
    it('builds icon URL with kind, packageId, and sha hash', () => {
      const url = getStoreIconUrl('Plugin', 'com.test.plugin', 'abc123sha');
      expect(url).toBe('/api/store/media/Plugin/com.test.plugin/icon?v=abc123sha');
    });

    it('builds screenshot URL', () => {
      const url = getStoreScreenshotUrl('IconPack', 'com.test.icons', 2, 'xyz456');
      expect(url).toBe('/api/store/media/IconPack/com.test.icons/screenshots/2?v=xyz456');
    });
  });

  describe('operation display state and percentages', () => {
    it('detects terminal states', () => {
      expect(isTerminalStoreOperationState('Completed')).toBe(true);
      expect(isTerminalStoreOperationState('Failed')).toBe(true);
      expect(isTerminalStoreOperationState('Cancelled')).toBe(true);
      expect(isTerminalStoreOperationState('Downloading')).toBe(false);
      expect(isTerminalStoreOperationState('Installing')).toBe(false);
    });

    it('computes download percentage from bytes', () => {
      const op: StoreOperationBody = {
        id: 'op-1',
        kind: 'Install',
        extensionKind: 'Plugin',
        packageId: 'com.test.pkg',
        displayName: 'Test',
        state: 'Downloading',
        version: '1.0.0',
        bytesDownloaded: 500,
        totalBytes: 1000,
        startedAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        canRetry: false,
      };
      expect(storeOperationPercent(op)).toBe(50);
    });

    it('returns null for non-byte progress states', () => {
      const op: StoreOperationBody = {
        id: 'op-2',
        kind: 'Install',
        extensionKind: 'Plugin',
        packageId: 'com.test.pkg',
        displayName: 'Test',
        state: 'Installing',
        version: '1.0.0',
        bytesDownloaded: 1000,
        totalBytes: 1000,
        startedAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        canRetry: false,
      };
      expect(storeOperationPercent(op)).toBeNull();
    });

    it('returns kind icons', () => {
      expect(storeKindIcon('Plugin')).toBe('puzzle');
      expect(storeKindIcon('IconPack')).toBe('image');
    });
  });
});
