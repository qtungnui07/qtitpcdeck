import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UiNode } from '@macro-deck/runtime';
import * as api from './api.svelte';
import { openUiSession, type UiSessionHandle } from './ui-session.svelte';

type NotificationListener = (params: unknown) => void;
interface NotificationSubscription {
  method: string;
  listener: NotificationListener;
}

let subscriptions: NotificationSubscription[] = [];
let invokeResultMock: ReturnType<typeof vi.fn>;

function emit(method: string, params: unknown): void {
  // The real onNotificationOf subscribes to every host notification and
  // calls its own listener with the params alone, and only when the method
  // matches - without that filter every event would reach every handler.
  for (const { method: subscribed, listener } of [...subscriptions]) {
    if (subscribed === method) listener(params);
  }
}

const TREE: UiNode = { id: 'root', type: 'ui.config.stack', children: [] };

function treeUpdated(sessionId: string, revision: number, tree: UiNode = TREE): void {
  emit('UiSessionTreeUpdatedEvent', { sessionId, revision, tree });
}

beforeEach(() => {
  subscriptions = [];
  invokeResultMock = vi.fn();

  vi.spyOn(api, 'invokeResult').mockImplementation((method: string, payload?: unknown) => {
    invokeResultMock(method, payload);
    switch (method) {
      case 'OpenConfigUiSession':
      case 'OpenWidgetUiSession':
      case 'OpenFolderUiSession':
      case 'OpenModalUiSession':
      case 'OpenUiPreviewSession':
        return Promise.resolve({ accepted: true, sessionId: 'session-1' });
      case 'AttachUiSession':
        return Promise.resolve({ accepted: true, revision: 1 });
      default:
        return Promise.resolve({ accepted: true });
    }
  });

  vi.spyOn(api, 'onNotificationOf').mockImplementation((method: string, listener: NotificationListener) => {
    const subscription: NotificationSubscription = { method, listener };
    subscriptions.push(subscription);
    return () => {
      subscriptions = subscriptions.filter(item => item !== subscription);
    };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('openUiSession', () => {
  it('never opens a session the client cannot render', async () => {
    const handle = openUiSession({
      kind: 'config',
      entryPoint: 'widget-config',
      widgetId: 'w1',
      configUiModelVersion: 99_999,
    });

    expect(handle.root).toBeNull();
    // Let a microtask run: no request may go out even asynchronously.
    await Promise.resolve();
    expect(invokeResultMock).not.toHaveBeenCalled();
    handle.close();
  });

  it('opens, attaches and adopts the tree', async () => {
    const handle = openUiSession(() => ({
      kind: 'config' as const,
      entryPoint: 'widget-config',
      widgetId: 'w1',
      widgetData: '{}',
      configUiModelVersion: 0,
    }));

    await vi.waitFor(() => expect(invokeResultMock).toHaveBeenCalledWith('AttachUiSession', { sessionId: 'session-1' }));

    treeUpdated('session-1', 3);
    expect(handle.root).toEqual(TREE);
    expect(handle.revision).toBe(3);
    expect(handle.generation).toBe(1);

    handle.close();
  });

  it('forwards node events with the current revision', async () => {
    const handle = openUiSession({ kind: 'widget', widgetId: 'w1' });
    await vi.waitFor(() => expect(handle.generation).toBe(1));
    treeUpdated('session-1', 7);

    handle.send({ nodeId: 'field-1', name: 'change', data: 'x' });
    expect(invokeResultMock).toHaveBeenCalledWith('SendUiEvent', {
      sessionId: 'session-1',
      nodeId: 'field-1',
      name: 'change',
      data: 'x',
      revision: 7,
    });

    handle.close();
  });

  it('closes the session and stops listening', async () => {
    const handle = openUiSession({ kind: 'widget', widgetId: 'w1' });
    await vi.waitFor(() => expect(handle.generation).toBe(1));
    treeUpdated('session-1', 1);

    handle.close();
    expect(invokeResultMock).toHaveBeenCalledWith('CloseUiSession', 'session-1');

    // Notifications after close must not resurrect the tree.
    treeUpdated('session-1', 2);
    expect(handle.root).toBeNull();
  });

  it('reports a refused open as a rejection', async () => {
    vi.mocked(api.invokeResult).mockImplementation((method: string) => {
      if (method === 'OpenConfigUiSession') {
        return Promise.resolve({ accepted: false, code: 'SessionForbidden', message: 'no' });
      }
      return Promise.resolve({ accepted: true });
    });

    const handle = openUiSession({ kind: 'config', entryPoint: 'widget-config', configUiModelVersion: 0 });
    await vi.waitFor(() => expect(handle.rejection).not.toBeNull());
    expect(handle.rejection?.code).toBe('SessionForbidden');
    handle.close();
  });

  it('settles a flush when the host confirms it', async () => {
    const handle: UiSessionHandle = openUiSession({ kind: 'widget', widgetId: 'w1' });
    await vi.waitFor(() => expect(handle.generation).toBe(1));

    let flushed: (() => void) | null = null;
    const done = new Promise<void>(resolve => {
      flushed = resolve;
    });
    void handle.flush!().then(() => flushed!());

    emit('UiSessionFlushedEvent', { sessionId: 'session-1', flushId: 'flush-1' });
    await done;

    handle.close();
  });

  it('adopts a patch onto the current tree', async () => {
    const handle = openUiSession({ kind: 'widget', widgetId: 'w1' });
    await vi.waitFor(() => expect(handle.generation).toBe(1));

    const root: UiNode = { id: 'root', type: 'ui.config.stack', children: [{ id: 'label', type: 'ui.config.string' }] };
    treeUpdated('session-1', 1, root);

    emit('UiSessionPatchedEvent', {
      sessionId: 'session-1',
      fromRevision: 1,
      toRevision: 2,
      patch: {
        operations: [
          {
            op: 'insert-node',
            nodeId: 'value',
            parentId: 'root',
            index: 1,
            node: { id: 'value', type: 'ui.config.number' },
          },
        ],
      },
    });

    await vi.waitFor(() => expect(handle.revision).toBe(2));
    expect(handle.root?.children).toHaveLength(2);

    handle.close();
  });
});
