<script lang="ts">
  /*
   * A widget component (`ui.text`, `ui.button`, ...) rendered by the runtime's
   * own DOM renderer, ported from the Angular UiWidgetNodeComponent.
   *
   * The DOM under here is not Svelte's: `renderUiNode` owns the subtree and
   * the handle's `update` patches it, so this component is only the lifecycle
   * bridge - mount, update on prop change, destroy.
   */
  import { getContext, onDestroy } from 'svelte';
  import {
    type UiComponentBox,
    type UiNode,
    type UiNodeRenderHandle,
    renderUiNode,
  } from '@macro-deck/runtime';
  import { bindWidgetRenderHost } from './ui-widget-render-host';
  import { UI_RENDER_CONTEXT, type UiRenderContext } from './ui-render-context.svelte';

  interface Props {
    node: UiNode;
    box?: UiComponentBox | null;
    crossExtent?: number | null;
    basis?: number;
  }

  let { node, box = null, crossExtent = null, basis = 120 }: Props = $props();

  const context = getContext<UiRenderContext>(UI_RENDER_CONTEXT)!;

  let container: HTMLElement | undefined = $state();
  let handle: UiNodeRenderHandle | null = null;
  const boundHost = bindWidgetRenderHost(context.eventBus);

  // The runtime paints synchronously; a plain reactive read of the props is
  // enough to drive the update, with $effect keeping the ordering after mount.
  $effect(() => {
    void node;
    void box;
    void crossExtent;
    void basis;
    if (container === undefined) return;

    if (handle === null) {
      handle = renderUiNode(container, node, box, crossExtent, basis, boundHost);
    } else {
      handle.update(node, box, crossExtent, basis);
    }
  });

  onDestroy(() => {
    handle?.destroy();
    handle = null;
  });
</script>

<!-- The renderer writes data-node-id/data-node-type on the widget element
     itself; a second copy out here would give every node two elements
     answering to its id. -->
<div class="ui-widget-node" bind:this={container}></div>

<style>
  .ui-widget-node {
    display: contents;
  }
</style>
