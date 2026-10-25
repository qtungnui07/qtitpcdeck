/*
 * The variable list.
 *
 * Two things here are subtler than they look.
 *
 * 1. A load can be in flight when a change event arrives. The event is newer than whatever the
 *    request read, so it is recorded in an overlay and replayed on top of the response. Without
 *    that, a variable created while the list was loading vanishes until the next load.
 *
 * 2. A value write handed to the variable's owner comes back with the value as it still stands -
 *    the authoritative one arrives later on the read side. Echoing it locally would snap the field
 *    back to the old value the instant the user committed a new one.
 */

import type {
  CreateVariableRequest,
  UpdateVariableRequest,
  Variable,
  VariableScope,
  VariableType,
  VariablesChangedEvent,
} from '@macro-deck/runtime';
import {
  createPendingStateLabelVariable,
  createPendingStateVariable,
  DEFAULT_OFF_STATE_ID,
  resolveLocalizedText,
  STATE_LABEL_VARIABLE_NAME,
  STATE_VARIABLE_NAME,
} from '@macro-deck/runtime';
import { onConnected, onNotificationOf } from './api.svelte';
import { variableEndpoints } from './endpoints';
import { localizationTranslator, translateKey } from './localization.svelte';

export interface VariableSaveResult {
  variable: Variable | null;
  errorCode: string | null;
  errorMessage?: string | null;
}

let variables = $state<Variable[]>([]);
let isLoading = $state(false);
let loadError = $state<string | null>(null);

let inFlightLoad: Promise<void> | null = null;
let loadOverlay: Map<string, Variable | null> | null = null;
let unsubscribeConnected: (() => void) | null = null;
let unsubscribeChanged: (() => void) | null = null;

export const variableStore = {
  get variables() {
    return variables;
  },
  get isLoading() {
    return isLoading;
  },
  get loadError() {
    return loadError;
  },
  get globalVariables() {
    return variables.filter(v => v.scope === 'global').sort(byClassificationThenName);
  },
};

export function visibleForContext(scope: VariableScope, scopeRefId?: string): Variable[] {
  if (scope === 'global' || !scopeRefId) {
    return variables.filter(v => v.scope === 'global').sort(byClassificationThenName);
  }

  const locals = variables.filter(v => v.scope === scope && v.scopeRefId === scopeRefId);
  const localNames = new Set(locals.map(v => v.name));
  const globals = variables.filter(v => v.scope === 'global' && !localNames.has(v.name));
  return [...locals, ...globals].sort(byClassificationThenName);
}

/*
 * The action button editor shows a widget's own variables plus the globals it can fall back to.
 * In state mode the two state variables are offered even before they exist, because the editor is
 * what creates them; outside state mode they are hidden, since a widget that is not a state widget
 * has no business binding to them.
 */
export function visibleForActionButtonEditor(
  scopeRefId: string | undefined,
  stateMode: boolean,
): Variable[] {
  if (!scopeRefId) return visibleForContext('global');

  let locals = variables.filter(v => v.scope === 'widget' && v.scopeRefId === scopeRefId);

  if (stateMode) {
    locals = [...locals, ...pendingStateVariables(scopeRefId)];
  } else {
    locals = locals.filter(
      v =>
        !(
          (v.name === STATE_VARIABLE_NAME || v.name === STATE_LABEL_VARIABLE_NAME) &&
          v.classification === 'widget'
        ),
    );
  }

  const localNames = new Set(locals.map(v => v.name));
  const globals = variables.filter(v => v.scope === 'global' && !localNames.has(v.name));
  return [...locals, ...globals].sort(byClassificationThenName);
}

function pendingStateVariables(scopeRefId: string): Variable[] {
  const existing = variables.filter(v => v.scope === 'widget' && v.scopeRefId === scopeRefId);
  const pending: Variable[] = [];

  if (!existing.some(v => v.name === STATE_VARIABLE_NAME)) {
    pending.push(createPendingStateVariable(scopeRefId, DEFAULT_OFF_STATE_ID));
  }
  if (!existing.some(v => v.name === STATE_LABEL_VARIABLE_NAME)) {
    pending.push(createPendingStateLabelVariable(scopeRefId, 'Off'));
  }
  return pending;
}

export function loadVariables(): Promise<void> {
  inFlightLoad ??= runLoad().finally(() => {
    inFlightLoad = null;
  });
  return inFlightLoad;
}

async function runLoad(): Promise<void> {
  isLoading = true;
  loadError = null;

  const overlay = new Map<string, Variable | null>();
  loadOverlay = overlay;

  try {
    const response = await variableEndpoints.list();
    const snapshot = response.variables ?? [];
    variables = overlay.size === 0 ? snapshot : applyOverlay(snapshot, overlay);
  } catch (error) {
    console.error('Failed to load variables:', error);
    loadError =
      error instanceof Error
        ? error.message
        : translateKey('macrodeck.app:Errors.Variable.LoadFailed');
  } finally {
    loadOverlay = null;
    isLoading = false;
  }
}

export async function createVariable(request: CreateVariableRequest): Promise<VariableSaveResult> {
  const response = await variableEndpoints.create(request);
  if (!response.success || !response.variable) {
    console.warn('createVariable failed:', response.error);
    return {
      variable: null,
      errorCode: response.error?.code ?? null,
      errorMessage: resolveLocalizedText(response.error?.message, localizationTranslator) || null,
    };
  }

  upsertLocal(response.variable);
  return { variable: response.variable, errorCode: null };
}

export async function updateVariable(request: UpdateVariableRequest): Promise<VariableSaveResult> {
  const response = await variableEndpoints.update(request);
  if (!response.success || !response.variable) {
    console.warn('updateVariable failed:', response.error);
    return {
      variable: null,
      errorCode: response.error?.code ?? null,
      errorMessage: resolveLocalizedText(response.error?.message, localizationTranslator) || null,
    };
  }

  upsertLocal(response.variable);
  return { variable: response.variable, errorCode: null };
}

export async function setVariableShared(id: string, shared: boolean): Promise<VariableSaveResult> {
  const response = await variableEndpoints.setShared({ id, shared });
  if (!response.success || !response.variable) {
    console.warn('setVariableShared failed:', response.error);
    return { variable: null, errorCode: response.error?.code ?? null };
  }

  upsertLocal(response.variable);
  return { variable: response.variable, errorCode: null };
}

export async function deleteVariable(id: string): Promise<boolean> {
  const response = await variableEndpoints.remove(id);
  if (!response.success) {
    console.warn('deleteVariable failed:', response.error);
    return false;
  }

  deleteLocal(id);
  return true;
}

export async function setVariableValue(
  id: string,
  value: string | undefined,
  resourceIntegrationId?: string,
  resourceKey?: string,
): Promise<VariableSaveResult> {
  const response = await variableEndpoints.setValue({ id, value, resourceIntegrationId, resourceKey });
  if (!response.success || !response.variable) {
    console.warn('setVariableValue failed:', response.error);
    return {
      variable: null,
      errorCode: response.error?.code ?? null,
      errorMessage: resolveLocalizedText(response.error?.message, localizationTranslator) || null,
    };
  }

  // See the note at the top of the file: a pending write must not be echoed.
  if (!response.pending) {
    upsertLocal(response.variable);
  }
  return { variable: response.variable, errorCode: null };
}

export async function sanitizeVariableName(
  input: string,
): Promise<{ sanitized: string; isValid: boolean }> {
  if (!input) return { sanitized: '', isValid: false };

  try {
    const response = await variableEndpoints.sanitizeName({ input });
    return { sanitized: response.sanitized, isValid: response.isValid };
  } catch {
    return sanitizeVariableNameLocal(input);
  }
}

export function sanitizeVariableNameLocal(input: string): { sanitized: string; isValid: boolean } {
  if (!input) return { sanitized: '', isValid: false };

  let trimmed = input.trim();
  if (trimmed.toLowerCase().startsWith(PUBLIC_PREFIX)) {
    trimmed = trimmed.slice(PUBLIC_PREFIX.length);
  }

  const folded = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let out = '';
  for (const ch of folded) {
    if (/[a-z0-9_]/.test(ch)) out += ch;
    else if (/[A-Z]/.test(ch)) out += ch.toLowerCase();
    else out += '_';
  }

  out = out.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (out.length > 0 && /[0-9]/.test(out[0])) {
    out = `v_${out}`;
  }

  return { sanitized: out, isValid: VALID_NAME.test(out) };
}

export function resolveVariable(
  name: string,
  scope: VariableScope = 'global',
  scopeRefId?: string,
): Variable | undefined {
  if (scope !== 'global' && scopeRefId) {
    const local = variables.find(
      v => v.scope === scope && v.scopeRefId === scopeRefId && v.name === name,
    );
    if (local) return local;
  }
  return variables.find(v => v.scope === 'global' && v.name === name);
}

export function filterVariablesByTypes(
  scope: VariableScope,
  scopeRefId: string | undefined,
  acceptedTypes: VariableType[] | undefined,
): Variable[] {
  const visible = visibleForContext(scope, scopeRefId);
  if (!acceptedTypes || acceptedTypes.length === 0) return visible;
  return visible.filter(v => acceptedTypes.includes(v.type));
}

export function applyVariableBatch(upserted: Variable[], deletedIds: string[]): void {
  if (upserted.length === 0 && deletedIds.length === 0) return;

  const deleted = new Set(deletedIds);

  for (const variable of upserted) {
    if (!deleted.has(variable.id)) loadOverlay?.set(variable.id, variable);
  }
  for (const id of deleted) {
    loadOverlay?.set(id, null);
  }

  const indexById = new Map<string, number>();
  variables.forEach((v, i) => indexById.set(v.id, i));

  const next = variables.slice();
  for (const variable of upserted) {
    if (deleted.has(variable.id)) continue;

    const at = indexById.get(variable.id);
    if (at === undefined) {
      indexById.set(variable.id, next.length);
      next.push(variable);
    } else {
      next[at] = variable;
    }
  }

  variables = deleted.size === 0 ? next : next.filter(v => !deleted.has(v.id));
}

function upsertLocal(variable: Variable): void {
  loadOverlay?.set(variable.id, variable);

  const at = variables.findIndex(v => v.id === variable.id);
  if (at === -1) {
    variables = [...variables, variable];
    return;
  }

  const next = variables.slice();
  next[at] = variable;
  variables = next;
}

function deleteLocal(id: string): void {
  loadOverlay?.set(id, null);
  variables = variables.filter(v => v.id !== id);
}

function applyOverlay(
  snapshot: Variable[],
  overlay: Map<string, Variable | null>,
): Variable[] {
  const merged = snapshot.filter(v => overlay.get(v.id) !== null);

  for (const [id, variable] of overlay) {
    if (variable === null) continue;

    const at = merged.findIndex(v => v.id === id);
    if (at === -1) merged.push(variable);
    else merged[at] = variable;
  }

  return merged;
}

const CLASSIFICATION_ORDER: Record<string, number> = {
  user: 0,
  integration: 1,
  widget: 2,
};

function byClassificationThenName(a: Variable, b: Variable): number {
  const byClass =
    (CLASSIFICATION_ORDER[a.classification] ?? 99) - (CLASSIFICATION_ORDER[b.classification] ?? 99);
  if (byClass !== 0) return byClass;
  return a.name.localeCompare(b.name);
}

const VALID_NAME = /^[a-z][a-z0-9_]*$/;
const PUBLIC_PREFIX = 'vars.';

export function startVariables(): void {
  stopVariables();

  unsubscribeChanged = onNotificationOf<VariablesChangedEvent>('VariablesChangedEvent', event => {
    applyVariableBatch(event.upserted ?? [], event.deletedIds ?? []);
  });

  unsubscribeConnected = onConnected(() => {
    void loadVariables();
  });
}

export function stopVariables(): void {
  unsubscribeChanged?.();
  unsubscribeChanged = null;
  unsubscribeConnected?.();
  unsubscribeConnected = null;
}

export function resetVariables(): void {
  stopVariables();
  variables = [];
  isLoading = false;
  loadError = null;
  inFlightLoad = null;
  loadOverlay = null;
}
