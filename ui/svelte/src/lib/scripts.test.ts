import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcScript, RunScriptResponse } from '@macro-deck/runtime';
import { scriptEndpoints } from './endpoints';
import {
  createScript,
  deleteScript,
  duplicateScript,
  getUsages,
  loadScripts,
  resetScripts,
  runScript,
  scriptStore,
  startScripts,
  stopScripts,
  updateScript,
} from './scripts.svelte';
import * as apiModule from './api.svelte';

const SAMPLE_IPC_SCRIPT_1: IpcScript = {
  id: 'script-1',
  name: 'Beta Script',
  description: 'Second script',
  flows: JSON.stringify([{ triggerId: 't1', triggerType: 'manual', children: [{ id: 'b1' }] }]),
  inputs: [],
  runsOnWidget: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const SAMPLE_IPC_SCRIPT_2: IpcScript = {
  id: 'script-2',
  name: 'Alpha Script',
  description: 'First script',
  flows: 'invalid-json',
  inputs: [{ name: 'count', type: 'numeric', required: true }],
  runsOnWidget: true,
  createdAt: '2026-01-02',
  updatedAt: '2026-01-02',
};

describe('scriptStore', () => {
  beforeEach(() => {
    resetScripts();
  });

  afterEach(() => {
    resetScripts();
    vi.restoreAllMocks();
  });

  it('initializes with empty state', () => {
    expect(scriptStore.scripts).toEqual([]);
    expect(scriptStore.sortedScripts).toEqual([]);
    expect(scriptStore.isLoading).toBe(false);
    expect(scriptStore.loadError).toBeNull();
  });

  it('loads scripts and sorts them alphabetically by name', async () => {
    vi.spyOn(scriptEndpoints, 'list').mockResolvedValue({
      scripts: [SAMPLE_IPC_SCRIPT_1, SAMPLE_IPC_SCRIPT_2],
    });

    await loadScripts();

    expect(scriptStore.scripts).toHaveLength(2);
    // sortedScripts should put 'Alpha Script' before 'Beta Script'
    expect(scriptStore.sortedScripts[0].name).toBe('Alpha Script');
    expect(scriptStore.sortedScripts[1].name).toBe('Beta Script');
    // invalid JSON flows fall back to empty array
    expect(scriptStore.sortedScripts[0].flows).toEqual([]);
    expect(scriptStore.sortedScripts[1].flows).toHaveLength(1);
    expect(scriptStore.isLoading).toBe(false);
    expect(scriptStore.loadError).toBeNull();
  });

  it('handles load failure cleanly', async () => {
    vi.spyOn(scriptEndpoints, 'list').mockRejectedValue(new Error('Network offline'));

    await loadScripts();

    expect(scriptStore.scripts).toEqual([]);
    expect(scriptStore.isLoading).toBe(false);
    expect(scriptStore.loadError).toBe('Network offline');
  });

  it('creates a new script and adds it to state', async () => {
    vi.spyOn(scriptEndpoints, 'create').mockResolvedValue({
      success: true,
      script: SAMPLE_IPC_SCRIPT_1,
    });

    const result = await createScript('Beta Script', 'Second script');

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.id).toBe('script-1');
      expect(result.data.name).toBe('Beta Script');
    }
    expect(scriptStore.scripts).toHaveLength(1);
  });

  it('updates an existing script in state', async () => {
    vi.spyOn(scriptEndpoints, 'list').mockResolvedValue({
      scripts: [SAMPLE_IPC_SCRIPT_1],
    });
    await loadScripts();

    const updatedIpc: IpcScript = {
      ...SAMPLE_IPC_SCRIPT_1,
      name: 'Renamed Script',
      description: 'Updated description',
    };
    vi.spyOn(scriptEndpoints, 'update').mockResolvedValue({
      success: true,
      script: updatedIpc,
    });

    const result = await updateScript('script-1', {
      name: 'Renamed Script',
      description: 'Updated description',
    });

    expect(result.success).toBe(true);
    expect(scriptStore.scripts[0].name).toBe('Renamed Script');
    expect(scriptStore.scripts[0].description).toBe('Updated description');
  });

  it('duplicates a script and adds copy to state', async () => {
    const duplicatedIpc: IpcScript = {
      ...SAMPLE_IPC_SCRIPT_1,
      id: 'script-1-copy',
      name: 'Beta Script (Copy)',
    };
    vi.spyOn(scriptEndpoints, 'duplicate').mockResolvedValue({
      success: true,
      script: duplicatedIpc,
    });

    const result = await duplicateScript('script-1');

    expect(result.success).toBe(true);
    expect(scriptStore.scripts.some((s) => s.id === 'script-1-copy')).toBe(true);
  });

  it('deletes a script and removes it from state', async () => {
    vi.spyOn(scriptEndpoints, 'list').mockResolvedValue({
      scripts: [SAMPLE_IPC_SCRIPT_1],
    });
    await loadScripts();

    vi.spyOn(scriptEndpoints, 'delete').mockResolvedValue({ success: true });

    const result = await deleteScript('script-1');

    expect(result.success).toBe(true);
    expect(scriptStore.scripts).toHaveLength(0);
  });

  it('fetches script usages', async () => {
    vi.spyOn(scriptEndpoints, 'usages').mockResolvedValue({
      usages: [
        {
          kind: 'widget',
          location: 'Deck / Button 1',
          count: 1,
        },
      ],
    });

    const usages = await getUsages('script-1');
    expect(usages).toHaveLength(1);
    expect(usages[0].location).toBe('Deck / Button 1');
  });

  it('runs a script and forwards result', async () => {
    const runResponse: RunScriptResponse = {
      success: true,
      executionId: 'exec-1',
    };
    vi.spyOn(scriptEndpoints, 'run').mockResolvedValue(runResponse);

    const result = await runScript('script-1', { count: 5 });

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.executionId).toBe('exec-1');
    }
  });

  it('responds to WebSocket events for real-time synchronization', () => {
    let createdCallback: ((event: unknown) => void) | undefined;
    let updatedCallback: ((event: unknown) => void) | undefined;
    let deletedCallback: ((event: unknown) => void) | undefined;

    vi.spyOn(apiModule, 'onNotificationOf').mockImplementation(((
      eventName: string,
      cb: (event: unknown) => void,
    ) => {
      if (eventName === 'ScriptCreatedEvent') createdCallback = cb;
      if (eventName === 'ScriptUpdatedEvent') updatedCallback = cb;
      if (eventName === 'ScriptDeletedEvent') deletedCallback = cb;
      return () => {};
    }) as any);

    startScripts();

    // Fire created
    createdCallback?.({ script: SAMPLE_IPC_SCRIPT_1 });
    expect(scriptStore.scripts).toHaveLength(1);
    expect(scriptStore.scripts[0].id).toBe('script-1');

    // Fire updated
    updatedCallback?.({ script: { ...SAMPLE_IPC_SCRIPT_1, name: 'Live Updated Script' } });
    expect(scriptStore.scripts[0].name).toBe('Live Updated Script');

    // Fire deleted
    deletedCallback?.({ id: 'script-1' });
    expect(scriptStore.scripts).toHaveLength(0);

    stopScripts();
  });
});
