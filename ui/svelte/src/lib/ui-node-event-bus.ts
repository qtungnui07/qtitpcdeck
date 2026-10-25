/*
 * The event bus a rendered config tree talks to its host page through,
 * ported from the Angular UiNodeEventBus.
 *
 * `emit` is the gate every config primitive's change goes through: it drops
 * an event the node never declared (`emitsEvent`), so a renderer cannot send
 * `change` for a label. The Angular version exposed RxJS subjects; this one
 * keeps the same shape as plain subscribe functions, matching the Svelte app's
 * `onNotification` convention.
 */

import { emitsEvent, type UiNode, type UiNodeEvent } from '@macro-deck/runtime';

export interface UiNodePressedEvent {
  nodeId: string;
  pressed: boolean;
}

export class UiNodeEventBus {
  private readonly eventListeners = new Set<(event: UiNodeEvent) => void>();
  private readonly pressedListeners = new Set<(event: UiNodePressedEvent) => void>();
  private readonly flashedListeners = new Set<(nodeId: string) => void>();

  readonly events = (listener: (event: UiNodeEvent) => void): (() => void) => {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  };

  readonly pressed = (listener: (event: UiNodePressedEvent) => void): (() => void) => {
    this.pressedListeners.add(listener);
    return () => this.pressedListeners.delete(listener);
  };

  readonly flashed = (listener: (nodeId: string) => void): (() => void) => {
    this.flashedListeners.add(listener);
    return () => this.flashedListeners.delete(listener);
  };

  emit(node: UiNode, name: string, data?: unknown): void {
    if (!emitsEvent(node, name)) return;
    const event = data === undefined ? { nodeId: node.id, name } : { nodeId: node.id, name, data };
    for (const listener of [...this.eventListeners]) listener(event);
  }

  setPressed(node: UiNode, pressed: boolean): void {
    const event = { nodeId: node.id, pressed };
    for (const listener of [...this.pressedListeners]) listener(event);
  }

  flashPressed(node: UiNode): void {
    for (const listener of [...this.flashedListeners]) listener(node.id);
  }
}
