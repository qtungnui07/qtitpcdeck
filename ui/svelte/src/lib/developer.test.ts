import { beforeEach, describe, expect, it, vi } from 'vitest';
import { developerEndpoints } from './endpoints';
import {
  developerStore,
  evaluateCondition,
  loadActions,
  loadLogs,
  loadLogSources,
  renderTemplate,
  resetDeveloperStore,
  runAction,
  selectAction,
} from './developer.svelte';

vi.mock('./endpoints', () => ({
  developerEndpoints: {
    getActions: vi.fn(),
    runAction: vi.fn(),
    runActionFlow: vi.fn(),
    getEvents: vi.fn(),
    triggerEvent: vi.fn(),
    renderTemplate: vi.fn(),
    evaluateCondition: vi.fn(),
    evaluateExpression: vi.fn(),
    getLogs: vi.fn(),
    getLogSources: vi.fn(),
  },
}));

describe('developerStore', () => {
  beforeEach(() => {
    resetDeveloperStore();
    vi.clearAllMocks();
  });

  it('initializes with empty collections', () => {
    expect(developerStore.actions).toEqual([]);
    expect(developerStore.events).toEqual([]);
    expect(developerStore.logs).toEqual([]);
    expect(developerStore.logSources).toEqual([]);
    expect(developerStore.selectedAction).toBeNull();
    expect(developerStore.isLoading).toBe(false);
  });

  it('loads actions and manages selection', async () => {
    const mockActions = [
      { id: 'act-1', name: 'Test Action', extensionId: 'ext-1' } as any,
    ];
    vi.mocked(developerEndpoints.getActions).mockResolvedValueOnce({ actions: mockActions });

    const result = await loadActions();

    expect(result).toEqual(mockActions);
    expect(developerStore.actions).toEqual(mockActions);

    selectAction(mockActions[0]);
    expect(developerStore.selectedAction).toEqual(mockActions[0]);
  });

  it('runs an action and records output', async () => {
    const mockRes = { success: true, executionId: 'exec-1' } as any;
    vi.mocked(developerEndpoints.runAction).mockResolvedValueOnce(mockRes);

    const res = await runAction({ integrationId: 'test.ext', actionId: 'act-1', parameters: {} });

    expect(res).toEqual(mockRes);
    expect(developerStore.executionResult).toContain('exec-1');
  });

  it('renders template string', async () => {
    vi.mocked(developerEndpoints.renderTemplate).mockResolvedValueOnce({
      rendered: 'Hello World',
    } as any);

    const res = await renderTemplate('Hello {{name}}');

    expect(res).toBe('Hello World');
    expect(developerStore.templateOutput).toBe('Hello World');
  });

  it('evaluates condition correctly', async () => {
    vi.mocked(developerEndpoints.evaluateCondition).mockResolvedValueOnce({
      result: true,
      leftDisplay: '1',
      rightDisplay: '1',
    } as any);

    const res = await evaluateCondition({ value: 1 }, '==', { value: 1 });

    expect(res).toBe(true);
    expect(developerStore.conditionResult).toBe(true);
  });

  it('loads log sources and log entries', async () => {
    vi.mocked(developerEndpoints.getLogSources).mockResolvedValueOnce({
      sources: [{ source: 'Host' as any }],
    });
    vi.mocked(developerEndpoints.getLogs).mockResolvedValueOnce({
      entries: [{ id: '1', timestamp: '2025-01-01', level: 'Information' as any, source: 'Host' as any, message: 'Ready' }],
      hasMore: false,
      tailAnchor: '',
    });

    await loadLogSources();
    await loadLogs('Host');

    expect(developerStore.logSources).toEqual([{ source: 'Host' }]);
    expect(developerStore.logs.length).toBe(1);
    expect(developerStore.logs[0].message).toBe('Ready');
  });
});
