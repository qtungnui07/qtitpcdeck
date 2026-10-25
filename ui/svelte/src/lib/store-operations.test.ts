import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storeOperationEndpoints } from './endpoints';
import {
  applyStoreOperationsBatch,
  cancelStoreOperation,
  installStoreExtension,
  loadStoreOperations,
  resetStoreOperations,
  retryStoreOperation,
  storeOperationsStore,
  uninstallStoreExtension,
} from './store-operations.svelte';
import type { StoreOperationBody } from '@macro-deck/runtime';

vi.mock('./endpoints', () => ({
  storeOperationEndpoints: {
    list: vi.fn(),
    install: vi.fn(),
    uninstall: vi.fn(),
    retry: vi.fn(),
    cancel: vi.fn(),
  },
}));

const mockOperation: StoreOperationBody = {
  id: 'op-123',
  kind: 'Install',
  extensionKind: 'Plugin',
  packageId: 'com.macrodeck.spotify',
  displayName: 'Spotify Integration',
  state: 'Downloading',
  version: '2.1.0',
  bytesDownloaded: 2048,
  totalBytes: 4096,
  startedAt: '2025-01-01T12:00:00Z',
  updatedAt: '2025-01-01T12:00:00Z',
  canRetry: false,
};

describe('storeOperationsStore', () => {
  beforeEach(() => {
    resetStoreOperations();
    vi.clearAllMocks();
  });

  it('loads operations and finds active operation', async () => {
    vi.mocked(storeOperationEndpoints.list).mockResolvedValueOnce({
      operations: [mockOperation],
    });

    await loadStoreOperations();

    expect(storeOperationsStore.operations).toHaveLength(1);
    expect(storeOperationsStore.hasActiveOperations).toBe(true);

    const active = storeOperationsStore.findActiveOperation('Plugin', 'com.macrodeck.spotify');
    expect(active).toBeDefined();
    expect(active?.state).toBe('Downloading');
  });

  it('updates operation state when batch arrives', () => {
    applyStoreOperationsBatch([mockOperation]);
    expect(storeOperationsStore.operations).toHaveLength(1);

    // Update with next progress state
    applyStoreOperationsBatch([
      {
        ...mockOperation,
        state: 'Installing',
        updatedAt: '2025-01-01T12:01:00Z',
      },
    ]);

    expect(storeOperationsStore.operations[0].state).toBe('Installing');

    // Complete it
    applyStoreOperationsBatch([
      {
        ...mockOperation,
        state: 'Completed',
        updatedAt: '2025-01-01T12:02:00Z',
      },
    ]);

    expect(storeOperationsStore.operations[0].state).toBe('Completed');
    expect(storeOperationsStore.hasActiveOperations).toBe(false);
  });

  it('invokes install and updates operations list', async () => {
    vi.mocked(storeOperationEndpoints.install).mockResolvedValueOnce({
      success: true,
      operation: mockOperation,
    });

    const result = await installStoreExtension('Plugin', 'com.macrodeck.spotify', '2.1.0');
    expect(result).toBe(true);
    expect(storeOperationEndpoints.install).toHaveBeenCalledWith({
      kind: 'Plugin',
      packageId: 'com.macrodeck.spotify',
      version: '2.1.0',
    });
    expect(storeOperationsStore.operations).toHaveLength(1);
  });

  it('invokes cancel and updates operation', async () => {
    vi.mocked(storeOperationEndpoints.cancel).mockResolvedValueOnce({
      success: true,
      operation: {
        ...mockOperation,
        state: 'Cancelled',
      },
    });

    const res = await cancelStoreOperation('op-123');
    expect(res).toBe(true);
    expect(storeOperationsStore.operations[0].state).toBe('Cancelled');
  });

  it('invokes retry', async () => {
    vi.mocked(storeOperationEndpoints.retry).mockResolvedValueOnce({
      success: true,
      operation: {
        ...mockOperation,
        state: 'Queued',
      },
    });

    const res = await retryStoreOperation('op-123');
    expect(res).toBe(true);
    expect(storeOperationsStore.operations[0].state).toBe('Queued');
  });

  it('invokes uninstall', async () => {
    vi.mocked(storeOperationEndpoints.uninstall).mockResolvedValueOnce({
      success: true,
    });

    const success = await uninstallStoreExtension('Plugin', 'com.macrodeck.spotify');
    expect(success).toBe(true);
    expect(storeOperationEndpoints.uninstall).toHaveBeenCalledWith({
      kind: 'Plugin',
      id: 'com.macrodeck.spotify',
    });
  });
});
