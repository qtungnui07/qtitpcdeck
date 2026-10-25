/*
 * A stand-in for a UI session handle whose tree arrives asynchronously, which
 * is the shape every real session has: openUiSession returns long before the
 * host pushes its first tree. `root` is reactive so a component reading it is
 * repainted when the tree lands - the behaviour WidgetPreview depends on.
 */

import type { UiNode } from '@macro-deck/runtime';

class FakeSession {
  root = $state<UiNode | null>(null);
  readonly revision = 0;
  readonly rejection = null;
  readonly fault = null;
  readonly generation = 0;
  readonly reopenReason = null;

  send(): void {}

  close(): void {}
}

export const fakeSession = new FakeSession();

export function resetFakeSession(): void {
  fakeSession.root = null;
}
