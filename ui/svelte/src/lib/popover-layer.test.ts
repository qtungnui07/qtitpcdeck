/*
 * Tests for the popover layer's Escape ordering.
 *
 * A popover and a modal both want Escape. The rule is that whichever opened later wins, so a
 * popover opened from inside a modal closes the popover and leaves the modal up.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  isAnyPopoverOpen,
  isAnyPopoverOpenSince,
  nextPopoverOrder,
  registerPopover,
  resetPopoverLayer,
  unregisterPopover,
} from './popover-layer';

afterEach(() => {
  resetPopoverLayer();
});

describe('popover layer', () => {
  it('starts with nothing open', () => {
    expect(isAnyPopoverOpen()).toBe(false);
  });

  it('counts a registered popover', () => {
    registerPopover(Symbol('popover'));
    expect(isAnyPopoverOpen()).toBe(true);
  });

  it('stops counting an unregistered popover', () => {
    const token = Symbol('popover');
    registerPopover(token);
    unregisterPopover(token);

    expect(isAnyPopoverOpen()).toBe(false);
  });

  it('hands out increasing order tickets', () => {
    const first = nextPopoverOrder();
    const second = nextPopoverOrder();

    expect(second).toBeGreaterThan(first);
  });

  it('reports nothing opened since a ticket taken after the last open', () => {
    registerPopover(Symbol('popover'));
    const after = nextPopoverOrder();

    expect(isAnyPopoverOpenSince(after)).toBe(false);
  });

  it('reports something opened since a ticket taken before it', () => {
    const before = nextPopoverOrder();
    registerPopover(Symbol('popover'));

    expect(isAnyPopoverOpenSince(before)).toBe(true);
  });

  it('reports nothing opened since when no popover is open', () => {
    const before = nextPopoverOrder();
    nextPopoverOrder();

    expect(isAnyPopoverOpenSince(before)).toBe(false);
  });

  it('forgets everything on reset', () => {
    registerPopover(Symbol('popover'));
    resetPopoverLayer();

    expect(isAnyPopoverOpen()).toBe(false);
  });
});
