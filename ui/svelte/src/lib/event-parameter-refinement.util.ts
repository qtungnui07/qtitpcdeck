/*
 * Event payload parameter refinement, ported verbatim from the Angular util:
 * when a trigger watches a variable, its payload parameters narrow to that
 * variable's type (a boolean variable's payload compare becomes a choice of
 * true/false, anything else numeric).
 */

import { type ActionBlockParameter, type EventDefinition } from '@macro-deck/runtime';
import type { Variable } from '@macro-deck/runtime';

const VARIABLES_OPTIONS_SOURCE_ID = 'macrodeck.variables';

const BOOLEAN_VALUE_OPTIONS: { label: string; value: string }[] = [
  { label: 'true', value: 'true' },
  { label: 'false', value: 'false' },
];

export function refineEventConfigurationParameters(
  definition: EventDefinition | undefined,
  parameters: ActionBlockParameter[],
  variables: Variable[],
): ActionBlockParameter[] {
  if (!definition) return parameters;

  const picker = parameters.find(p => p.optionsSourceId === VARIABLES_OPTIONS_SOURCE_ID);
  const watchedName = typeof picker?.value === 'string' ? picker.value : '';
  if (!watchedName) return parameters;

  const watched = variables.find(v => v.name === watchedName && v.origin !== 'event');
  if (!watched || watched.type === 'text' || watched.type === 'color') return parameters;

  const payloadNames = new Set(definition.payloadParameters.map(p => p.name));

  return parameters.map(param => {
    if (param === picker || !payloadNames.has(param.name) || param.type !== 'string') {
      return param;
    }

    return watched.type === 'boolean'
      ? { ...param, type: 'choice' as const, options: BOOLEAN_VALUE_OPTIONS }
      : { ...param, type: 'number' as const };
  });
}
