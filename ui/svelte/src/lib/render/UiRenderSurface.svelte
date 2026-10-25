<script lang="ts">
  /*
   * The boundary between a page and a rendered config tree, standing in for
   * the Angular `providers: [UiNodeEventBus, UiRenderContext]`.
   *
   * It creates the per-surface context, provides it through Svelte's context
   * API, reindexes whenever the root or the localization catalogue changes
   * (the Angular version did this in a constructor effect), and forwards the
   * bus's events to `onevent` - the caller owns what happens to them, usually
   * `handle.send` into the host session.
   */
  import { setContext } from 'svelte';
  import type { UiComponentBox, UiNode, UiNodeEvent } from '@macro-deck/runtime';
  import { localization } from '$lib/localization.svelte';
  import { UI_RENDER_CONTEXT, UiRenderContext } from './ui-render-context.svelte';
  import UiNodeView from './UiNode.svelte';

  interface Props {
    root: UiNode | null;
    box?: UiComponentBox | null;
    basis?: number;
    scopeRefId?: string;
    disabled?: boolean;
    values?: Record<string, unknown> | null;
    unsavedChanges?: boolean;
    onevent?: (event: UiNodeEvent) => void;
    children?: import('svelte').Snippet;
  }

  let {
    root,
    box = null,
    basis = 120,
    scopeRefId,
    disabled = false,
    values = null,
    unsavedChanges = false,
    onevent,
  }: Props = $props();

  const context = new UiRenderContext();
  setContext(UI_RENDER_CONTEXT, context);

  // The tree emits through the context's own bus (that is what the widget
  // render host is bound to), so subscribing anywhere else is a wire into
  // nothing - a tile that paints its press and never sends it.
  const unsubscribeEvents = context.eventBus.events(event => onevent?.(event));

  // The index is a plain map built by one imperative pass, so it needs an
  // explicit dependency on the catalogue to be rebuilt - not merely reused -
  // when the culture changes on a surface that is already on screen.
  // setRoot guards against no-op runs: a write per effect tick is exactly what
  // an update-depth loop is made of.
  $effect(() => {
    context.setRoot(root, localization.catalogVersion);
  });

  $effect(() => {
    context.setScopeRefId(scopeRefId);
    context.setDisabled(disabled);
    context.setValues(values);
    context.setUnsavedChanges(unsavedChanges);
  });

  $effect(() => {
    return () => unsubscribeEvents();
  });
</script>

{#if root}
  <div class="ui-render-surface">
    <UiNodeView node={root} {box} {basis} />
  </div>
{/if}

<style>
  .ui-render-surface {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
    min-width: 0;
  }
</style>
