import { describe, expect, it } from 'vitest';
import type { ActionBlock, ActionBlockParameter } from '@macro-deck/runtime';
import { actionCountLabel, countActions, describeExpression, summarizeParameters } from './action-summary.util';

const t = (key: string, args?: Record<string, unknown>): string =>
  args === undefined ? key : `${key}:${JSON.stringify(args)}`;

describe('summarizeParameters', () => {
  it('joins label and value per parameter', () => {
    const params: ActionBlockParameter[] = [
      { name: 'key', type: 'string', label: 'Key', value: 'A' },
      { name: 'ms', type: 'number', label: 'Delay', value: 250 },
    ];
    expect(summarizeParameters(params, t)).toBe('Key: A · Delay: 250');
  });

  it('prefers a cached value label for non-empty string values', () => {
    const params: ActionBlockParameter[] = [
      { name: 'widget', type: 'widget-target', label: 'Widget', value: 'w-1', valueLabel: 'Button 1' },
    ];
    expect(summarizeParameters(params, t)).toBe('Widget: Button 1');
  });

  it('renders a variable reference as liquid and null as a dash', () => {
    const params: ActionBlockParameter[] = [
      { name: 'a', type: 'string', label: 'A', value: { $var: 'x' } },
      { name: 'b', type: 'string', label: 'B', value: null },
    ];
    expect(summarizeParameters(params, t)).toBe('A: {{ vars.x }} · B: -');
  });
});

describe('countActions', () => {
  it('counts nested children and branches', () => {
    const blocks: ActionBlock[] = [
      { id: 'a', blockType: 'x.a', type: 'action', label: 'a', color: '#000' },
      {
        id: 'loop',
        blockType: 'whileLoop',
        type: 'loop',
        label: 'loop',
        color: '#000',

        children: [{ id: 'c', blockType: 'x.c', type: 'action', label: 'c', color: '#000' }],
        branches: [{ id: 'br', kind: 'else', children: [{ id: 'd', blockType: 'x.d', type: 'action', label: 'd', color: '#000' }] }],
      },
    ];
    // a, loop, c, d - a branch is a container, not an action of its own.
    expect(countActions(blocks)).toBe(4);
    expect(countActions(undefined)).toBe(0);
  });

  it('labels the count', () => {
    expect(actionCountLabel(3, t)).toContain('3');
  });
});

describe('describeExpression', () => {
  it('renders a comparison and a truncated group', () => {
    expect(describeExpression({ kind: 'compare', id: 'c', left: 'a', operator: '==', right: 'b' }, t))
      .toBe('a == b');

    const group = {
      kind: 'and' as const,
      id: 'g',
      operands: [
        { kind: 'compare' as const, id: 'c1', left: 'a', operator: '==' as const, right: 'b' },
        { kind: 'compare' as const, id: 'c2', left: 'c', operator: '==' as const, right: 'd' },
        { kind: 'compare' as const, id: 'c3', left: 'e', operator: '==' as const, right: 'f' },
      ],
    };
    expect(describeExpression(group, t)).toContain('…');
    expect(describeExpression(undefined, t)).toBe('');
  });
});
