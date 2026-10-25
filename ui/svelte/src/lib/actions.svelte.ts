/*
 * The action catalogue, ported from the Angular ActionService.
 *
 * The host owns what actions exist (every integration's, built-in included);
 * this store caches `GET /api/actions`, resolves the localized labels once at
 * load, and derives the block definitions the action builder offers - one
 * droppable block per action, categorized by its integration.
 */

import {
  type ActionBlockDefinition,
  type ActionBlockParameter,
  type ActionDefinition,
  resolveLocalizedText,
} from '@macro-deck/runtime';
import { actionEndpoints } from './endpoints';
import { loadIntegrations, integrationStore } from './integrations.svelte';
import { localizationTranslator } from './localization.svelte';
import { mapActionParameterDef } from './action-parameter-mapping';

export interface ActionDefinitionModel {
  id: string;
  integrationId: string;
  integrationName: string;
  name: string;
  description: string;
  parameters: ActionDefinition['parameters'];
  descriptiveUiSchema?: string;
  role?: string;
  isStateProviderAction?: boolean;
  isIconProviderAction?: boolean;
  supportsConfigUi?: boolean;
  configUiModelVersion?: number;
}

const DEFAULT_INTEGRATION_CATEGORY = 'Unknown';

let actions = $state<ActionDefinitionModel[]>([]);
let isLoading = $state(false);
let loaded = false;

export const actionStore = {
  get actions(): readonly ActionDefinitionModel[] {
    return actions;
  },
  get isLoading(): boolean {
    return isLoading;
  },
};

export async function loadActions(): Promise<void> {
  if (loaded) return;
  isLoading = true;
  try {
    const response = await actionEndpoints.list();
    actions = (response.actions || []).map(a => mapAction(a));
    loaded = true;
  } catch (error) {
    console.error('Failed to load actions:', error);
  } finally {
    isLoading = false;
  }
}

export function resetActionStore(): void {
  actions = [];
  isLoading = false;
  loaded = false;
}

export function actionsForIntegration(integrationId: string): ActionDefinitionModel[] {
  return actions
    .filter(a => a.integrationId === integrationId)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function blockParameterDefs(action: ActionDefinitionModel): Omit<ActionBlockParameter, 'value'>[] {
  return (action.parameters ?? []).map(p => mapActionParameterDef(p, localizationTranslator));
}

export function definitionFor(
  integrationId: string | undefined,
  actionId: string | undefined,
): ActionDefinitionModel | undefined {
  if (!integrationId || !actionId) return undefined;
  return actions.find(a => a.integrationId === integrationId && a.id === actionId);
}

/**
 * One block per action. The category is the integration's display name - the
 * one the action itself carries, else the loaded integration's, else the raw
 * id - because a block without a category lands in no picker group at all.
 */
export function actionBlockDefinitions(): ActionBlockDefinition[] {
  return actions.map(action => {
    const integration = integrationStore.integrations.find(i => i.id === action.integrationId);
    const category = action.integrationName
      || integration?.name
      || action.integrationId
      || DEFAULT_INTEGRATION_CATEGORY;

    return {
      blockType: `${action.integrationId}.${action.id}`,
      type: 'action' as const,
      label: action.name,
      description: action.description || undefined,
      color: '#3b82f6',
      category,
      categoryId: action.integrationId,
      integrationId: action.integrationId,
      actionId: action.id,
      blockShape: 'stack' as const,
      descriptiveUiSchema: action.descriptiveUiSchema,
      role: action.role,
      providesButtonState: action.isStateProviderAction,
      providesWidgetIcon: action.isIconProviderAction,
      parameters: (action.parameters ?? []).map(p => mapActionParameterDef(p, localizationTranslator)),
    };
  });
}

function mapAction(action: ActionDefinition): ActionDefinitionModel {
  return {
    id: action.id,
    integrationId: action.integrationId,
    integrationName: resolveLocalizedText(action.integrationName, localizationTranslator),
    name: resolveLocalizedText(action.name, localizationTranslator),
    description: resolveLocalizedText(action.description, localizationTranslator),
    descriptiveUiSchema: action.descriptiveUiSchema ?? undefined,
    role: action.role ?? undefined,
    parameters: action.parameters || [],
    isStateProviderAction: action.isStateProviderAction ?? false,
    isIconProviderAction: action.isIconProviderAction ?? false,
    supportsConfigUi: action.supportsConfigUi ?? false,
    configUiModelVersion: action.configUiModelVersion ?? 0,
  };
}

/** Loads the catalogue together with the integrations that categorize it. */
export async function loadActionCatalogue(): Promise<void> {
  await Promise.all([loadIntegrations(), loadActions()]);
}
