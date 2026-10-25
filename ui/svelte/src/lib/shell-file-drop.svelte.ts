/*
 * The shell's file-drop channel, ported from the Angular ShellFileDropService.
 *
 * Inside the desktop shell, Tauri owns drag-and-drop for the WebView and
 * swallows the HTML5 drop event, so paths arrive through the bridge's
 * `onFileDrop` events alone; outside the shell this is inert. Surfaces
 * register with an accept filter, and the service stops at the first
 * registered ancestor of whatever the pointer is over - registering a target
 * rejects a payload rather than passing it on, so a narrow target nested in a
 * wider one shadows it for every kind.
 */

import { shellBridge, type ShellDroppedPath, type ShellFileDropEvent } from './shell-bridge';

export interface ShellDropPosition {
  x: number;
  y: number;
}

export type ShellFileDropFilter = (paths: ShellDroppedPath[], at: ShellDropPosition) => ShellDroppedPath[];

interface DropTarget {
  element: HTMLElement;
  accept: ShellFileDropFilter;
  drop: (paths: ShellDroppedPath[], at: ShellDropPosition) => void;
}

let activeTarget = $state<HTMLElement | null>(null);
let hover = $state<{ x: number; y: number } | null>(null);

export const shellFileDrop = {
  get supported(): boolean {
    return typeof shellBridge()?.onFileDrop === 'function';
  },
  get activeTarget(): HTMLElement | null {
    return activeTarget;
  },
  /** The pointer position of the current hover, for targets that hint per cell. */
  get hover(): { x: number; y: number } | null {
    return hover;
  },
};

const targets: DropTarget[] = [];
let unlisten: Promise<() => void> | null = null;
let dragged: ShellDroppedPath[] = [];

export function registerShellDropTarget(
  element: HTMLElement,
  accept: ShellFileDropFilter,
  drop: (paths: ShellDroppedPath[], at: ShellDropPosition) => void,
): () => void {
  const target: DropTarget = { element, accept, drop };
  targets.push(target);
  subscribe();

  return () => {
    const index = targets.indexOf(target);
    if (index >= 0) {
      targets.splice(index, 1);
    }
    if (activeTarget === element) {
      activeTarget = null;
    }
    if (targets.length === 0) {
      unsubscribe();
    }
  };
}

export function handleShellFileDropEvent(event: ShellFileDropEvent): void {
  if (event.kind === 'leave') {
    dragged = [];
    hover = null;
    activeTarget = null;
    return;
  }

  hover = { x: event.x, y: event.y };

  if (event.paths.length > 0) {
    dragged = event.paths;
  }

  const at: ShellDropPosition = { x: event.x, y: event.y };
  const target = targetAt(event.x, event.y);
  const accepted = target ? target.accept(dragged, at) : [];

  if (event.kind !== 'drop') {
    activeTarget = accepted.length > 0 ? (target?.element ?? null) : null;
    return;
  }

  activeTarget = null;
  hover = null;
  dragged = [];
  if (target && accepted.length > 0) {
    target.drop(accepted, at);
  }
}

function targetAt(x: number, y: number): DropTarget | null {
  let node = document.elementFromPoint(x, y);
  while (node) {
    const target = targets.find(candidate => candidate.element === node);
    if (target) {
      return target;
    }
    node = node.parentElement;
  }
  return null;
}

function subscribe(): void {
  if (unlisten !== null) return;
  const bridge = shellBridge();
  if (typeof bridge?.onFileDrop !== 'function') return;

  unlisten = bridge.onFileDrop(event => handleShellFileDropEvent(event));
}

function unsubscribe(): void {
  void unlisten?.then(off => off()).catch(() => undefined);
  unlisten = null;
}
