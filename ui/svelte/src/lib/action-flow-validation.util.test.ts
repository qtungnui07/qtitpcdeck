import { describe, expect, it } from 'vitest';
import type { ActionBlock, ActionBlockParameter, ActionFlow } from '@macro-deck/runtime';
import { WIDGET_TARGET_SELF } from '@macro-deck/runtime';
import { validateActionFlows, isConditionComplete } from './action-flow-validation.util';

function param(overrides: Partial<ActionBlockParameter> & { name: string; type?: string }): ActionBlockParameter {
  return {
    type: 'string',
    label: overrides.label ?? overrides.name,
    value: null,
    ...overrides,
  } as ActionBlockParameter;
}

function block(overrides: Partial<ActionBlock> & { id: string }): ActionBlock {
  return { blockType: 'x.y', ...overrides } as ActionBlock;
}

function flow(children: ActionBlock[]): ActionFlow {
  return { triggerId: 'onShortPress', triggerType: 'onShortPress', children };
}

describe('validateActionFlows', () => {
  it('passes a complete flow', () => {
    const result = validateActionFlows([
      flow([block({ id: 'b1', parameters: [param({ name: 'key', required: true, value: 'A' })] })]),
    ]);
    expect(result.valid).toBe(true);
  });

  it('reports a missing required parameter', () => {
    const result = validateActionFlows([
      flow([block({ id: 'b1', parameters: [param({ name: 'key', required: true, value: '' })] })]),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatchObject({ blockId: 'b1', paramName: 'key' });
  });

  it('ignores a required parameter the editor is not showing', () => {
    const result = validateActionFlows([
      flow([
        block({
          id: 'b1',
          parameters: [
            param({ name: 'mode', required: false, value: 'simple' }),
            param({ name: 'body', required: true, value: '', visibleWhen: { parameterName: 'mode', values: ['rich'] } }),
          ],
        }),
      ]),
    ]);
    expect(result.valid).toBe(true);
  });

  it('accepts liquid in a required string and skips its format checks', () => {
    const result = validateActionFlows([
      flow([
        block({
          id: 'b1',
          parameters: [param({ name: 'url', type: 'url', required: true, value: '{{ vars.host }}/path' })],
        }),
      ]),
    ]);
    expect(result.valid).toBe(true);
  });

  it('rejects an invalid url, ip and json', () => {
    const result = validateActionFlows([
      flow([
        block({
          id: 'b1',
          parameters: [
            param({ name: 'u', type: 'url', required: false, value: 'not a url' }),
            param({ name: 'ip', type: 'ipaddress', required: false, value: '999.1.1.1' }),
            param({ name: 'j', type: 'json', required: false, value: '{oops' }),
          ],
        }),
      ]),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(3);
  });

  it('ignores a disabled block entirely', () => {
    const result = validateActionFlows([
      flow([block({ id: 'b1', disabled: true, parameters: [param({ name: 'key', required: true, value: '' })] })]),
    ]);
    expect(result.valid).toBe(true);
  });

  it('requires a variable reference on the left of a state operator', () => {
    const result = validateActionFlows([
      flow([
        block({
          id: 'b1',
          condition: { kind: 'compare', id: 'c1', left: 'free text', operator: 'isEmpty', right: '' },
        }),
      ]),
    ]);
    expect(result.valid).toBe(false);
    // The default translator answers with the key, which names the rule.
    expect(result.errors[0]?.message).toContain('ConditionStateOperandNotVariable');
  });

  it('accepts a variable reference with a state operator and blank right side', () => {
    const result = validateActionFlows([
      flow([
        block({
          id: 'b1',
          condition: { kind: 'compare', id: 'c1', left: { $var: 'artist' }, operator: 'isEmpty', right: '' },
        }),
      ]),
    ]);
    expect(result.valid).toBe(true);
  });

  it('reports an empty switch subject and an empty case value', () => {
    const result = validateActionFlows([
      flow([
        block({
          id: 'b1',
          type: 'switch',
          subject: '',
          branches: [
            { id: 'br1', kind: 'case', value: '', children: [] },
          ],
        }),
      ]),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.map(e => e.blockId)).toEqual(['b1', 'b1']);
  });

  it('flags a self widget target when the flow has no owner widget', () => {
    const result = validateActionFlows(
      [flow([block({ id: 'b1', parameters: [param({ name: 'widget', type: 'widget-target', required: true, value: WIDGET_TARGET_SELF })] })])],
      { hasOwnerWidget: false },
    );
    expect(result.valid).toBe(false);

    const owned = validateActionFlows(
      [flow([block({ id: 'b1', parameters: [param({ name: 'widget', type: 'widget-target', required: true, value: WIDGET_TARGET_SELF })] })])],
      { hasOwnerWidget: true },
    );
    expect(owned.valid).toBe(true);
  });
});

describe('isConditionComplete', () => {
  it('checks both operands of a comparison', () => {
    expect(isConditionComplete({ kind: 'compare', id: 'c', left: 'a', operator: '==', right: 'b' })).toBe(true);
    expect(isConditionComplete({ kind: 'compare', id: 'c', left: 'a', operator: '==', right: '' })).toBe(false);
  });

  it('needs a variable reference for a state operator', () => {
    expect(isConditionComplete({ kind: 'compare', id: 'c', left: { $var: 'x' }, operator: 'isAvailable', right: '' })).toBe(true);
    expect(isConditionComplete({ kind: 'compare', id: 'c', left: 'x', operator: 'isAvailable', right: '' })).toBe(false);
  });

  it('requires every operand of a group', () => {
    const group = {
      kind: 'and' as const,
      id: 'g',
      operands: [
        { kind: 'compare' as const, id: 'c1', left: 'a', operator: '==' as const, right: 'b' },
        { kind: 'compare' as const, id: 'c2', left: 'a', operator: '==' as const, right: '' },
      ],
    };
    expect(isConditionComplete(group)).toBe(false);
  });
});
