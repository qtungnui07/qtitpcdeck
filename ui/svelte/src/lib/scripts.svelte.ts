/*
 * Script state, ported from the Angular ScriptService.
 *
 * Scripts are reusable named sequences of actions that can accept inputs and be triggered
 * from action flows, widgets, or the UI.
 *
 * All state is managed via Svelte 5 runes ($state) with read-only getters on scriptStore.
 * WebSocket notifications keep scripts in sync in real time.
 */

import {
  type ActionFlow,
  type ApiError,
  AppStrings,
  type IpcScript,
  normalizeScriptInputs,
  type Result,
  type RunScriptResponse,
  type Script,
  type ScriptCreatedEvent,
  type ScriptDeletedEvent,
  type ScriptInput,
  type ScriptInputValue,
  type ScriptUpdatedEvent,
  type ScriptUsage,
} from '@macro-deck/runtime';
import { api, onNotificationOf } from './api.svelte';
import { scriptEndpoints } from './endpoints';
import { translateKey } from './localization.svelte';

let scripts = $state<Script[]>([]);
let isLoading = $state(false);
let loadError = $state<string | null>(null);

let unsubscribeCreated: (() => void) | null = null;
let unsubscribeUpdated: (() => void) | null = null;
let unsubscribeDeleted: (() => void) | null = null;

export const scriptStore = {
  get scripts(): Script[] {
    return scripts;
  },
  get sortedScripts(): Script[] {
    return [...scripts].sort((a, b) => a.name.localeCompare(b.name));
  },
  get isLoading(): boolean {
    return isLoading;
  },
  get loadError(): string | null {
    return loadError;
  },
};

export async function loadScripts(): Promise<void> {
  isLoading = true;
  loadError = null;

  try {
    const response = await scriptEndpoints.list();
    scripts = (response.scripts ?? []).map(mapIpcScript);
  } catch (error) {
    console.error('Failed to load scripts:', error);
    loadError =
      error instanceof Error
        ? error.message
        : translateKey(AppStrings.Errors.Script.LoadFailed);
  } finally {
    isLoading = false;
  }
}

export async function createScript(
  name: string,
  description?: string,
  flows?: ActionFlow[],
): Promise<Result<Script>> {
  return mutate(
    () => scriptEndpoints.create({ name, description, flows: serializeFlows(flows ?? []) }),
    translateKey(AppStrings.Errors.Script.CreateFailed),
  );
}

export async function updateScript(
  id: string,
  changes: {
    name?: string;
    description?: string;
    flows?: ActionFlow[];
    inputs?: ScriptInput[];
    runsOnWidget?: boolean;
  },
): Promise<Result<Script>> {
  return mutate(
    () =>
      scriptEndpoints.update({
        id,
        name: changes.name,
        description: changes.description,
        flows: changes.flows ? serializeFlows(changes.flows) : undefined,
        inputs: changes.inputs,
        runsOnWidget: changes.runsOnWidget,
      }),
    translateKey(AppStrings.Errors.Script.UpdateFailed),
  );
}

export async function duplicateScript(id: string): Promise<Result<Script>> {
  return mutate(
    () => scriptEndpoints.duplicate(id),
    translateKey(AppStrings.Errors.Script.DuplicateFailed),
  );
}

export async function deleteScript(id: string): Promise<Result<void>> {
  try {
    const response = await scriptEndpoints.delete(id);
    if (!response.success) {
      return { success: false, error: response.error };
    }

    removeFromState(id);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: toTransportError(error, translateKey(AppStrings.Errors.Script.DeleteFailed)),
    };
  }
}

export async function getUsages(id: string): Promise<ScriptUsage[]> {
  try {
    const response = await scriptEndpoints.usages(id);
    return response.usages ?? [];
  } catch (error) {
    console.error('Failed to load script usages:', error);
    return [];
  }
}

export async function runScript(
  id: string,
  inputs?: Record<string, ScriptInputValue>,
): Promise<Result<RunScriptResponse>> {
  try {
    const response = await scriptEndpoints.run({ id, clientId: api.clientId, inputs });
    return response.success
      ? { success: true, data: response }
      : { success: false, error: response.error };
  } catch (error) {
    return {
      success: false,
      error: toTransportError(error, translateKey(AppStrings.Errors.Script.RunFailed)),
    };
  }
}

export function startScripts(): void {
  stopScripts();

  unsubscribeCreated = onNotificationOf<ScriptCreatedEvent>('ScriptCreatedEvent', (event) => {
    if (event.script) {
      upsert(mapIpcScript(event.script));
    }
  });

  unsubscribeUpdated = onNotificationOf<ScriptUpdatedEvent>('ScriptUpdatedEvent', (event) => {
    if (event.script) {
      upsert(mapIpcScript(event.script));
    }
  });

  unsubscribeDeleted = onNotificationOf<ScriptDeletedEvent>('ScriptDeletedEvent', (event) => {
    if (event.id) {
      removeFromState(event.id);
    }
  });
}

export function stopScripts(): void {
  unsubscribeCreated?.();
  unsubscribeUpdated?.();
  unsubscribeDeleted?.();
  unsubscribeCreated = null;
  unsubscribeUpdated = null;
  unsubscribeDeleted = null;
}

export function resetScripts(): void {
  stopScripts();
  scripts = [];
  isLoading = false;
  loadError = null;
}

export function setScriptsForTesting(items: Script[]): void {
  scripts = [...items];
  isLoading = false;
  loadError = null;
}

async function mutate(
  call: () => Promise<{ success: boolean; script?: IpcScript; error?: ApiError }>,
  failureMessage: string,
): Promise<Result<Script>> {
  try {
    const response = await call();
    if (!response.success) {
      return { success: false, error: response.error };
    }
    if (!response.script) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: translateKey(AppStrings.Errors.Script.NoScriptReturned),
        },
      };
    }

    const script = mapIpcScript(response.script);
    upsert(script);
    return { success: true, data: script };
  } catch (error) {
    console.error(`${failureMessage}:`, error);
    return { success: false, error: toTransportError(error, failureMessage) };
  }
}

function upsert(script: Script): void {
  const existing = scripts.findIndex((s) => s.id === script.id);
  if (existing >= 0) {
    scripts = scripts.map((s) => (s.id === script.id ? script : s));
  } else {
    scripts = [...scripts, script];
  }
}

function removeFromState(id: string): void {
  scripts = scripts.filter((s) => s.id !== id);
}

function mapIpcScript(script: IpcScript): Script {
  return {
    id: script.id,
    name: script.name,
    description: script.description ?? '',
    flows: parseFlows(script.flows),
    inputs: normalizeScriptInputs(script.inputs),
    runsOnWidget: script.runsOnWidget ?? false,
    createdAt: script.createdAt,
    updatedAt: script.updatedAt,
  };
}

function parseFlows(flows: string | undefined): ActionFlow[] {
  if (!flows) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(flows);
    return Array.isArray(parsed) ? (parsed as ActionFlow[]) : [];
  } catch {
    console.warn('Failed to parse script flows');
    return [];
  }
}

function serializeFlows(flows: ActionFlow[]): string {
  return JSON.stringify(flows);
}

function toTransportError(error: unknown, fallback: string): ApiError {
  return { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : fallback };
}
