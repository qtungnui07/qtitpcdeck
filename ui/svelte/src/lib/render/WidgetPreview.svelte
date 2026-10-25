<script lang="ts">
  /*
   * A live widget preview, ported from the Angular UiTreeWidgetComponent in
   * its preview role (the editor pane and the drag ghost are its other two).
   *
   * It opens a `widget` UI session for the type and draft data and renders
   * whatever tree the host composes. A data edit does not patch the old
   * session - the host builds the tree from the data the session was opened
   * with, so the preview reopens; the 120 ms debounce keeps a burst of
   * keystrokes to one reopen rather than one each.
   */
  import { onDestroy, untrack } from 'svelte';
  import type { UiNode, UiNodeEvent, UiComponentBox } from '@macro-deck/runtime';
  import {
    activationClaim,
    activationFor,
    type ActionButtonTriggerType,
    emitsEvent,
    hasRunnableFlow,
    TapSequencer,
    treeClaimsGesture,
    UiComponentEvents,
  } from '@macro-deck/runtime';
  import { openUiSession, type UiSessionHandle } from '$lib/ui-session.svelte';
  import UiRenderSurface from './UiRenderSurface.svelte';

  interface Props {
    /** When set, the host serves the widget's live state instead of the draft. */
    widgetId?: string;
    widgetType: string;
    data: Record<string, unknown>;
    width?: number;
    height?: number;
    variableScopeWidgetId?: string;
    /** Rendered while no tree has arrived. */
    children?: import('svelte').Snippet;
    /** Disables interactivity inside the tree (edit mode). */
    disabled?: boolean;
    /** Ask the host for its sample rendering rather than the stored state. */
    sample?: boolean;
    /** The tap pipeline's trigger output. */
    ontrigger?: (triggerType: ActionButtonTriggerType) => void;
    /** Reports the live tree whenever the session paints one. */
    onrootchange?: (root: UiNode | null) => void;
  }

  let { widgetId, widgetType, data, width = 0, height = 0, variableScopeWidgetId, children, onrootchange, ontrigger, disabled = false, sample = false }: Props = $props();

  // How long a keystroke in the editor takes to reach the preview: low enough
  // that typing does not feel disconnected, high enough that a burst of
  // keystrokes is still one reopen rather than one each.
  const PREVIEW_REOPEN_DEBOUNCE_MS = 120;

  // `handle` is reactive so the root below follows the session as it opens:
  // the tree arrives asynchronously, long after openUiSession returned, and a
  // one-time read here would leave every tile on its fallback label forever.
  let handle = $state<UiSessionHandle | null>(null);
  const renderedRoot: UiNode | null = $derived(handle?.root ?? null);
  let reopenTimer: ReturnType<typeof setTimeout> | null = null;

  const box = $derived<UiComponentBox>({
    width: width || null,
    height: height || null,
  });
  const basis = $derived(Math.min(width, height) || 120);

  function buildOpenRequest() {
    return {
      kind: 'widget' as const,
      widgetId,
      widgetType,
      data,
      variableScopeWidgetId,
      sample,
    };
  }

  function openSession(): void {
    clearReopen();
    handle?.close();
    handle = openUiSession(() => buildOpenRequest());
  }

  function schedulePreviewReopen(): void {
    if (reopenTimer !== null) clearTimeout(reopenTimer);
    reopenTimer = setTimeout(() => {
      reopenTimer = null;
      openSession();
    }, PREVIEW_REOPEN_DEBOUNCE_MS);
  }

  function clearReopen(): void {
    if (reopenTimer !== null) {
      clearTimeout(reopenTimer);
      reopenTimer = null;
    }
  }

  $effect(() => {
    void widgetId;
    void widgetType;
    void variableScopeWidgetId;
    // Opening reads the data to build the request, but a data edit must not
    // reopen here as well as through the debounced effect below - that double
    // open is two sessions per keystroke and a visible flash.
    untrack(openSession);
  });

  $effect(() => {
    // The owner (the deck grid) tracks each tile's tree to decide whether the
    // tree claims taps itself.
    onrootchange?.(renderedRoot);
  });

  // The first run is the mount, which the effect above already opened with.
  let dataOpened = false;
  $effect(() => {
    void data;
    if (!dataOpened) {
      dataOpened = true;
      return;
    }
    schedulePreviewReopen();
  });

  // --- the tap pipeline, ported from the Angular UiTreeWidgetComponent ---
  // A tree whose shape claims the gesture (an interactive root) handles its
  // own presses through node gestures; the container pipeline below runs only
  // for trees that claim nothing, and turns a tap into the flow triggers.
  const LONG_PRESS_MS = 600;

  let isPressed = $state(false);
  let longPressTriggered = false;
  let longPressTimeout: ReturnType<typeof setTimeout> | null = null;
  const taps = new TapSequencer();

  function clearLongPressTimeout(): void {
    if (longPressTimeout !== null) {
      clearTimeout(longPressTimeout);
      longPressTimeout = null;
    }
  }

  function claims(): boolean {
    return disabled || treeClaimsGesture(renderedRoot, box);
  }

  function onPressStart(event: PointerEvent): void {
    if (claims()) return;
    event.preventDefault();
    event.stopPropagation();
    clearLongPressTimeout();
    longPressTriggered = false;
    isPressed = true;
    taps.pressStarted(event.clientX, event.clientY);
    ontrigger?.('onTouchStart');
    longPressTimeout = setTimeout(() => {
      if (isPressed) {
        longPressTriggered = true;
        taps.interrupted();
        ontrigger?.('onLongPress');
      }
    }, LONG_PRESS_MS);
  }

  function onPressEnd(event: PointerEvent): void {
    // Gated on whether THIS press started here (isPressed), never on the
    // current claim - the tree can finish loading and start claiming between
    // a press starting and ending, which would strand isPressed on true.
    if (!isPressed) return;
    event.preventDefault();
    event.stopPropagation();
    clearLongPressTimeout();
    isPressed = false;
    ontrigger?.('onTouchEnd');
    if (longPressTriggered) return;
    const flows = (data as { flows?: unknown } | undefined)?.flows;
    taps.tapCompleted(
      hasRunnableFlow(flows, 'onDoublePress'),
      () => ontrigger?.('onShortPress'),
      () => ontrigger?.('onDoublePress'),
      event.clientX,
      event.clientY,
    );
  }

  function onPressCancel(): void {
    if (isPressed) {
      taps.interrupted();
    }
    clearLongPressTimeout();
    isPressed = false;
  }

  // Keyboard activation, ported from activateFromInput: an interactive root
  // is activated through the session; a tree claiming nothing fires the
  // touch lifecycle plus the short-press trigger.
  function onActivateKey(): void {
    if (disabled) return;

    const claim = activationClaim(renderedRoot, box);
    if (claim === 'absorbed') return;
    const interactive = claim === 'none' ? null : claim.node;

    if (interactive !== null) {
      const activation = activationFor(interactive);
      if (activation !== null) {
        onTreeEvent({ nodeId: interactive.id, name: activation.name, data: activation.payload });
        return;
      }
      for (const name of [UiComponentEvents.PressStart, UiComponentEvents.PressEnd, UiComponentEvents.Press]) {
        if (emitsEvent(interactive, name)) {
          onTreeEvent({ nodeId: interactive.id, name });
        }
      }
      return;
    }

    ontrigger?.('onTouchStart');
    ontrigger?.('onTouchEnd');
    ontrigger?.('onShortPress');
  }

  onDestroy(() => {
    clearReopen();
    clearLongPressTimeout();
    taps.dispose();
    handle?.close();
    handle = null;
  });

  function onTreeEvent(event: UiNodeEvent): void {
    handle?.send(event);
  }
</script>

<div
  class="widget-preview"
  class:widget-preview-pressed={isPressed}
  style:width="{width}px"
  style:height="{height}px"
  role="button"
  tabindex={ontrigger && !disabled ? 0 : -1}
  onpointerdown={onPressStart}
  onpointerup={onPressEnd}
  onpointercancel={onPressCancel}
  onpointerleave={onPressCancel}
  onkeydown={event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivateKey();
    }
  }}
>
  <UiRenderSurface root={renderedRoot} {box} {basis} {disabled} onevent={onTreeEvent} />
  {#if renderedRoot === null}
    <!-- Before the host's first tree arrives there is nothing to paint; the
         fallback keeps the tile legible instead of flashing empty. -->
    <div class="widget-preview-fallback">
      {@render children?.()}
    </div>
  {/if}
</div>

<style>
  .widget-preview-pressed {
    transform: scale(0.97);
  }

  .widget-preview {
    position: relative;
    overflow: hidden;
  }

  .widget-preview-fallback {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
</style>
