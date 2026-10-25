import { describe, expect, it, vi } from 'vitest';
import type { ActionBlock, ActionBlockDefinition, ActionFlow } from '@macro-deck/runtime';
import { ActionFlowStore } from './action-flow-store.svelte';
import { actionEndpoints } from '../endpoints';

function def(blockType: string, overrides: Partial<ActionBlockDefinition> = {}): ActionBlockDefinition {
  return {
    blockType,
    type: 'action',
    label: blockType,
    color: '#000',
    category: 'Test',
    categoryId: 'test',
    ...overrides,
  };
}

function block(id: string, overrides: Partial<ActionBlock> = {}): ActionBlock {
  return { id, type: 'action', blockType: `x.${id}`, label: id, color: '#000', ...overrides };
}

function wiredStore(initial: ActionFlow[] = []): { store: ActionFlowStore; emitted: ActionFlow[][] } {
  const store = new ActionFlowStore();
  store.flows = structuredClone(initial);
  const emitted: ActionFlow[][] = [];
  store.connect(flows => emitted.push(structuredClone(flows)));
  return { store, emitted };
}

describe('ActionFlowStore', () => {
  it('picks an action into the selected trigger, creating the flow if absent', () => {
    const { store, emitted } = wiredStore();
    store.availableBlocks = [def('core.send-key')];

    store.requestAdd('flow:onShortPress');
    store.pickAction(store.availableBlocks[0]);

    expect(store.flows).toHaveLength(1);
    expect(store.flows[0]?.triggerType).toBe('onShortPress');
    expect(store.flows[0]?.children).toHaveLength(1);
    expect(emitted).toHaveLength(1);
  });

  it('re-selects an already-added trigger instead of duplicating it (#480)', () => {
    const existing: ActionFlow[] = [
      { triggerId: 'onLongPress', triggerType: 'onLongPress', children: [] },
    ];
    const { store, emitted } = wiredStore(existing);

    store.addTrigger('onLongPress');
    expect(store.flows).toHaveLength(1);
    expect(store.selectedTriggerId).toBe('onLongPress');
    expect(emitted).toHaveLength(0);
  });

  it('moves a block within a list', () => {
    const blocks: ActionBlock[] = [
      block('a'),
      block('b'),
      block('c'),
    ];
    const { store, emitted } = wiredStore([{ triggerId: 'onShortPress', triggerType: 'onShortPress', children: blocks }]);

    store.moveBlock('flow:onShortPress', 1, 'flow:onShortPress', 3);

    expect(store.flows[0]?.children.map(b => b.id)).toEqual(['a', 'c', 'b']);
    expect(emitted).toHaveLength(1);
  });

  it('removes a block anywhere in the tree', () => {
    const initial: ActionFlow[] = [
      {
        triggerId: 'onShortPress',
        triggerType: 'onShortPress',
        children: [
          block('outer', { type: 'loop', children: [block('inner')] }),
        ],
      },
    ];
    const { store } = wiredStore(initial);

    store.removeBlock('inner');
    expect(store.flows[0]?.children[0]?.children).toHaveLength(0);
  });

  it('updates a parameter and keeps the cached label only when the value matches', () => {
    const initial: ActionFlow[] = [
      {
        triggerId: 'onShortPress',
        triggerType: 'onShortPress',
        children: [
          block('b1', {
            parameters: [{ name: 'target', type: 'widget-target', label: 'Target', value: 'w1', valueLabel: 'Old name' }],
          }),
        ],
      },
    ];
    const { store } = wiredStore(initial);

    store.updateParam('b1', 'target', 'w1');
    expect(store.flows[0]?.children[0]?.parameters?.[0]?.valueLabel).toBe('Old name');

    store.updateParam('b1', 'target', 'w2', 'New name');
    expect(store.flows[0]?.children[0]?.parameters?.[0]?.value).toBe('w2');
    expect(store.flows[0]?.children[0]?.parameters?.[0]?.valueLabel).toBe('New name');
  });

  it('manages if/else branches: elseif before else, else added once, first branch kept', () => {
    const initial: ActionFlow[] = [
      {
        triggerId: 'onShortPress',
        triggerType: 'onShortPress',
        children: [
          block('cond', {
            type: 'condition',

            branches: [{ id: 'br-if', kind: 'if', condition: { kind: 'compare', id: 'c', left: 'a', operator: '==' as const, right: 'b' }, children: [] }],
          }),

        ],
      },
    ];
    const { store } = wiredStore(initial);

    store.addElse('cond');
    store.addElseIf('cond');

    const branches = store.flows[0]?.children[0]?.branches;
    expect(branches?.map(b => b.kind)).toEqual(['if', 'elseif', 'else']);

    // Adding a second else changes nothing.
    store.addElse('cond');
    expect(store.flows[0]?.children[0]?.branches).toHaveLength(3);

    // The first branch is protected from removal.
    store.removeBranch('cond', 'br-if');
    expect(store.flows[0]?.children[0]?.branches?.[0]?.id).toBe('br-if');
  });

  it('adds and removes event triggers', () => {
    const { store } = wiredStore();
    const triggerId = store.addEventTrigger();
    expect(store.flows[0]?.triggerType).toBe('onEvent');
    expect(store.selectedTriggerId).toBe(triggerId);

    store.removeEventTrigger(triggerId);
    expect(store.flows).toHaveLength(0);
  });

  it('duplicates a block with new ids after the source', async () => {
    const initial: ActionFlow[] = [
      {
        triggerId: 'onShortPress',
        triggerType: 'onShortPress',
        children: [block('b1')],
      },
    ];
    const { store } = wiredStore(initial);

    await store.duplicateBlock('b1');

    const children = store.flows[0]?.children ?? [];
    expect(children).toHaveLength(2);
    expect(children[0]?.id).toBe('b1');
    expect(children[1]?.id).not.toBe('b1');
    expect(store.isExpanded(children[1]!.id)).toBe(true);
  });

  it('cut and paste back into the same surface removes the source', async () => {
    const initial: ActionFlow[] = [
      {
        triggerId: 'onShortPress',
        triggerType: 'onShortPress',
        children: [block('b1'), block('b2')],
      },
    ];
    const { store } = wiredStore(initial);
    store.previewScope = 'widget';
    store.previewScopeRefId = 'w1';

    store.cutBlock('b1');
    expect(store.isCutSource('b1')).toBe(true);

    await store.pasteAfter('b2');

    expect(store.flows[0]?.children.map(b => b.id)).toEqual(['b2', expect.any(String)]);
    expect(store.isCutSource('b1')).toBe(false);
  });

  it('reports validation errors for the flows it holds', () => {
    const { store } = wiredStore([
      {
        triggerId: 'onShortPress',
        triggerType: 'onShortPress',
        children: [block('b1', { parameters: [{ name: 'key', type: 'string', label: 'Key', value: '' }] })],
      },
    ]);

    expect(store.validation.valid).toBe(false);
    expect(store.errorsFor('b1')).toHaveLength(1);
  });

  it('runs the selected flow through the endpoint and reports a network failure', async () => {
    const { store } = wiredStore([
      {
        triggerId: 'onShortPress',
        triggerType: 'onShortPress',
        children: [block('b1')],
      },
    ]);
    const runFlow = vi.spyOn(actionEndpoints, 'runFlow')
      .mockRejectedValue(new Error('network down'));

    const response = await store.runSelectedFlow();
    expect(runFlow).toHaveBeenCalled();
    expect(response?.success).toBe(false);
    expect(response?.error?.code).toBe('NETWORK_ERROR');

    runFlow.mockRestore();
  });
});
