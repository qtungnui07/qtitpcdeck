/*
 * The modal stack.
 *
 * Modals are rendered inline in the DOM rather than portalled, so the stack is what tells a modal
 * whether it is the topmost one - only the topmost answers Escape or an overlay click. Without it,
 * pressing Escape over a confirmation opened from inside the settings modal would close both.
 *
 * The stack also counts open modals, which the shell uses to stop the deck from reacting to keys
 * while a dialog is up.
 */

let stack: symbol[] = [];

export function openModal(): symbol {
  const token = Symbol('modal');
  stack = [...stack, token];
  return token;
}

export function closeModal(token: symbol): void {
  stack = stack.filter(entry => entry !== token);
}

export function isTopmostModal(token: symbol): boolean {
  return stack.length > 0 && stack[stack.length - 1] === token;
}

export function openModalCount(): number {
  return stack.length;
}

export function isAnyModalOpen(): boolean {
  return stack.length > 0;
}

export function resetModalStack(): void {
  stack = [];
}
