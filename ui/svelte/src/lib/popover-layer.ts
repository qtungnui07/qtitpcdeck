/*
 * The popover layer's open-order counter.
 *
 * A popover and a modal both want Escape. Whichever opened later wins, so both ask this module for
 * a ticket when they open and compare tickets when the key arrives. Kept separate from the modal
 * stack because a popover is not a modal - it does not block the deck, and it does not count
 * towards the "a dialog is up" check.
 */

let lastOpenOrder = 0;
const openPopovers = new Set<symbol>();

export function nextPopoverOrder(): number {
  lastOpenOrder += 1;
  return lastOpenOrder;
}

export function registerPopover(token: symbol): void {
  openPopovers.add(token);
  lastOpenOrder += 1;
}

export function unregisterPopover(token: symbol): void {
  openPopovers.delete(token);
}

export function isAnyPopoverOpen(): boolean {
  return openPopovers.size > 0;
}

export function isAnyPopoverOpenSince(order: number): boolean {
  return lastOpenOrder > order && openPopovers.size > 0;
}

export function resetPopoverLayer(): void {
  lastOpenOrder = 0;
  openPopovers.clear();
}
