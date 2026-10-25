/*
 * Automation state, ported from the Angular AutomationService.
 *
 * Automations connect system and integration events (e.g. OBS scene change, system timer,
 * audio device connection) to action flows that run in the background.
 *
 * All state is managed via Svelte 5 runes ($state) with read-only getters on automationStore.
 * WebSocket notifications keep automations in sync in real time.
 */

import {
  type ActionFlow,
  type ApiError,
  AppStrings,
  type AutomationCreatedEvent,
  type AutomationDeletedEvent,
  type AutomationUpdatedEvent,
  type IpcAutomation,
  type Result,
} from '@macro-deck/runtime';
import { onNotificationOf } from './api.svelte';
import { type Automation } from './automation';
import { automationEndpoints } from './endpoints';
import { translateKey } from './localization.svelte';

let automations = $state<Automation[]>([]);
let isLoading = $state(false);
let loadError = $state<string | null>(null);

let unsubscribeCreated: (() => void) | null = null;
let unsubscribeUpdated: (() => void) | null = null;
let unsubscribeDeleted: (() => void) | null = null;

export const automationStore = {
  get automations(): Automation[] {
    return automations;
  },
  get sortedAutomations(): Automation[] {
    return [...automations].sort((a, b) => a.name.localeCompare(b.name));
  },
  get isLoading(): boolean {
    return isLoading;
  },
  get loadError(): string | null {
    return loadError;
  },
};

export async function loadAutomations(): Promise<void> {
  isLoading = true;
  loadError = null;

  try {
    const response = await automationEndpoints.list();
    automations = (response.automations ?? []).map(mapIpcAutomation);
  } catch (error) {
    console.error('Failed to load automations:', error);
    loadError =
      error instanceof Error
        ? error.message
        : translateKey(AppStrings.Errors.Automation.LoadFailed);
  } finally {
    isLoading = false;
  }
}

export async function createAutomation(
  name: string,
  description?: string,
  flows?: ActionFlow[],
): Promise<Result<Automation>> {
  return mutate(
    () => automationEndpoints.create({ name, description, flows: serializeFlows(flows ?? []) }),
    translateKey(AppStrings.Errors.Automation.CreateFailed),
  );
}

export async function updateAutomation(
  id: string,
  changes: { name?: string; description?: string; flows?: ActionFlow[]; enabled?: boolean },
): Promise<Result<Automation>> {
  return mutate(
    () =>
      automationEndpoints.update({
        id,
        name: changes.name,
        description: changes.description,
        flows: changes.flows ? serializeFlows(changes.flows) : undefined,
        enabled: changes.enabled,
      }),
    translateKey(AppStrings.Errors.Automation.UpdateFailed),
  );
}

export async function setEnabled(id: string, enabled: boolean): Promise<Result<Automation>> {
  return updateAutomation(id, { enabled });
}

export async function duplicateAutomation(id: string): Promise<Result<Automation>> {
  return mutate(
    () => automationEndpoints.duplicate(id),
    translateKey(AppStrings.Errors.Automation.DuplicateFailed),
  );
}

export async function deleteAutomation(id: string): Promise<Result<void>> {
  try {
    const response = await automationEndpoints.delete(id);
    if (!response.success) {
      return { success: false, error: response.error };
    }

    removeFromState(id);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: toTransportError(error, translateKey(AppStrings.Errors.Automation.DeleteFailed)),
    };
  }
}

export function startAutomations(): void {
  stopAutomations();

  unsubscribeCreated = onNotificationOf<AutomationCreatedEvent>(
    'AutomationCreatedEvent',
    (event) => {
      if (event.automation) {
        upsert(mapIpcAutomation(event.automation));
      }
    },
  );

  unsubscribeUpdated = onNotificationOf<AutomationUpdatedEvent>(
    'AutomationUpdatedEvent',
    (event) => {
      if (event.automation) {
        upsert(mapIpcAutomation(event.automation));
      }
    },
  );

  unsubscribeDeleted = onNotificationOf<AutomationDeletedEvent>(
    'AutomationDeletedEvent',
    (event) => {
      if (event.id) {
        removeFromState(event.id);
      }
    },
  );
}

export function stopAutomations(): void {
  unsubscribeCreated?.();
  unsubscribeUpdated?.();
  unsubscribeDeleted?.();
  unsubscribeCreated = null;
  unsubscribeUpdated = null;
  unsubscribeDeleted = null;
}

export function resetAutomations(): void {
  stopAutomations();
  automations = [];
  isLoading = false;
  loadError = null;
}

export function setAutomationsForTesting(items: Automation[]): void {
  automations = [...items];
  isLoading = false;
  loadError = null;
}

async function mutate(
  call: () => Promise<{ success: boolean; automation?: IpcAutomation; error?: ApiError }>,
  failureMessage: string,
): Promise<Result<Automation>> {
  try {
    const response = await call();
    if (!response.success) {
      return { success: false, error: response.error };
    }
    if (!response.automation) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: translateKey(AppStrings.Errors.Automation.NoAutomationReturned),
        },
      };
    }

    const automation = mapIpcAutomation(response.automation);
    upsert(automation);
    return { success: true, data: automation };
  } catch (error) {
    console.error(`${failureMessage}:`, error);
    return { success: false, error: toTransportError(error, failureMessage) };
  }
}

function upsert(automation: Automation): void {
  const existing = automations.findIndex((a) => a.id === automation.id);
  if (existing >= 0) {
    automations = automations.map((a) => (a.id === automation.id ? automation : a));
  } else {
    automations = [...automations, automation];
  }
}

function removeFromState(id: string): void {
  automations = automations.filter((a) => a.id !== id);
}

function mapIpcAutomation(automation: IpcAutomation): Automation {
  return {
    id: automation.id,
    name: automation.name,
    description: automation.description ?? '',
    enabled: automation.enabled ?? true,
    flows: parseFlows(automation.flows),
    createdAt: automation.createdAt,
    updatedAt: automation.updatedAt,
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
    console.warn('Failed to parse automation flows');
    return [];
  }
}

function serializeFlows(flows: ActionFlow[]): string {
  return JSON.stringify(flows);
}

function toTransportError(error: unknown, fallback: string): ApiError {
  return { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : fallback };
}
