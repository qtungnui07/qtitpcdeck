/*
 * Developer tools store, ported from the Angular Developer section.
 *
 * Provides inspection and testing for:
 * - Extension actions and running action flows
 * - Events and event triggers
 * - Template rendering and conditional expression evaluation
 * - Host log stream and source filtering
 */

import {
  type ActionDefinition,
  type ConditionExpressionPayload,
  type ConditionSidePayload,
  type EventDefinitionDto,
  type ExecuteActionRequest,
  type ExecuteActionResponse,
  type LogEntry,
  type LogEntryLevel,
  type LogSourceSummary,
  type RunActionFlowRequest,
  type RunActionFlowResponse,
  type TriggerEventRequest,
  type TriggerEventResponse,
} from '@macro-deck/runtime';
import { developerEndpoints } from './endpoints';

let actions = $state<ActionDefinition[]>([]);
let events = $state<EventDefinitionDto[]>([]);
let logSources = $state<LogSourceSummary[]>([]);
let logs = $state<LogEntry[]>([]);

let selectedAction = $state<ActionDefinition | null>(null);
let selectedEvent = $state<EventDefinitionDto | null>(null);
let selectedLogSource = $state<string>('');

let isExecuting = $state(false);
let executionResult = $state<string | null>(null);

let templateOutput = $state<string | null>(null);
let conditionResult = $state<boolean | null>(null);
let expressionResult = $state<string | null>(null);

let isLoading = $state(false);
let loadError = $state<string | null>(null);

export const developerStore = {
  get actions() {
    return actions;
  },
  get events() {
    return events;
  },
  get logSources() {
    return logSources;
  },
  get logs() {
    return logs;
  },
  get selectedAction() {
    return selectedAction;
  },
  get selectedEvent() {
    return selectedEvent;
  },
  get selectedLogSource() {
    return selectedLogSource;
  },
  get isExecuting() {
    return isExecuting;
  },
  get executionResult() {
    return executionResult;
  },
  get templateOutput() {
    return templateOutput;
  },
  get conditionResult() {
    return conditionResult;
  },
  get expressionResult() {
    return expressionResult;
  },
  get isLoading() {
    return isLoading;
  },
  get loadError() {
    return loadError;
  },
};

export async function loadActions(): Promise<ActionDefinition[]> {
  try {
    isLoading = true;
    const res = await developerEndpoints.getActions();
    actions = res.actions ?? [];
    return actions;
  } catch (error) {
    console.error('Failed to load developer actions:', error);
    loadError = error instanceof Error ? error.message : String(error);
    return [];
  } finally {
    isLoading = false;
  }
}

export function selectAction(action: ActionDefinition | null): void {
  selectedAction = action;
}

export async function runAction(req: ExecuteActionRequest): Promise<ExecuteActionResponse | null> {
  try {
    isExecuting = true;
    executionResult = null;
    const res = await developerEndpoints.runAction(req);
    executionResult = JSON.stringify(res, null, 2);
    return res;
  } catch (error) {
    console.error('Failed to run action:', error);
    executionResult = `Error: ${error instanceof Error ? error.message : String(error)}`;
    return null;
  } finally {
    isExecuting = false;
  }
}

export async function runActionFlow(req: RunActionFlowRequest): Promise<RunActionFlowResponse | null> {
  try {
    isExecuting = true;
    executionResult = null;
    const res = await developerEndpoints.runActionFlow(req);
    executionResult = JSON.stringify(res, null, 2);
    return res;
  } catch (error) {
    console.error('Failed to run action flow:', error);
    executionResult = `Error: ${error instanceof Error ? error.message : String(error)}`;
    return null;
  } finally {
    isExecuting = false;
  }
}

export async function loadEvents(): Promise<EventDefinitionDto[]> {
  try {
    isLoading = true;
    const res = await developerEndpoints.getEvents();
    events = res.events ?? [];
    return events;
  } catch (error) {
    console.error('Failed to load developer events:', error);
    loadError = error instanceof Error ? error.message : String(error);
    return [];
  } finally {
    isLoading = false;
  }
}

export function selectEvent(ev: EventDefinitionDto | null): void {
  selectedEvent = ev;
}

export async function triggerEvent(req: TriggerEventRequest): Promise<TriggerEventResponse | null> {
  try {
    isExecuting = true;
    executionResult = null;
    const res = await developerEndpoints.triggerEvent(req);
    executionResult = JSON.stringify(res, null, 2);
    return res;
  } catch (error) {
    console.error('Failed to trigger event:', error);
    executionResult = `Error: ${error instanceof Error ? error.message : String(error)}`;
    return null;
  } finally {
    isExecuting = false;
  }
}

export async function renderTemplate(template: string): Promise<string | null> {
  try {
    isExecuting = true;
    templateOutput = null;
    const res = await developerEndpoints.renderTemplate({ template });
    templateOutput = res.rendered;
    return res.rendered;
  } catch (error) {
    console.error('Failed to render template:', error);
    templateOutput = `Error: ${error instanceof Error ? error.message : String(error)}`;
    return null;
  } finally {
    isExecuting = false;
  }
}

export async function evaluateCondition(
  left: ConditionSidePayload,
  operator: string,
  right: ConditionSidePayload,
): Promise<boolean | null> {
  try {
    isExecuting = true;
    conditionResult = null;
    const res = await developerEndpoints.evaluateCondition({ left, operator, right });
    conditionResult = res.result;
    return res.result;
  } catch (error) {
    console.error('Failed to evaluate condition:', error);
    conditionResult = null;
    return null;
  } finally {
    isExecuting = false;
  }
}

export async function evaluateExpression(
  expression: ConditionExpressionPayload,
): Promise<string | null> {
  try {
    isExecuting = true;
    expressionResult = null;
    const res = await developerEndpoints.evaluateExpression({ expression });
    expressionResult = String(res.result);
    return expressionResult;
  } catch (error) {
    console.error('Failed to evaluate expression:', error);
    expressionResult = `Error: ${error instanceof Error ? error.message : String(error)}`;
    return null;
  } finally {
    isExecuting = false;
  }
}

export async function loadLogSources(): Promise<LogSourceSummary[]> {
  try {
    const res = await developerEndpoints.getLogSources();
    logSources = res.sources ?? [];
    return logSources;
  } catch (error) {
    console.error('Failed to load log sources:', error);
    return [];
  }
}

export async function loadLogs(
  source?: string,
  levels?: LogEntryLevel[],
  limit?: number,
): Promise<LogEntry[]> {
  try {
    isLoading = true;
    const res = await developerEndpoints.getLogs({ source: source as any, levels, limit });
    logs = res.entries ?? [];
    return logs;
  } catch (error) {
    console.error('Failed to load logs:', error);
    loadError = error instanceof Error ? error.message : String(error);
    return [];
  } finally {
    isLoading = false;
  }
}

export function setSelectedLogSource(source: string): void {
  selectedLogSource = source;
}

export function resetDeveloperStore(): void {
  actions = [];
  events = [];
  logSources = [];
  logs = [];
  selectedAction = null;
  selectedEvent = null;
  selectedLogSource = '';
  isExecuting = false;
  executionResult = null;
  templateOutput = null;
  conditionResult = null;
  expressionResult = null;
  isLoading = false;
  loadError = null;
}
