<script lang="ts">
  /*
   * The action builder itself, ported from the Angular
   * ActionBuilderComponent: the trigger tabs, the selected flow's block list,
   * the run button, and the picker.
   *
   * The tabs come in three shapes, decided by the surface: a fixed set the
   * node named (`triggers`), the interaction set (presses plus the timer and
   * calendar triggers a widget type owns), or the default press set with the
   * toggle trigger. Event flows get one tab each, named and removable.
   */
  import {
    AppStrings,
    type ActionBlockDefinition,
    type ActionFlow,
    type Variable,
    type VariableScope,
    isEventFlow,
  } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';
  import { showToast } from '$lib/toasts.svelte';
  import { countActions, actionCountLabel } from '$lib/action-summary.util';
  import SegmentedControl from '$lib/components/SegmentedControl.svelte';
  import Button from '$lib/components/Button.svelte';
  import {
    type TriggerTab,
    TOGGLE_TRIGGER_TYPE,
    defaultTriggerTabs,
    defaultActionDefs,
    interactionTriggerTabsFor,
    fixedTriggerTabsFor,
  } from '$lib/default-action-defs';
  import { ActionFlowStore } from './action-flow-store.svelte';
  import ActionBlockList from './ActionBlockList.svelte';
  import ActionPicker from './ActionPicker.svelte';
  import EventTriggerEditor from './EventTriggerEditor.svelte';

  interface Props {
    flows: ActionFlow[];
    availableBlocks: ActionBlockDefinition[];
    variables?: Variable[];
    previewScope?: VariableScope;
    previewScopeRefId?: string;
    ownerWidgetId?: string;
    previewScopeStates?: { id: string; label: string }[] | undefined;
    showToggleTriggers?: boolean;
    triggerTabs?: TriggerTab[] | null;
    interactionTriggerTabs?: TriggerTab[] | null;
    alwaysShowTabRow?: boolean;
    allowRun?: boolean;
    /** Extra triggers the surface offers beyond the standard sets. */
    triggers?: string[] | undefined;
    onflowschange: (flows: ActionFlow[]) => void;
  }

  let {
    flows,
    availableBlocks,
    variables = [],
    previewScope = 'global',
    previewScopeRefId,
    ownerWidgetId,
    previewScopeStates,
    showToggleTriggers = false,
    triggerTabs = null,
    interactionTriggerTabs = null,
    alwaysShowTabRow = false,
    allowRun = false,
    triggers,
    onflowschange,
  }: Props = $props();

  const store = new ActionFlowStore();

  // The store owns a working copy; the page owns persistence. Reseeding on
  // an outside change (a live update adopted by the page) replaces the copy
  // wholesale, the same reseed the Angular builder performed on its inputs.
  // The flows prop arrives as (possibly deep) reactive state; see the store's
  // own plainSnapshot for why the copy goes through an untyped binding.
  function plainSnapshot(value: unknown): ActionFlow[] {
    return ($state.snapshot as (source: unknown) => unknown)(value) as ActionFlow[];
  }

  $effect(() => {
    store.flows = plainSnapshot(flows);
  });

  $effect(() => {
    store.variables = variables;
    store.previewScope = previewScope;
    store.previewScopeRefId = previewScopeRefId;
    store.ownerWidgetId = ownerWidgetId;
    store.previewScopeStates = previewScopeStates;
    store.availableBlocks = [...availableBlocks, ...defaultActionDefs(key => translateKey(key))];
  });

  store.connect(next => onflowschange(plainSnapshot(next)));

  const fixedTabs = $derived(triggerTabs ?? fixedTriggerTabsFor(triggers, key => translateKey(key)));
  const interactionTabs = $derived(interactionTriggerTabs ?? interactionTriggerTabsFor(triggers, key => translateKey(key)));

  const tabOptions = $derived.by(() => {
    const t = (key: string) => translateKey(key);
    const tabs: TriggerTab[] =
      interactionTabs ??
      fixedTabs ??
      [
        ...defaultTriggerTabs(t),
        ...(showToggleTriggers
          ? [{ triggerType: TOGGLE_TRIGGER_TYPE, label: t(AppStrings.ActionBuilder.Trigger.OnStateChange) }]
          : []),
      ];

    const options = tabs.map(tab => ({ value: tab.triggerType, label: tab.label }));
    for (const flow of store.eventFlows) {
      options.push({ value: flow.triggerId, label: flow.name ?? translateKey(AppStrings.ActionBuilder.Toolbar.EventFallbackLabel) });
    }
    return options;
  });

  const selectedTabValue = $derived.by(() => {
    const exists = tabOptions.some(option => option.value === store.selectedTriggerId);
    return exists ? store.selectedTriggerId : (tabOptions[0]?.value ?? '');
  });

  $effect(() => {
    if (!tabOptions.some(option => option.value === store.selectedTriggerId) && tabOptions.length > 0) {
      store.selectedTriggerId = tabOptions[0].value;
    }
  });

  const selectedFlow = $derived(store.selectedFlow);
  const isEventFlowSelected = $derived(selectedFlow !== undefined && isEventFlow(selectedFlow));

  const actionCount = $derived(countActions(selectedFlow?.children));

  function onTabChange(next: string): void {
    const option = tabOptions.find(tab => tab.value === next);
    if (option === undefined) return;
    // An event flow tab already exists; a named trigger is added idempotently.
    store.addTrigger(next);
  }

  async function onRun(): Promise<void> {
    const response = await store.runSelectedFlow();
    if (response === null) return;
    if (response.success && response.status !== 'PartiallyFailed') {
      showToast(translateKey(AppStrings.ActionBuilder.Store.RunSucceeded), { variant: 'success' });
    } else if (response.status === 'PartiallyFailed') {
      showToast(translateKey(AppStrings.ActionBuilder.Store.RunPartiallyFailed), { variant: 'warning' });
    } else {
      const message = response.error?.message;
      showToast(
        (typeof message === 'string' ? message : undefined) ?? translateKey(AppStrings.ActionBuilder.Store.RunFailed),
        { variant: 'error' },
      );
    }
  }
</script>

<div class="action-builder">
  <div class="builder-toolbar" class:has-tabs={tabOptions.length > 0 || alwaysShowTabRow}>
    {#if tabOptions.length > 0}
      <SegmentedControl
        options={tabOptions}
        value={selectedTabValue}
        ariaLabel={translateKey(AppStrings.ActionBuilder.Toolbar.AddTrigger)}
        onchange={onTabChange}
      />
    {:else if alwaysShowTabRow}
      <span class="toolbar-spacer"></span>
    {/if}

    <div class="toolbar-actions">
      {#if actionCount > 0}
        <span class="action-count">{actionCountLabel(actionCount, (key, args) => translateKey(key, args))}</span>
      {/if}
      {#if allowRun}
        <Button variant="secondary" size="compact" disabled={!store.canRun} onclick={() => void onRun()}>
          {translateKey(AppStrings.ActionBuilder.Toolbar.Run)}
        </Button>
      {/if}
    </div>
  </div>

  {#if selectedFlow}
    {#if isEventFlowSelected}
      <EventTriggerEditor flow={selectedFlow} {store} />
    {/if}

    <ActionBlockList blocks={selectedFlow.children} listId={store.rootListId} {store} />
  {:else}
    <p class="empty-flow">{translateKey(AppStrings.ActionBuilder.LoadingTrigger)}</p>
  {/if}

  {#if store.pickerOpenForList !== null}
    <ActionPicker
      blocks={store.availableBlocks}
      onpick={definition => store.pickAction(definition)}
      onclose={() => store.closePicker()}
    />
  {/if}
</div>



<style>
  .action-builder {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
    min-width: 0;
  }

  .builder-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3, 0.75rem);
    flex-wrap: wrap;
  }

  .toolbar-spacer {
    flex: 1;
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .action-count {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-muted);
  }

  .event-note {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm, 0.875rem);
  }

  .event-remove {
    align-self: flex-start;
    background: none;
    border: none;
    color: var(--color-danger, #bf616a);
    cursor: pointer;
    font-size: var(--text-sm, 0.875rem);
    padding: 0;
  }

  .event-remove:hover {
    text-decoration: underline;
  }

  .empty-flow {
    margin: 0;
    padding: var(--space-4, 1rem);
    color: var(--color-text-muted);
    font-size: var(--text-sm, 0.875rem);
  }
</style>
