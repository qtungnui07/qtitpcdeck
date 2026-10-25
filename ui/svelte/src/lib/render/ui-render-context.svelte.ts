/*
 * The render context a config tree is drawn against, ported from the Angular
 * UiRenderContext.
 *
 * It owns three things a renderer needs beyond the tree itself:
 *
 *  - the node index (id -> node, plus object/array scopes), rebuilt whenever
 *    the root changes, so `isVisible` can resolve `visibleWhen` across nodes;
 *  - the value layering: external values (a caller-owned draft) over the
 *    overlay (optimistic local edits) over the node's own properties;
 *  - the event bus, so a control's edit becomes a `change` event the page
 *    forwards to the host session.
 *
 * The Angular version was an injectable provided per surface; here the
 * surface component creates one and hands it to the tree through Svelte's
 * context API (see `UI_RENDER_CONTEXT`).
 */

import {
  UiConfigEvents,
  UiConfigPrimitives,
  UiConfigProperties,
  type UiNode,
  nodeString,
  nodeText,
  nodeVisibleWhen,
} from '@macro-deck/runtime';
import { UiNodeEventBus } from '../ui-node-event-bus';
import { localizationTranslator } from '../localization.svelte';
import { UI_CHROME_TYPES } from './ui-chrome-types';

export interface UiHoistedMessage {
  id: string;
  text: string;
}

export class UiRenderContext {
  readonly eventBus = new UiNodeEventBus();

  private readonly nodesById = new Map<string, UiNode>();
  private readonly scopeById = new Map<string, string | undefined>();
  private readonly forIndex = new Map<string, UiHoistedMessage[]>();
  private currentRoot: UiNode | null = null;
  private indexedCatalogVersion = -1;

  // forIndex itself is a plain Map, so reindexing it is invisible to Svelte's
  // reactivity - a template only reruns on state it read, and `Map.get` isn't
  // any. This version counter is what a `messagesFor` read depends on.
  forIndexVersion = $state(0);

  private overlay = $state<Record<string, unknown>>({});
  private externalValues = $state<Record<string, unknown> | null>(null);
  private disabledState = $state(false);
  private scopeRefIdState = $state<string | undefined>(undefined);
  private unsavedChangesState = $state(false);

  /**
   * Rebuilds the index for a root. Guarded: the surface's effect runs on every
   * dependency tick, and a write per run is what an update-depth loop is made
   * of - a no-op when the root and the catalogue version are unchanged, and
   * the overlay reset rides along with it.
   */
  setRoot(root: UiNode | null, catalogVersion = -1): void {
    if (this.currentRoot === root && this.indexedCatalogVersion === catalogVersion) return;
    this.indexedCatalogVersion = catalogVersion;
    this.currentRoot = root;
    this.overlay = {};
    this.reindex(root);
  }

  reindex(root: UiNode | null = this.currentRoot): void {
    this.nodesById.clear();
    this.scopeById.clear();
    this.forIndex.clear();
    if (root) this.index(root, undefined);
    this.forIndexVersion++;
  }

  setValues(values: Record<string, unknown> | null): void {
    this.externalValues = values;
  }

  setDisabled(disabled: boolean): void {
    this.disabledState = disabled;
  }

  get disabled(): boolean {
    return this.disabledState;
  }

  setScopeRefId(scopeRefId: string | undefined): void {
    this.scopeRefIdState = scopeRefId;
  }

  get scopeRefId(): string | undefined {
    return this.scopeRefIdState;
  }

  setUnsavedChanges(unsavedChanges: boolean): void {
    this.unsavedChangesState = unsavedChanges;
  }

  get unsavedChanges(): boolean {
    return this.unsavedChangesState;
  }

  messagesFor(nodeId: string): UiHoistedMessage[] {
    void this.forIndexVersion;
    return this.forIndex.get(nodeId) ?? [];
  }

  isHoistedOnto(forId: string): boolean {
    const target = this.nodesById.get(forId);
    return !!target && !UI_CHROME_TYPES.has(target.type);
  }

  isVisible(node: UiNode): boolean {
    const when = nodeVisibleWhen(node);
    if (!when) return true;

    const scopeId = this.scopeById.get(node.id);
    const target = (scopeId && this.nodesById.get(`${scopeId}.${when.parameterName}`))
      || this.nodesById.get(when.parameterName);
    if (!target) return true;

    const current = this.stringValue(this.getValue(target));
    return when.values.some(value => value.toLowerCase() === current.toLowerCase());
  }

  getValue(node: UiNode): unknown {
    const external = this.externalValues;
    if (external && Object.prototype.hasOwnProperty.call(external, node.id)) {
      return external[node.id];
    }

    if (Object.prototype.hasOwnProperty.call(this.overlay, node.id)) {
      return this.overlay[node.id];
    }

    const properties = node.properties ?? {};
    if (UiConfigProperties.Value in properties) return properties[UiConfigProperties.Value];
    return properties[UiConfigProperties.DefaultValue];
  }

  renderedValue(nodeId: string): unknown {
    const node = this.nodesById.get(nodeId);
    return node ? this.getValue(node) : undefined;
  }

  setValue(node: UiNode, value: unknown): void {
    if (this.externalValues === null) {
      this.overlay = { ...this.overlay, [node.id]: value };
    }
    this.emit(node, UiConfigEvents.Change, value);
  }

  clearValue(nodeId: string): void {
    if (!(nodeId in this.overlay)) return;
    const next = { ...this.overlay };
    delete next[nodeId];
    this.overlay = next;
  }

  emit(node: UiNode, name: string, data?: unknown): void {
    this.eventBus.emit(node, name, data);
  }

  clearDescendantInputs(rootId: string): void {
    const root = this.nodesById.get(rootId);
    if (!root) return;

    const visit = (node: UiNode): void => {
      const isContainer = node.type === UiConfigPrimitives.Object || node.type === UiConfigPrimitives.Array
        || node.type === UiConfigPrimitives.Stack || node.type === UiConfigPrimitives.AdvancedSection
        || node.type === UiConfigPrimitives.Step || node.type === UiConfigPrimitives.Flow
        || node.type === UiConfigPrimitives.Tabs || node.type === UiConfigPrimitives.Tab;

      if (!isContainer) {
        this.clearValue(node.id);
        this.emit(node, UiConfigEvents.Change, null);
      }
      for (const child of node.children ?? []) visit(child);
    };
    for (const child of root.children ?? []) visit(child);
  }

  private stringValue(value: unknown): string {
    return value === undefined || value === null ? '' : String(value);
  }

  private index(node: UiNode, scopeId: string | undefined): void {
    this.nodesById.set(node.id, node);
    this.scopeById.set(node.id, scopeId);

    const childScope = node.type === UiConfigPrimitives.Object || node.type === UiConfigPrimitives.Array
      ? node.id
      : scopeId;
    for (const child of node.children ?? []) this.index(child, childScope);
    if (node.fallback) this.index(node.fallback, scopeId);

    if (node.type === UiConfigPrimitives.ValidationMessage) {
      const forId = nodeString(node, UiConfigProperties.For);
      if (forId) {
        const text = nodeText(node, UiConfigProperties.Text, localizationTranslator) ?? '';
        const list = this.forIndex.get(forId) ?? [];
        list.push({ id: node.id, text });
        this.forIndex.set(forId, list);
      }
    }
  }
}

/** The Svelte context key the render surface provides the tree through. */
export const UI_RENDER_CONTEXT: symbol = Symbol('ui-render-context');
