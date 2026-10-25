import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRIGGER_TYPE,
  comparisonOperatorOptions,
  defaultActionDefs,
  defaultTriggerTabs,
  fixedTriggerTabsFor,
  interactionTriggerTabsFor,
  toggleTriggerTab,
} from './default-action-defs';

const t = (key: string): string => `T(${key})`;

describe('trigger tab derivation', () => {
  it('derives the interaction set: presses plus the widget type\'s own timer triggers', () => {
    const tabs = interactionTriggerTabsFor(['onShortPress', 'onCountdownFinished'], t);
    expect(tabs?.map(tab => tab.triggerType)).toEqual(['onShortPress', 'onCountdownFinished']);
  });

  it('rejects the interaction set when a trigger is outside it', () => {
    expect(interactionTriggerTabsFor(['onShortPress', 'onSomethingElse'], t)).toBeNull();
  });

  it('derives a fixed set for a named vocabulary without presses', () => {
    const tabs = fixedTriggerTabsFor(['onStateChange'], t);
    expect(tabs?.map(tab => tab.triggerType)).toEqual(['onStateChange']);
  });

  it('derives no fixed set when a press trigger is named', () => {
    expect(fixedTriggerTabsFor(['onShortPress', 'onStateChange'], t)).toBeNull();
  });

  it('derives no fixed set for an unknown vocabulary', () => {
    expect(fixedTriggerTabsFor(['onSomethingElse'], t)).toBeNull();
    expect(fixedTriggerTabsFor([], t)).toBeNull();
  });

  it('offers the default press vocabulary and the toggle trigger', () => {
    expect(defaultTriggerTabs(t).map(tab => tab.triggerType)).toContain(DEFAULT_TRIGGER_TYPE);
    expect(toggleTriggerTab(t).triggerType).toBe('onStateChange');
  });
});

describe('default action definitions', () => {
  it('covers the logic blocks with distinct block types', () => {
    const defs = defaultActionDefs(t);
    expect(defs.map(d => d.blockType)).toEqual(['wait', 'ifElse', 'switch', 'repeatLoop', 'whileLoop', 'break']);
    expect(defs.find(d => d.blockType === 'break')?.loopOnly).toBe(true);
    expect(defs.find(d => d.blockType === 'ifElse')?.hasBranches).toBe(true);
    expect(defs.find(d => d.blockType === 'whileLoop')?.hasCondition).toBe(true);
  });
});

describe('comparison operators', () => {
  it('lists the full set including state operators', () => {
    const values = comparisonOperatorOptions(t).map(o => o.value);
    expect(values).toContain('==');
    expect(values).toContain('contains');
    expect(values).toContain('isEmpty');
  });
});
