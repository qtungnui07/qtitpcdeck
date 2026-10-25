/*
 * The editing state of one action builder surface, ported from the Angular
 * ActionFlowStore.
 *
 * The store is the single writer of the flows: every edit goes through it,
 * is applied to a clone, and comes back out through `connect`'s emit so the
 * page owns the actual persistence. Idempotency rules the Angular version
 * was careful about are kept: adding an already-present trigger re-selects it
 * rather than creating an empty duplicate (#480), and a paste is rehearsed on
 * a throwaway copy before any secret is cloned, so a paste that cannot land
 * leaves no orphaned copies on the host.
 *
 * The clipboard is scoped to this store's lifetime and settles a cut against
 * its owner: pasting back into the same surface removes the source block,
 * pasting elsewhere keeps it (the cross-surface cut-origin settlement the
 * widget page performs is a later workstream).
 */

import {
  type ActionBlock,
  type ActionBlockDefinition,
  type ActionBlockParameter,
  type ActionBranch,
  type ActionFlow,
  AppStrings,
  type ComparisonOperator,
  type ConditionExpression,
  createBlockFromDefinition,
  createEmptyComparison,
  type EventDefinition,
  EVENT_TRIGGER_TYPE,
  type EventTriggerBinding,
  findBlock,
  generateBlockId,
  insertAfterBlock,
  insertBlockAt,
  isEventFlow,
  isInvalidNestedMove,
  isSameTriggerType,
  cloneBlockWithNewIds,
  collectSecretIds,
  mapDescendants,
  mapSecretReferences,
  type ParameterValue,
  removeBlockAt,
  removeBlockFromFlows,
  resolveList,
  type RunActionFlowResponse,
  type Variable,
  type VariableScope,
} from '@macro-deck/runtime';
import { api } from '../api.svelte';
import { actionEndpoints } from '../endpoints';
import { translateKey } from '../localization.svelte';
import { showToast } from '../toasts.svelte';
import type { ActionFlowValidationError } from '../action-flow-validation.util';
import { validateActionFlows } from '../action-flow-validation.util';
import {
  DEFAULT_TRIGGER_TYPE,
  comparisonOperatorOptions,
} from '../default-action-defs';

export interface ActionFlowOwner {
  kind: 'widget' | 'automation' | 'script';
  id: string;
}

interface ClipboardEntry {
  block: ActionBlock;
  isCut: boolean;
  owner: ActionFlowOwner | null;
}

export class ActionFlowStore {
  flows = $state<ActionFlow[]>([]);
  variables: Variable[] = [];

  scriptRunsOnWidget = false;

  eventVariables: Variable[] = [];
  eventDefinition: EventDefinition | undefined = undefined;
  eventConfigurationValues: Record<string, unknown> = {};

  previewScope: VariableScope = 'global';
  previewScopeRefId: string | undefined = undefined;
  ownerWidgetId: string | undefined = undefined;
  previewScopeStates: { id: string; label: string }[] | undefined = undefined;

  availableBlocks: ActionBlockDefinition[] = [];

  stateProviderBlockId: string | undefined = undefined;
  consumerSupportsStateProvider = false;
  iconProviderBlockId: string | undefined = undefined;
  consumerSupportsIconProvider = false;

  selectedTriggerId = $state<string>(DEFAULT_TRIGGER_TYPE);

  pickerOpenForList = $state<string | null>(null);

  expandedBlocks = $state<Set<string>>(new Set());

  running = $state(false);

  flowOwner: ActionFlowOwner | null = null;

  private clipboardEntry: ClipboardEntry | null = null;

  private emitFn: (flows: ActionFlow[]) => void = () => undefined;
  private triggerLabelFn: (triggerType: string) => string | undefined = () => undefined;

  /** Wires the store to the page that owns persistence. */
  connect(
    emit: (flows: ActionFlow[]) => void,
    triggerLabelFor?: (triggerType: string) => string | undefined,
  ): void {
    this.emitFn = emit;
    if (triggerLabelFor) this.triggerLabelFn = triggerLabelFor;
  }

  get comparisonOperators(): ReadonlyArray<{ label: string; value: ComparisonOperator }> {
    return comparisonOperatorOptions(key => translateKey(key));
  }

  get pickerVariables(): Variable[] {
    return [...this.eventVariables, ...this.variables];
  }

  get previewOwnerWidgetId(): string | undefined {
    return this.ownerWidgetId ?? (this.previewScope === 'widget' ? this.previewScopeRefId : undefined);
  }

  get previewScopeHasOnOffStates(): boolean | undefined {
    const states = this.previewScopeStates;
    return states === undefined ? undefined : states.length >= 2;
  }

  get hasOwnerWidget(): boolean {
    return !!this.previewOwnerWidgetId || this.scriptRunsOnWidget;
  }

  get resolvedOwner(): ActionFlowOwner | null {
    if (this.flowOwner) return this.flowOwner;
    const widgetId = this.previewOwnerWidgetId;
    return this.hasOwnerWidget && widgetId ? { kind: 'widget', id: widgetId } : null;
  }

  get canPaste(): boolean {
    return this.clipboardEntry !== null;
  }

  isCutSource(blockId: string): boolean {
    return this.clipboardEntry?.isCut === true && this.clipboardEntry.block.id === blockId;
  }

  get validation(): { valid: boolean; errors: ActionFlowValidationError[] } {
    return validateActionFlows(this.flows, { hasOwnerWidget: this.hasOwnerWidget }, key => translateKey(key));
  }

  get rootListId(): string {
    return `flow:${this.resolveTriggerId(this.selectedTriggerId)}`;
  }

  get eventFlows(): ActionFlow[] {
    return this.flows.filter(isEventFlow);
  }

  get selectedFlow(): ActionFlow | undefined {
    const selected = this.selectedTriggerId;
    return this.flows.find(flow => flow.triggerId === selected)
      ?? this.flows.find(flow => !isEventFlow(flow) && isSameTriggerType(flow.triggerType, selected));
  }

  get canRun(): boolean {
    const flow = this.selectedFlow;
    return !this.running && !!flow && flow.children.some(block => !block.disabled);
  }

  providesButtonState(integrationId: string | undefined, actionId: string | undefined): boolean {
    if (!integrationId || !actionId) return false;
    return this.availableBlocks.some(block =>
      block.integrationId === integrationId && block.actionId === actionId && block.providesButtonState === true);
  }

  actionRole(integrationId: string | undefined, actionId: string | undefined): string | undefined {
    if (!integrationId || !actionId) return undefined;
    return this.availableBlocks.find(block =>
      block.integrationId === integrationId && block.actionId === actionId)?.role;
  }

  providesWidgetIcon(integrationId: string | undefined, actionId: string | undefined): boolean {
    if (!integrationId || !actionId) return false;
    return this.availableBlocks.some(block =>
      block.integrationId === integrationId && block.actionId === actionId && block.providesWidgetIcon === true);
  }

  errorsFor(blockId: string): ActionFlowValidationError[] {
    return this.validation.errors.filter(e => e.blockId === blockId);
  }

  isExpanded(blockId: string): boolean {
    return this.expandedBlocks.has(blockId);
  }

  toggleExpanded(blockId: string): void {
    const next = new Set(this.expandedBlocks);
    if (next.has(blockId)) next.delete(blockId);
    else next.add(blockId);
    this.expandedBlocks = next;
  }

  private markExpanded(blockId: string): void {
    const next = new Set(this.expandedBlocks);
    next.add(blockId);
    this.expandedBlocks = next;
  }

  requestAdd(listId: string): void {
    this.pickerOpenForList = listId;
  }

  closePicker(): void {
    this.pickerOpenForList = null;
  }

  pickAction(def: ActionBlockDefinition): void {
    const listId = this.pickerOpenForList;
    if (!listId) return;

    const flows = plainSnapshot(this.flows);
    this.ensureSelectedFlow(flows);

    const block = createBlockFromDefinition(def);
    insertBlockAt(flows, listId, Number.MAX_SAFE_INTEGER, block);
    this.markExpanded(block.id);
    this.emit(flows);
    this.closePicker();
  }

  private ensureSelectedFlow(flows: ActionFlow[]): void {
    const selected = this.selectedTriggerId;
    if (flows.some(f => f.triggerId === selected || isSameTriggerType(f.triggerType, selected))) return;
    flows.push({
      triggerId: selected,
      triggerType: selected,
      triggerLabel: this.triggerLabelFn(selected) ?? selected,
      children: [],
    });
  }

  moveBlock(sourceListId: string, sourceIndex: number, targetListId: string, targetIndex: number): void {
    const flows = plainSnapshot(this.flows);
    const moved = removeBlockAt(flows, sourceListId, sourceIndex);
    if (!moved) return;
    if (isInvalidNestedMove(moved, targetListId)) return;

    let index = targetIndex;
    if (sourceListId === targetListId && sourceIndex < targetIndex) index--;
    insertBlockAt(flows, targetListId, index, moved);
    this.emit(flows);
  }

  async duplicateBlock(blockId: string): Promise<void> {
    // findBlock over the live state returns a proxy, and the runtime's clone
    // helpers structuredClone their input - the snapshot feeds them a plain one.
    const source = findBlock(plainSnapshot(this.flows), blockId);
    if (!source) return;

    const clone = await this.withClonedSecrets(cloneBlockWithNewIds(source));

    const flows = plainSnapshot(this.flows);
    if (!insertAfterBlock(flows, blockId, clone)) return;
    this.markExpanded(clone.id);
    this.emit(flows);
  }

  copyBlock(blockId: string): void {
    const source = findBlock(this.flows, blockId);
    if (!source) return;
    this.clipboardEntry = { block: plainSnapshot(source), isCut: false, owner: this.resolvedOwner };
  }

  cutBlock(blockId: string): void {
    const source = findBlock(this.flows, blockId);
    if (!source) return;
    this.clipboardEntry = { block: plainSnapshot(source), isCut: true, owner: this.resolvedOwner };
  }

  cancelCut(): void {
    if (this.clipboardEntry?.isCut) this.clipboardEntry = null;
  }

  async pasteAfter(blockId: string): Promise<void> {
    await this.paste((flows, block) => insertAfterBlock(flows, blockId, block));
  }

  async pasteIntoList(listId: string): Promise<void> {
    await this.paste((flows, block) => {
      this.ensureSelectedFlow(flows);
      const list = resolveList(flows, listId);
      if (!list) return false;
      list.push(block);
      return true;
    });
  }

  private async paste(insert: (flows: ActionFlow[], block: ActionBlock) => boolean): Promise<void> {
    const entry = this.clipboardEntry;
    if (!entry) return;

    const owner = this.resolvedOwner;
    const clone = cloneBlockWithNewIds(entry.block);

    // Rehearsed on a throwaway copy first: cloning the secrets of a paste
    // that cannot land would leave the copies orphaned on the host.
    if (!insert(plainSnapshot(this.flows), clone)) return;

    const block = await this.withClonedSecrets(clone);

    // The store outlives what it edits - the widget editor re-binds its
    // widget in place - so a paste whose secret round trip straddled such a
    // switch must not land in the record the user moved on to.
    if (!this.ownerStillIs(owner)) return;

    const flows = plainSnapshot(this.flows);
    if (!insert(flows, block)) return;

    this.markExpanded(block.id);
    this.emit(flows);
    this.settleCut(entry, owner);
  }

  private async withClonedSecrets(clone: ActionBlock): Promise<ActionBlock> {
    const secretIds = [...new Set(collectSecretIds(clone))];
    if (secretIds.length === 0) return clone;

    const map = new Map<string, string | null>();
    let dropped = false;
    for (const id of secretIds) {
      try {
        const response = await actionEndpoints.cloneSecret(id);
        map.set(id, response.id ?? null);
        if (!response.id) dropped = true;
      } catch {
        map.set(id, null);
        dropped = true;
      }
    }

    if (dropped) {
      showToast(translateKey(AppStrings.ActionBuilder.Store.SecretsNotCopied), {
        variant: 'error',
        detail: translateKey(AppStrings.ActionBuilder.Store.ReEnterSecretsHint),
      });
    }
    return mapSecretReferences(clone, map);
  }

  private settleCut(entry: ClipboardEntry, owner: ActionFlowOwner | null): void {
    if (!entry.isCut || !entry.owner) return;

    if (sameOwner(entry.owner, owner)) {
      const removal = removeBlockFromFlows(this.flows, entry.block.id);
      if (removal.removed) this.emit(removal.flows);
      this.clipboardEntry = null;
      return;
    }

    // A cut pasted into another surface keeps its source: the cross-surface
    // settlement is the widget page's to perform on save.
    this.clipboardEntry = { ...entry, isCut: false };
  }

  private ownerStillIs(owner: ActionFlowOwner | null): boolean {
    const current = this.resolvedOwner;
    if (owner === null || current === null) return owner === current;
    return sameOwner(owner, current);
  }

  toggleDisabled(blockId: string): void {
    const updateList = (list: ActionBlock[]): ActionBlock[] =>
      list.map(block => {
        const updated = mapDescendants(block, updateList);
        if (updated.id !== blockId) return updated;
        return { ...updated, disabled: !updated.disabled };
      });

    this.emit(this.flows.map(flow => ({ ...flow, children: updateList(flow.children) })));
  }

  updateBlockComment(blockId: string, comment: string): void {
    const updateList = (list: ActionBlock[]): ActionBlock[] =>
      list.map(block => {
        const updated = mapDescendants(block, updateList);
        if (updated.id !== blockId) return updated;
        if (comment.trim().length === 0) {
          const { comment: _comment, ...rest } = updated;
          return rest;
        }
        return { ...updated, comment };
      });

    this.emit(this.flows.map(flow => ({ ...flow, children: updateList(flow.children) })));
  }

  removeBlock(blockId: string): void {
    this.emit(removeBlockFromFlows(this.flows, blockId).flows);
  }

  updateParam(blockId: string, paramName: string, value: ParameterValue, valueLabel?: string): void {
    const updateList = (list: ActionBlock[]): ActionBlock[] =>
      list.map(block => {
        const updated = mapDescendants(block, updateList);
        if (updated.id !== blockId || !updated.parameters) return updated;
        return {
          ...updated,
          parameters: updated.parameters.map(param => {
            if (param.name !== paramName) return param;
            const keepLabel = valueLabel === undefined && param.value === value;
            return { ...param, value, valueLabel: keepLabel ? param.valueLabel : valueLabel };
          }),
        };
      });

    this.emit(this.flows.map(flow => ({ ...flow, children: updateList(flow.children) })));
  }

  setBlockParameters(blockId: string, parameters: ActionBlockParameter[]): void {
    const updateList = (list: ActionBlock[]): ActionBlock[] =>
      list.map(block => {
        const updated = mapDescendants(block, updateList);
        if (updated.id !== blockId) return updated;
        return { ...updated, parameters };
      });

    this.emit(this.flows.map(flow => ({ ...flow, children: updateList(flow.children) })));
  }

  updateBlockCondition(blockId: string, expression: ConditionExpression): void {
    const updateList = (list: ActionBlock[]): ActionBlock[] =>
      list.map(block => {
        const updated = mapDescendants(block, updateList);
        if (updated.id !== blockId) return updated;
        return { ...updated, condition: expression };
      });

    this.emit(this.flows.map(flow => ({ ...flow, children: updateList(flow.children) })));
  }

  updateBranchCondition(blockId: string, branchId: string, expression: ConditionExpression): void {
    this.mutateBranches(blockId, branches =>
      branches.map(branch => (branch.id === branchId ? { ...branch, condition: expression } : branch)),
    );
  }

  updateSwitchSubject(blockId: string, subject: ParameterValue): void {
    const updateList = (list: ActionBlock[]): ActionBlock[] =>
      list.map(block => {
        const updated = mapDescendants(block, updateList);
        return updated.id === blockId ? { ...updated, subject } : updated;
      });

    this.emit(this.flows.map(flow => ({ ...flow, children: updateList(flow.children) })));
  }

  updateCaseValue(blockId: string, branchId: string, value: ParameterValue): void {
    this.mutateBranches(blockId, branches =>
      branches.map(branch => (branch.id === branchId ? { ...branch, value } : branch)),
    );
  }

  addCase(blockId: string): void {
    this.mutateBranches(blockId, branches => {
      const newBranch: ActionBranch = { id: generateBlockId(), kind: 'case', value: '', children: [] };
      const elseIdx = branches.findIndex(b => b.kind === 'else');
      if (elseIdx === -1) return [...branches, newBranch];
      return [...branches.slice(0, elseIdx), newBranch, ...branches.slice(elseIdx)];
    });
  }

  addElseIf(blockId: string): void {
    this.mutateBranches(blockId, branches => {
      const newBranch: ActionBranch = {
        id: generateBlockId(),
        kind: 'elseif',
        condition: createEmptyComparison(),
        children: [],
      };
      const elseIdx = branches.findIndex(b => b.kind === 'else');
      if (elseIdx === -1) return [...branches, newBranch];
      return [...branches.slice(0, elseIdx), newBranch, ...branches.slice(elseIdx)];
    });
  }

  addElse(blockId: string): void {
    this.mutateBranches(blockId, branches => {
      if (branches.some(b => b.kind === 'else')) return branches;
      return [...branches, { id: generateBlockId(), kind: 'else', children: [] }];
    });
  }

  removeBranch(blockId: string, branchId: string): void {
    this.mutateBranches(blockId, branches =>
      branches.filter((b, i) => !(b.id === branchId && i !== 0)),
    );
  }

  removeCase(blockId: string, branchId: string): void {
    this.mutateBranches(blockId, branches =>
      branches.filter(b => !(b.id === branchId && branches.filter(other => other.kind === 'case').length > 1)),
    );
  }

  private mutateBranches(blockId: string, fn: (branches: ActionBranch[]) => ActionBranch[]): void {
    const updateList = (list: ActionBlock[]): ActionBlock[] =>
      list.map(block => {
        const updated = mapDescendants(block, updateList);
        if (updated.id !== blockId || !updated.branches) return updated;
        return { ...updated, branches: fn(updated.branches) };
      });

    this.emit(this.flows.map(flow => ({ ...flow, children: updateList(flow.children) })));
  }

  addEventTrigger(): string {
    const triggerId = generateBlockId();
    this.emit([
      ...this.flows,
      { triggerId, triggerType: EVENT_TRIGGER_TYPE, children: [] },
    ]);
    this.selectedTriggerId = triggerId;
    return triggerId;
  }

  removeEventTrigger(triggerId: string): void {
    this.emit(this.flows.filter(flow => flow.triggerId !== triggerId));
  }

  // Idempotent: a second call for an already-added trigger re-selects it
  // instead of creating a second empty flow for the same type (#480). The
  // pushed flow is byte-identical to what ensureSelectedFlow produces, so an
  // action picked into it lands here rather than in a duplicate.
  addTrigger(triggerType: string): void {
    if (!this.flows.some(f => !isEventFlow(f) && isSameTriggerType(f.triggerType, triggerType))) {
      this.emit([
        ...this.flows,
        {
          triggerId: triggerType,
          triggerType,
          triggerLabel: this.triggerLabelFn(triggerType) ?? triggerType,
          children: [],
        },
      ]);
    }
    this.selectedTriggerId = triggerType;
  }

  removeTrigger(triggerType: string): void {
    const next = this.flows.filter(f => isEventFlow(f) || !isSameTriggerType(f.triggerType, triggerType));
    if (next.length === this.flows.length) return;
    this.emit(next);
    if (isSameTriggerType(this.selectedTriggerId, triggerType)) {
      this.selectedTriggerId = DEFAULT_TRIGGER_TYPE;
    }
  }

  renameEventFlow(triggerId: string, name: string): void {
    const current = this.flows.find(flow => flow.triggerId === triggerId);
    if (!current || (current.name ?? '').trim() === name.trim()) return;
    this.emit(
      this.flows.map(flow => {
        if (flow.triggerId !== triggerId) return flow;
        if (name.trim()) return { ...flow, name: name.trim() };
        const unnamed = { ...flow };
        delete unnamed.name;
        return unnamed;
      }),
    );
  }

  updateEventBinding(triggerId: string, binding: EventTriggerBinding): void {
    this.emit(
      this.flows.map(flow => (flow.triggerId === triggerId ? { ...flow, event: binding } : flow)),
    );
  }

  private upsertEventParam(
    parameters: ActionBlockParameter[],
    paramName: string,
    update: (existing: ActionBlockParameter | undefined) => ActionBlockParameter,
  ): ActionBlockParameter[] {
    const index = parameters.findIndex(p => p.name === paramName);
    if (index === -1) return [...parameters, update(undefined)];
    const next = [...parameters];
    next[index] = update(next[index]);
    return next;
  }

  updateEventParam(triggerId: string, paramName: string, value: ParameterValue, valueLabel?: string): void {
    this.emit(
      this.flows.map(flow => {
        if (flow.triggerId !== triggerId || !flow.event) return flow;
        const parameters = this.upsertEventParam(flow.event.parameters ?? [], paramName, existing => {
          const keepLabel = valueLabel === undefined && existing?.value === value;
          return {
            ...(existing ?? { name: paramName, type: 'string' as const, label: paramName, value: null }),
            value,
            valueLabel: keepLabel ? existing?.valueLabel : valueLabel,
          };
        });
        return { ...flow, event: { ...flow.event, parameters } };
      }),
    );
  }

  updateEventParamOperator(triggerId: string, paramName: string, operator: ComparisonOperator): void {
    this.emit(
      this.flows.map(flow => {
        if (flow.triggerId !== triggerId || !flow.event) return flow;
        const parameters = this.upsertEventParam(flow.event.parameters ?? [], paramName, existing => ({
          ...(existing ?? { name: paramName, type: 'number' as const, label: paramName, value: null }),
          operator: operator === '==' ? undefined : operator,
        }));
        return { ...flow, event: { ...flow.event, parameters } };
      }),
    );
  }

  updateEventFilter(triggerId: string, filter: ConditionExpression | undefined): void {
    this.emit(
      this.flows.map(flow =>
        flow.triggerId === triggerId && flow.event
          ? { ...flow, event: { ...flow.event, filter } }
          : flow,
      ),
    );
  }

  async runSelectedFlow(): Promise<RunActionFlowResponse | null> {
    const flow = this.selectedFlow;
    if (!flow || this.running) return null;

    this.running = true;
    try {
      return await actionEndpoints.runFlow({
        flows: JSON.stringify(this.flows),
        triggerId: flow.triggerId,
        scope: this.previewScope,
        scopeRefId: this.previewScopeRefId,
        clientId: api.clientId,
      });
    } catch {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: translateKey(AppStrings.ActionBuilder.Store.RunFailed),
        },
      };
    } finally {
      this.running = false;
    }
  }

  private resolveTriggerId(selected: string): string {
    const byId = this.flows.find(flow => flow.triggerId === selected);
    if (byId) return selected;
    const byType = this.flows.find(flow => isSameTriggerType(flow.triggerType, selected));
    return byType?.triggerId ?? selected;
  }

  private emit(flows: ActionFlow[]): void {
    // Callers build the next flows by mapping over `this.flows`, whose reads
    // are proxies; the snapshot is both the plain copy the page owns and what
    // can be safely cloned downstream.
    const plain = plainSnapshot(flows);
    this.flows = plain;
    this.emitFn(plain);
  }
}

function sameOwner(a: ActionFlowOwner | null, b: ActionFlowOwner | null): boolean {
  if (a === null || b === null) return a === b;
  return a.kind === b.kind && a.id === b.id;
}

/**
 * A plain deep copy of reactive flow state. `structuredClone` refuses the
 * proxies `$state` reads return, and `$state.snapshot`'s own `Snapshot<T>`
 * recurses infinitely over the flow types - calling it through an untyped
 * binding keeps the result plain without ever computing that type.
 */
function plainSnapshot(value: unknown): any {
  return ($state.snapshot as (source: unknown) => unknown)(value);
}
