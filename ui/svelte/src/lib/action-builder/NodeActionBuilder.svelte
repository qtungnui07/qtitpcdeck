<script lang="ts">
  /*
   * The bridge between a config tree's `actions-list-editor` node and the
   * action builder, ported from the Angular NodeActionBuilderComponent.
   *
   * The node carries the trigger vocabulary (`triggers`, a flat list of
   * trigger-type ids), the draft states (`states`), and whether the flows can
   * be run (`canRun`); the value is the flow list itself. The builder sources
   * the client-owned action catalogue and variables itself (issue #837) - the
   * node's own properties stay metadata.
   */
  import { getContext, onMount } from 'svelte';
  import {
    UiConfigProperties,
    type ActionFlow,
    type UiNode,
    type UiNodeOption,
    nodeBoolean,
    nodeStringArray,
  } from '@macro-deck/runtime';
  import { loadActionCatalogue, actionBlockDefinitions } from '$lib/actions.svelte';
  import { loadVariables, variableStore } from '$lib/variables.svelte';
  import { UI_RENDER_CONTEXT, type UiRenderContext } from '$lib/render/ui-render-context.svelte';
  import {
    TOGGLE_TRIGGER_TYPE,
    fixedTriggerTabsFor,
    interactionTriggerTabsFor,
  } from '$lib/default-action-defs';
  import { translateKey } from '$lib/localization.svelte';
  import ActionBuilder from './ActionBuilder.svelte';

  export interface ProviderChangeRequest {
    capability: 'state' | 'icon';
    blockId: string;
    enabled: boolean;
  }

  interface Props {
    node: UiNode;
  }

  let { node }: Props = $props();

  const context = getContext<UiRenderContext>(UI_RENDER_CONTEXT)!;

  const flows = $derived.by(() => {
    const value = context.getValue(node);
    return Array.isArray(value) ? (value as ActionFlow[]) : [];
  });

  const triggers = $derived(nodeStringArray(node, UiConfigProperties.Triggers));
  const canRun = $derived(nodeBoolean(node, UiConfigProperties.CanRun) === true);
  const showToggleTriggers = $derived(triggers?.includes(TOGGLE_TRIGGER_TYPE) ?? false);

  const states = $derived.by(() => {
    const raw = node.properties?.[UiConfigProperties.States];
    return Array.isArray(raw) ? (raw as UiNodeOption[]) : undefined;
  });

  const scopeRefId = $derived(context.scopeRefId);

  const fixedTriggerTabs = $derived(fixedTriggerTabsFor(triggers, key => translateKey(key)));
  const interactionTriggerTabs = $derived(interactionTriggerTabsFor(triggers, key => translateKey(key)));

  const previewScopeStates = $derived(
    states?.map(state => ({ id: state.value, label: state.label ?? state.value })),
  );

  const variables = $derived(variableStore.variables);

  const blocks = $derived(actionBlockDefinitions());

  onMount(() => {
    void loadActionCatalogue();
    void loadVariables();
  });

  function onFlowsChange(next: ActionFlow[]): void {
    context.setValue(node, next);
  }
</script>

<ActionBuilder
  flows={flows}
  availableBlocks={blocks}
  {variables}
  previewScope={scopeRefId !== undefined ? 'widget' : 'global'}
  previewScopeRefId={scopeRefId}
  ownerWidgetId={scopeRefId}
  previewScopeStates={previewScopeStates}
  {showToggleTriggers}
  triggerTabs={fixedTriggerTabs}
  interactionTriggerTabs={interactionTriggerTabs}
  alwaysShowTabRow={fixedTriggerTabs !== null}
  allowRun={canRun}
  onflowschange={onFlowsChange}
/>
