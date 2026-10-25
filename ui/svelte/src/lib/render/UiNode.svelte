<script lang="ts">
  /*
   * Dispatches one tree node to its renderer, ported from the Angular
   * UiNodeComponent.
   *
   * A node is one of four things: a widget component (`ui.text`, `ui.button`,
   * ...), a chrome container (`ui.config.stack`, tabs, prose, ...), a config
   * input (`ui.config.string`, `ui.config.color`, ...), or - after capability
   * negotiation falls through the whole fallback chain - unsupported, which
   * renders as a labelled placeholder rather than breaking the tree around it.
   */
  import {
    DEFAULT_UI_COMPONENT_REGISTRY,
    UI_COMPONENTS_WELL_KNOWN,
    UI_CONFIG_RENDER_CAPABILITIES,
    UI_MACRODECK_COMPONENTS_WELL_KNOWN,
    type UiComponentBox,
    type UiComponentRange,
    type UiNode,
    isComponentProfileType,
    isUnsupportedResolution,
    resolveRenderableNode,
  } from '@macro-deck/runtime';
  import { getContext } from 'svelte';
  import { translateKey } from '$lib/localization.svelte';
  import { UI_RENDER_CONTEXT, type UiRenderContext } from './ui-render-context.svelte';
  import { UI_CHROME_TYPES } from './ui-chrome-types';
  import UiChrome from './UiChrome.svelte';
  import UiInput from './UiInput.svelte';
  import UiWidgetNode from './UiWidgetNode.svelte';

  interface Props {
    node: UiNode;
    box?: UiComponentBox | null;
    crossExtent?: number | null;
    basis?: number;
  }

  let { node, box = null, crossExtent = null, basis = 120 }: Props = $props();

  const context = getContext<UiRenderContext>(UI_RENDER_CONTEXT)!;

  // Both component namespaces, taken from the runtime rather than restated
  // here: restating them is how a copy drifts to twelve of fourteen types.
  const COMPONENT_TYPES: ReadonlySet<string> = new Set([
    ...UI_COMPONENTS_WELL_KNOWN,
    ...UI_MACRODECK_COMPONENTS_WELL_KNOWN,
  ]);

  const RENDER_CAPABILITIES: Readonly<Record<string, UiComponentRange>> = Object.freeze({
    ...DEFAULT_UI_COMPONENT_REGISTRY.capabilities(),
    ...UI_CONFIG_RENDER_CAPABILITIES,
  });

  const resolution = $derived(resolveRenderableNode(node, RENDER_CAPABILITIES));
  const unsupportedType = $derived(isUnsupportedResolution(resolution) ? resolution.unsupportedType : null);
  const unsupportedIsWidget = $derived(
    unsupportedType !== null && isComponentProfileType(unsupportedType),
  );
  const resolvedNode = $derived(isUnsupportedResolution(resolution) ? null : resolution);
  const isWidget = $derived(resolvedNode !== null && COMPONENT_TYPES.has(resolvedNode.type));
  const isChrome = $derived(resolvedNode !== null && UI_CHROME_TYPES.has(resolvedNode.type));
  const hostId = $derived(resolution.id);
  const hostType = $derived(isUnsupportedResolution(resolution) ? resolution.unsupportedType : resolution.type);
  const visible = $derived(context.isVisible(node));
</script>

<div
  class="ui-node"
  data-node-id={hostId}
  data-node-type={hostType}
  style:display={visible ? null : 'none'}
>
  {#if unsupportedType !== null}
    {#if unsupportedIsWidget}
      <div class="widget-node-unsupported" data-unsupported-type={unsupportedType} title={unsupportedType}></div>
    {:else}
      <div class="config-node-unsupported" data-unsupported-type={unsupportedType} title={unsupportedType}>
        {translateKey('macrodeck.app:UiRender.UnsupportedField')}
      </div>
    {/if}
  {:else if isWidget && resolvedNode !== null}
    <UiWidgetNode node={resolvedNode} {box} {crossExtent} {basis} />
  {:else if isChrome && resolvedNode !== null}
    <UiChrome node={resolvedNode} />
  {:else if resolvedNode !== null}
    <UiInput node={resolvedNode} />
  {/if}
</div>
