/*
 * Hotkey capture, ported from the Angular HotkeyCaptureService: keydown is
 * captured on the document (WebKit does not focus a <button> on click, issue
 * #423) with capture-phase listeners that stop everything else while armed -
 * a modal must not close on the Escape that cancels recording. While armed,
 * the shell is asked to release its own key equivalents so combinations the
 * application menu owns can be recorded too.
 */

import { shellBridge } from './shell-bridge';

const BARE_MODIFIERS = new Set(['Control', 'Shift', 'Alt', 'AltGraph', 'Meta']);

export interface HotkeyCaptureHandlers {
  key: (event: KeyboardEvent, heldModifierCodes: ReadonlySet<string>) => void;
  cancel: () => void;
}

let host: HTMLElement | null = null;
let handlers: HotkeyCaptureHandlers | null = null;
const heldModifierCodes = new Set<string>();

export const hotkeyCapture = {
  get active(): boolean {
    return handlers !== null;
  },
};

export function startHotkeyCapture(activeHost: HTMLElement, activeHandlers: HotkeyCaptureHandlers): void {
  cancelHotkeyCapture();

  host = activeHost;
  handlers = activeHandlers;
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  document.addEventListener('mousedown', onPointerDown, true);
  window.addEventListener('blur', onWindowBlur);
  void shellBridge()?.setHotkeyCapture?.(true).catch(() => undefined);
}

export function stopHotkeyCapture(): void {
  if (!handlers) {
    return;
  }

  host = null;
  handlers = null;
  heldModifierCodes.clear();
  document.removeEventListener('keydown', onKeyDown, true);
  document.removeEventListener('keyup', onKeyUp, true);
  document.removeEventListener('mousedown', onPointerDown, true);
  window.removeEventListener('blur', onWindowBlur);
  void shellBridge()?.setHotkeyCapture?.(false).catch(() => undefined);
}

export function cancelHotkeyCapture(): void {
  const pending = handlers;
  stopHotkeyCapture();
  pending?.cancel();
}

function onKeyDown(event: KeyboardEvent): void {
  const current = handlers;
  if (!current) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();

  if (BARE_MODIFIERS.has(event.key)) {
    heldModifierCodes.add(event.code);
    return;
  }

  if (event.key === 'Escape') {
    cancelHotkeyCapture();
    return;
  }

  const held = new Set(heldModifierCodes);
  stopHotkeyCapture();
  current.key(event, held);
}

function onKeyUp(event: KeyboardEvent): void {
  heldModifierCodes.delete(event.code);
}

function onPointerDown(event: MouseEvent): void {
  const target = event.target;
  if (target instanceof Node && host?.contains(target)) {
    return;
  }
  cancelHotkeyCapture();
}

function onWindowBlur(): void {
  cancelHotkeyCapture();
}
