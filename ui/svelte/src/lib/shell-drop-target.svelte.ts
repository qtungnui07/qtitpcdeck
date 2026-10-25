/*
 * The drop target as a Svelte action, ported from the Angular
 * ShellDropTargetDirective: registers the element with the shell file-drop
 * service, and reports drops to the caller. The service stops at the first
 * registered ancestor of the pointer, so a target rejects a payload rather
 * than passing it on.
 *
 * Inside the desktop shell only - outside it the service is inert, so any
 * hover hint can be gated on `shellFileDrop.supported` staying quiet in a
 * plain browser.
 */

import { untrack } from 'svelte';
import { registerShellDropTarget, shellFileDrop, type ShellDropPosition } from './shell-file-drop.svelte';
import { shellDropKind, type ShellDropKind } from './shell-drop.util';
import type { ShellDroppedPath } from './shell-bridge';

export interface ShellDropTargetParams {
  kinds: readonly ShellDropKind[];
  acceptAt?: (kind: ShellDropKind, at: ShellDropPosition) => boolean;
  /** Fires when this element stops being the active hover target, to clear a hint. */
  onHoverEnd?: () => void;
  onDrop: (paths: ShellDroppedPath[], at: ShellDropPosition) => void;
}

export function shellDropTarget(
  element: HTMLElement,
  params: ShellDropTargetParams,
): { update(next: ShellDropTargetParams): void; destroy(): void } {
  let current = params;

  const accept = (paths: ShellDroppedPath[], at: ShellDropPosition): ShellDroppedPath[] =>
    paths.filter(path => {
      const kind = shellDropKind(path);
      return kind !== null
        && current.kinds.includes(kind)
        && (current.acceptAt?.(kind, at) ?? true);
    });

  const unregister = registerShellDropTarget(element, accept, (paths, at) => {
    untrack(() => {
      current.onDrop(paths, at);
      current.onHoverEnd?.();
    });
  });

  // The service marks the active target on hover; a caller rendering a hint
  // from its own state needs to know when this element loses the hover. The
  // effect dies with the component - no explicit teardown to hold.
  $effect(() => {
    if (shellFileDrop.activeTarget !== element) {
      untrack(() => current.onHoverEnd?.());
    }
  });

  return {
    update(next: ShellDropTargetParams): void {
      current = next;
    },
    destroy(): void {
      unregister();
    },
  };
}
