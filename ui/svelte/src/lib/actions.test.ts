import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionDefinition } from '@macro-deck/runtime';
import { actionEndpoints } from './endpoints';
import {
  actionBlockDefinitions,
  actionsForIntegration,
  blockParameterDefs,
  definitionFor,
  loadActions,
  resetActionStore,
} from './actions.svelte';

const ACTIONS: ActionDefinition[] = [
  {
    id: 'send-key',
    integrationId: 'macrodeck.core',
    integrationName: 'Core',
    name: 'Send key',
    description: 'Presses a key',
    parameters: [
      { name: 'key', type: 'String', label: 'Key', required: true } as never,
      { name: 'hold', type: 'Number', label: 'Hold (ms)', min: 0 } as never,
    ],
    isStateProviderAction: false,
    isIconProviderAction: false,
  },
  {
    id: 'set-state',
    integrationId: 'some.plugin',
    integrationName: '',
    name: 'Set state',
    description: '',
    parameters: [],
    isStateProviderAction: true,
    isIconProviderAction: false,
  },
];

beforeEach(() => {
  vi.spyOn(actionEndpoints, 'list').mockResolvedValue({ actions: ACTIONS });
});

afterEach(() => {
  vi.restoreAllMocks();
  resetActionStore();
});

describe('action store', () => {
  it('loads the catalogue once and resolves localized labels', async () => {
    await loadActions();
    await loadActions();

    expect(actionEndpoints.list).toHaveBeenCalledTimes(1);
    const action = definitionFor('macrodeck.core', 'send-key');
    expect(action?.name).toBe('Send key');
    expect(action?.description).toBe('Presses a key');
  });

  it('answers per-integration listings sorted by name', async () => {
    await loadActions();
    const list = actionsForIntegration('macrodeck.core');
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('send-key');
    expect(actionsForIntegration('missing')).toEqual([]);
  });

  it('derives one block per action, categorized by its integration', async () => {
    await loadActions();

    const blocks = actionBlockDefinitions();
    expect(blocks).toHaveLength(2);

    const sendKey = blocks.find(b => b.actionId === 'send-key');
    expect(sendKey?.blockType).toBe('macrodeck.core.send-key');
    expect(sendKey?.category).toBe('Core');
    expect(sendKey?.type).toBe('action');
    expect(sendKey?.blockShape).toBe('stack');
    expect(sendKey?.parameters).toHaveLength(2);

    // Without a localized integration name the raw id is the category.
    const setState = blocks.find(b => b.actionId === 'set-state');
    expect(setState?.category).toBe('some.plugin');
    expect(setState?.providesButtonState).toBe(true);
  });

  it('maps parameters onto control definitions with fallback labels', async () => {
    await loadActions();
    const action = definitionFor('macrodeck.core', 'send-key');

    const defs = blockParameterDefs(action!);
    expect(defs[0]).toMatchObject({ name: 'key', type: 'string', label: 'Key', required: true });
    expect(defs[1]).toMatchObject({ name: 'hold', type: 'number', label: 'Hold (ms)' });
  });

  it('answers undefined for a missing definition', async () => {
    await loadActions();
    expect(definitionFor('macrodeck.core', 'missing')).toBeUndefined();
    expect(definitionFor(undefined, 'send-key')).toBeUndefined();
  });
});
