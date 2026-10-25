import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcAutomation } from '@macro-deck/runtime';
import { automationEndpoints } from './endpoints';
import {
  automationStore,
  createAutomation,
  deleteAutomation,
  duplicateAutomation,
  loadAutomations,
  resetAutomations,
  setEnabled,
  startAutomations,
  stopAutomations,
  updateAutomation,
} from './automations.svelte';
import * as apiModule from './api.svelte';

const SAMPLE_IPC_AUTO_1: IpcAutomation = {
  id: 'auto-1',
  name: 'Beta Automation',
  description: 'Second automation',
  flows: JSON.stringify([{ triggerId: 't1', triggerType: 'onEvent', children: [{ id: 'b1' }] }]),
  enabled: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const SAMPLE_IPC_AUTO_2: IpcAutomation = {
  id: 'auto-2',
  name: 'Alpha Automation',
  description: 'First automation',
  flows: 'corrupted-json',
  enabled: false,
  createdAt: '2026-01-02',
  updatedAt: '2026-01-02',
};

describe('automationStore', () => {
  beforeEach(() => {
    resetAutomations();
  });

  afterEach(() => {
    resetAutomations();
    vi.restoreAllMocks();
  });

  it('initializes with empty state', () => {
    expect(automationStore.automations).toEqual([]);
    expect(automationStore.sortedAutomations).toEqual([]);
    expect(automationStore.isLoading).toBe(false);
    expect(automationStore.loadError).toBeNull();
  });

  it('loads automations and sorts them alphabetically by name', async () => {
    vi.spyOn(automationEndpoints, 'list').mockResolvedValue({
      automations: [SAMPLE_IPC_AUTO_1, SAMPLE_IPC_AUTO_2],
    });

    await loadAutomations();

    expect(automationStore.automations).toHaveLength(2);
    // sortedAutomations should put 'Alpha Automation' before 'Beta Automation'
    expect(automationStore.sortedAutomations[0].name).toBe('Alpha Automation');
    expect(automationStore.sortedAutomations[1].name).toBe('Beta Automation');
    // invalid JSON flows fall back to empty array
    expect(automationStore.sortedAutomations[0].flows).toEqual([]);
    expect(automationStore.sortedAutomations[1].flows).toHaveLength(1);
    expect(automationStore.isLoading).toBe(false);
    expect(automationStore.loadError).toBeNull();
  });

  it('handles load failure cleanly', async () => {
    vi.spyOn(automationEndpoints, 'list').mockRejectedValue(new Error('Backend error'));

    await loadAutomations();

    expect(automationStore.automations).toEqual([]);
    expect(automationStore.isLoading).toBe(false);
    expect(automationStore.loadError).toBe('Backend error');
  });

  it('creates an automation and adds it to state', async () => {
    vi.spyOn(automationEndpoints, 'create').mockResolvedValue({
      success: true,
      automation: SAMPLE_IPC_AUTO_1,
    });

    const result = await createAutomation('Beta Automation', 'Second automation');

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.id).toBe('auto-1');
      expect(result.data.name).toBe('Beta Automation');
    }
    expect(automationStore.automations).toHaveLength(1);
  });

  it('updates an existing automation in state', async () => {
    vi.spyOn(automationEndpoints, 'list').mockResolvedValue({
      automations: [SAMPLE_IPC_AUTO_1],
    });
    await loadAutomations();

    const updatedIpc: IpcAutomation = {
      ...SAMPLE_IPC_AUTO_1,
      name: 'Renamed Automation',
      description: 'Updated description',
    };
    vi.spyOn(automationEndpoints, 'update').mockResolvedValue({
      success: true,
      automation: updatedIpc,
    });

    const result = await updateAutomation('auto-1', {
      name: 'Renamed Automation',
      description: 'Updated description',
    });

    expect(result.success).toBe(true);
    expect(automationStore.automations[0].name).toBe('Renamed Automation');
    expect(automationStore.automations[0].description).toBe('Updated description');
  });

  it('toggles enabled via setEnabled', async () => {
    vi.spyOn(automationEndpoints, 'list').mockResolvedValue({
      automations: [SAMPLE_IPC_AUTO_1],
    });
    await loadAutomations();

    const disabledIpc: IpcAutomation = {
      ...SAMPLE_IPC_AUTO_1,
      enabled: false,
    };
    vi.spyOn(automationEndpoints, 'update').mockResolvedValue({
      success: true,
      automation: disabledIpc,
    });

    const result = await setEnabled('auto-1', false);

    expect(result.success).toBe(true);
    expect(automationStore.automations[0].enabled).toBe(false);
  });

  it('duplicates an automation and adds copy to state', async () => {
    const duplicatedIpc: IpcAutomation = {
      ...SAMPLE_IPC_AUTO_1,
      id: 'auto-1-copy',
      name: 'Beta Automation (Copy)',
    };
    vi.spyOn(automationEndpoints, 'duplicate').mockResolvedValue({
      success: true,
      automation: duplicatedIpc,
    });

    const result = await duplicateAutomation('auto-1');

    expect(result.success).toBe(true);
    expect(automationStore.automations.some((a) => a.id === 'auto-1-copy')).toBe(true);
  });

  it('deletes an automation and removes it from state', async () => {
    vi.spyOn(automationEndpoints, 'list').mockResolvedValue({
      automations: [SAMPLE_IPC_AUTO_1],
    });
    await loadAutomations();

    vi.spyOn(automationEndpoints, 'delete').mockResolvedValue({ success: true });

    const result = await deleteAutomation('auto-1');

    expect(result.success).toBe(true);
    expect(automationStore.automations).toHaveLength(0);
  });

  it('responds to WebSocket events for real-time synchronization', () => {
    let createdCallback: ((event: unknown) => void) | undefined;
    let updatedCallback: ((event: unknown) => void) | undefined;
    let deletedCallback: ((event: unknown) => void) | undefined;

    vi.spyOn(apiModule, 'onNotificationOf').mockImplementation(((
      eventName: string,
      cb: (event: unknown) => void,
    ) => {
      if (eventName === 'AutomationCreatedEvent') createdCallback = cb;
      if (eventName === 'AutomationUpdatedEvent') updatedCallback = cb;
      if (eventName === 'AutomationDeletedEvent') deletedCallback = cb;
      return () => {};
    }) as any);

    startAutomations();

    // Fire created
    createdCallback?.({ automation: SAMPLE_IPC_AUTO_1 });
    expect(automationStore.automations).toHaveLength(1);
    expect(automationStore.automations[0].id).toBe('auto-1');

    // Fire updated
    updatedCallback?.({ automation: { ...SAMPLE_IPC_AUTO_1, name: 'Live Updated Auto' } });
    expect(automationStore.automations[0].name).toBe('Live Updated Auto');

    // Fire deleted
    deletedCallback?.({ id: 'auto-1' });
    expect(automationStore.automations).toHaveLength(0);

    stopAutomations();
  });
});
