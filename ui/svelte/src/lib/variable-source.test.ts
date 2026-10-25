import { describe, expect, it } from 'vitest';
import type { Variable } from '@macro-deck/runtime';
import {
  groupVariablesBySource,
  integrationSourceEntries,
  isEventParameter,
  isScopeLocal,
  isScriptInput,
  matchesVariableSource,
  scopeLabelKey,
  variableTypeLabels,
} from './variable-source';

function variable(overrides: Partial<Variable> & { id: string }): Variable {
  return {
    name: overrides.id,
    scope: 'global',
    type: 'text',
    classification: 'user',
    value: '',
    ...overrides,
  } as Variable;
}

const translate = (key: string) => key;
const nameOf = (id: string) => `name:${id}`;

describe('variable type labels', () => {
  it('maps every type to its catalog key', () => {
    expect(variableTypeLabels(translate)).toEqual({
      text: 'macrodeck.app:Variables.Manager.TypeText',
      numeric: 'macrodeck.app:Variables.Manager.TypeNumeric',
      boolean: 'macrodeck.app:Variables.Manager.TypeBoolean',
      color: 'macrodeck.app:Variables.Manager.TypeColor',
    });
  });
});

describe('scopeLabelKey', () => {
  it('names the scope the variable lives in', () => {
    expect(scopeLabelKey('script')).toBe('macrodeck.app:Variables.ThisScript');
    expect(scopeLabelKey('automation')).toBe('macrodeck.app:Variables.ThisAutomation');
    expect(scopeLabelKey('widget')).toBe('macrodeck.app:Variables.ThisWidget');
    expect(scopeLabelKey('global')).toBe('macrodeck.app:Variables.ThisWidget');
  });
});

describe('origin classification', () => {
  it('treats an event origin as an event parameter', () => {
    expect(isEventParameter(variable({ id: 'a', origin: 'event' }))).toBe(true);
    expect(isEventParameter(variable({ id: 'a' }))).toBe(false);
  });

  it('treats an input origin as a script input', () => {
    expect(isScriptInput(variable({ id: 'a', origin: 'input' }))).toBe(true);
    expect(isScriptInput(variable({ id: 'a' }))).toBe(false);
  });

  it('counts a non-global variable with no origin as a scope local', () => {
    expect(isScopeLocal(variable({ id: 'a', scope: 'widget' }))).toBe(true);
    expect(isScopeLocal(variable({ id: 'a', scope: 'global' }))).toBe(false);
  });

  it('does not count an event parameter as a scope local even when it is widget scoped', () => {
    expect(isScopeLocal(variable({ id: 'a', scope: 'widget', origin: 'event' }))).toBe(false);
  });
});

describe('matchesVariableSource', () => {
  const user = variable({ id: 'user', classification: 'user' });
  const integration = variable({
    id: 'integration',
    classification: 'integration',
    ownerIntegrationId: 'plug',
  });
  const widgetLocal = variable({ id: 'local', scope: 'widget' });
  const eventParam = variable({ id: 'event', origin: 'event' });
  const scriptInput = variable({ id: 'input', origin: 'input' });

  it('shows everything for the all source', () => {
    for (const v of [user, integration, widgetLocal, eventParam, scriptInput]) {
      expect(matchesVariableSource(v, { kind: 'all' })).toBe(true);
    }
  });

  it('shows only global user variables for the user source', () => {
    expect(matchesVariableSource(user, { kind: 'user' })).toBe(true);
    expect(matchesVariableSource(integration, { kind: 'user' })).toBe(false);
    expect(matchesVariableSource(widgetLocal, { kind: 'user' })).toBe(false);
  });

  it('shows only scope locals for the scope source', () => {
    expect(matchesVariableSource(widgetLocal, { kind: 'scope' })).toBe(true);
    expect(matchesVariableSource(user, { kind: 'scope' })).toBe(false);
  });

  it('shows only event parameters for the event source', () => {
    expect(matchesVariableSource(eventParam, { kind: 'event' })).toBe(true);
    expect(matchesVariableSource(scriptInput, { kind: 'event' })).toBe(false);
  });

  it('shows only the owning integration for an integration source', () => {
    expect(matchesVariableSource(integration, { kind: 'integration', integrationId: 'plug' })).toBe(
      true,
    );
    expect(matchesVariableSource(integration, { kind: 'integration', integrationId: 'other' })).toBe(
      false,
    );
    expect(matchesVariableSource(user, { kind: 'integration', integrationId: 'plug' })).toBe(false);
  });

  it('hides an event parameter from its own integration source', () => {
    const ownedEvent = variable({
      id: 'owned-event',
      origin: 'event',
      ownerIntegrationId: 'plug',
    });
    expect(
      matchesVariableSource(ownedEvent, { kind: 'integration', integrationId: 'plug' }),
    ).toBe(false);
  });
});

describe('groupVariablesBySource', () => {
  it('orders groups event, input, scope, user, integrations, other', () => {
    const groups = groupVariablesBySource(
      [
        variable({ id: 'other', classification: 'integration' }),
        variable({ id: 'plug-b', classification: 'integration', ownerIntegrationId: 'b' }),
        variable({ id: 'plug-a', classification: 'integration', ownerIntegrationId: 'a' }),
        variable({ id: 'user' }),
        variable({ id: 'local', scope: 'widget' }),
        variable({ id: 'input', origin: 'input' }),
        variable({ id: 'event', origin: 'event' }),
      ],
      'scope-label',
      nameOf,
      translate,
    );

    expect(groups.map(g => g.key)).toEqual([
      'event',
      'input',
      'scope',
      'user',
      'integration:a',
      'integration:b',
      'other',
    ]);
  });

  it('omits a group that has no variables', () => {
    const groups = groupVariablesBySource([variable({ id: 'user' })], 'scope', nameOf, translate);
    expect(groups.map(g => g.key)).toEqual(['user']);
  });

  it('sorts integration groups by display name, not by id', () => {
    const groups = groupVariablesBySource(
      [
        variable({ id: 'z', classification: 'integration', ownerIntegrationId: 'z' }),
        variable({ id: 'a', classification: 'integration', ownerIntegrationId: 'a' }),
      ],
      'scope',
      id => (id === 'z' ? 'Alpha' : 'Zulu'),
      translate,
    );

    expect(groups.map(g => g.label)).toEqual(['Alpha', 'Zulu']);
  });

  it('puts a variable in the first category that claims it', () => {
    // Widget scoped and user classified: the scope check runs first, so it is a local.
    const groups = groupVariablesBySource(
      [variable({ id: 'both', scope: 'widget', classification: 'user' })],
      'scope',
      nameOf,
      translate,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('scope');
  });

  it('keeps the incoming order inside a group', () => {
    const groups = groupVariablesBySource(
      [variable({ id: 'c' }), variable({ id: 'a' }), variable({ id: 'b' })],
      'scope',
      nameOf,
      translate,
    );

    expect(groups[0].variables.map(v => v.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('integrationSourceEntries', () => {
  it('counts global variables per owning integration', () => {
    const entries = integrationSourceEntries(
      [
        variable({ id: 'a', classification: 'integration', ownerIntegrationId: 'plug' }),
        variable({ id: 'b', classification: 'integration', ownerIntegrationId: 'plug' }),
      ],
      nameOf,
    );

    expect(entries).toEqual([{ integrationId: 'plug', name: 'name:plug', count: 2 }]);
  });

  it('includes a catalog provider that has no variables yet', () => {
    const entries = integrationSourceEntries([], nameOf, ['plug']);
    expect(entries).toEqual([{ integrationId: 'plug', name: 'name:plug', count: 0 }]);
  });

  it('does not double count a provider that also has variables', () => {
    const entries = integrationSourceEntries(
      [variable({ id: 'a', classification: 'integration', ownerIntegrationId: 'plug' })],
      nameOf,
      ['plug'],
    );

    expect(entries).toEqual([{ integrationId: 'plug', name: 'name:plug', count: 1 }]);
  });

  it('ignores a non-global variable', () => {
    const entries = integrationSourceEntries(
      [variable({ id: 'a', scope: 'widget', ownerIntegrationId: 'plug' })],
      nameOf,
    );

    expect(entries).toEqual([]);
  });

  it('ignores a script input', () => {
    const entries = integrationSourceEntries(
      [variable({ id: 'a', origin: 'input', ownerIntegrationId: 'plug' })],
      nameOf,
    );

    expect(entries).toEqual([]);
  });

  it('sorts by display name', () => {
    const entries = integrationSourceEntries(
      [
        variable({ id: 'a', classification: 'integration', ownerIntegrationId: 'z' }),
        variable({ id: 'b', classification: 'integration', ownerIntegrationId: 'a' }),
      ],
      id => (id === 'z' ? 'Alpha' : 'Zulu'),
    );

    expect(entries.map(e => e.name)).toEqual(['Alpha', 'Zulu']);
  });
});
