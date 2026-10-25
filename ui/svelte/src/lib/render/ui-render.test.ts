import { describe, expect, it, vi } from 'vitest';
import type { UiNode } from '@macro-deck/runtime';
import { UiNodeEventBus } from '../ui-node-event-bus';

function field(id: string, events?: string[]): UiNode {
  return { id, type: 'ui.config.string', properties: events ? { events } : undefined };
}

describe('UiNodeEventBus', () => {
  it('delivers an emitted event to every subscriber', () => {
    const bus = new UiNodeEventBus();
    const first = vi.fn();
    const second = vi.fn();
    bus.events(first);
    bus.events(second);

    const node = field('name', ['change']);
    bus.emit(node, 'change', 'x');

    expect(first).toHaveBeenCalledWith({ nodeId: 'name', name: 'change', data: 'x' });
    expect(second).toHaveBeenCalledWith({ nodeId: 'name', name: 'change', data: 'x' });
  });

  it('drops an event the node never declared', () => {
    const bus = new UiNodeEventBus();
    const listener = vi.fn();
    bus.events(listener);

    bus.emit(field('name', ['change']), 'activate');
    expect(listener).not.toHaveBeenCalled();
  });

  it('omits data entirely when the emit carried none', () => {
    const bus = new UiNodeEventBus();
    const listener = vi.fn();
    bus.events(listener);

    bus.emit(field('name', ['change']), 'change');
    expect(listener).toHaveBeenCalledWith({ nodeId: 'name', name: 'change' });
  });

  it('stops delivering after unsubscribe', () => {
    const bus = new UiNodeEventBus();
    const listener = vi.fn();
    const unsubscribe = bus.events(listener);
    unsubscribe();

    bus.emit(field('name', ['change']), 'change');
    expect(listener).not.toHaveBeenCalled();
  });

  it('reports press and flash through their own channels', () => {
    const bus = new UiNodeEventBus();
    const pressed = vi.fn();
    const flashed = vi.fn();
    bus.pressed(pressed);
    bus.flashed(flashed);

    const node = field('button-1', ['activate']);
    bus.setPressed(node, true);
    bus.flashPressed(node);

    expect(pressed).toHaveBeenCalledWith({ nodeId: 'button-1', pressed: true });
    expect(flashed).toHaveBeenCalledWith('button-1');
  });
});
