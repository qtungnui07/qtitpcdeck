<script lang="ts">
  /*
   * The event trigger editor, ported from the Angular EventTriggerEditorComponent:
   * pick a provider then an event, answer the event's configuration parameters
   * (refined by the watched variable's type), and optionally add an extra
   * filter condition the payload must satisfy. Everything lands on the flow's
   * `event` binding through the store.
   */
  import {
    type ActionBlockParameter,
    type ActionFlow,
    AppStrings,
    type ConditionExpression,
    createEmptyComparison,
    defaultEventConfigurationValue,
    qualifiedEventId,
  } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';
  import { eventCatalog, eventProviderGroups, findEventDefinition, loadEventCatalog } from '$lib/event-catalog.svelte';
  import { refineEventConfigurationParameters } from '$lib/event-parameter-refinement.util';
  import { isParameterVisible } from '$lib/parameter-visibility.util';
  import { onMount } from 'svelte';
  import ConditionBuilder from './ConditionBuilder.svelte';
  import ParamRow from './ParamRow.svelte';
  import type { ActionFlowStore } from './action-flow-store.svelte';

  interface Props {
    flow: ActionFlow;
    store: ActionFlowStore;
  }

  let { flow, store }: Props = $props();

  onMount(() => {
    void loadEventCatalog();
  });

  const groups = $derived(eventProviderGroups());
  const providerOptions = $derived(groups.map(group => ({ value: group.providerId, label: group.providerName })));
  const selectedProviderId = $derived(flow.event?.providerId ?? '');

  const eventOptions = $derived.by(() => {
    if (!selectedProviderId) return [];
    const group = groups.find(g => g.providerId === selectedProviderId);
    return (group?.events ?? []).map(event => ({
      value: event.id,
      label: event.category ? `${event.category} - ${event.name}` : event.name,
    }));
  });

  const selectedEventId = $derived(qualifiedEventId(flow.event) ?? '');
  const definition = $derived(findEventDefinition(selectedEventId));

  const parameters = $derived.by(() => {
    if (!definition) return [] as ActionBlockParameter[];
    const stored = flow.event?.parameters ?? [];

    const merged = definition.configurationParameters.map(declared => {
      const existing = stored.find(p => p.name === declared.name);
      return {
        ...declared,
        value: existing ? existing.value : defaultEventConfigurationValue(definition, declared),
        valueLabel: existing?.valueLabel,
        operator: existing?.operator,
      } as ActionBlockParameter;
    });

    return refineEventConfigurationParameters(definition, merged, store.pickerVariables);
  });

  const visibleParameters = $derived(parameters.filter(param => isParameterVisible(param, parameters)));


  const isScheduled = $derived(definition?.deliveryKind === 'scheduled');
  const filter = $derived(flow.event?.filter);

  function onNameChange(name: string): void {
    store.renameEventFlow(flow.triggerId, name);
  }

  function onProviderChange(providerId: string): void {
    store.updateEventBinding(flow.triggerId, { providerId, eventId: '' });
  }

  function onEventChange(qualifiedId: string): void {
    const eventDefinition = findEventDefinition(qualifiedId);
    if (!eventDefinition) return;

    const binding = {
      providerId: eventDefinition.providerId,
      eventId: eventDefinition.id.slice(eventDefinition.providerId.length + 2),
      eventName: eventDefinition.name,
      parameters: eventDefinition.configurationParameters.map(
        declared =>
          ({
            ...declared,
            value: defaultEventConfigurationValue(eventDefinition, declared),
          }) as ActionBlockParameter,
      ),
    };

    store.updateEventBinding(flow.triggerId, binding);
  }

  function onParamChange(paramName: string, value: unknown, valueLabel?: string): void {
    store.updateEventParam(flow.triggerId, paramName, value as never, valueLabel);
  }

  function onFilterChange(expression: ConditionExpression): void {
    store.updateEventFilter(flow.triggerId, expression);
  }

  function addFilter(): void {
    store.updateEventFilter(flow.triggerId, createEmptyComparison());
  }

  function removeFilter(): void {
    store.updateEventFilter(flow.triggerId, undefined);
  }

  function remove(): void {
    store.removeEventTrigger(flow.triggerId);
  }
</script>

<div class="event-trigger-editor">
  <div class="event-header">
    <h4 class="event-title">{translateKey(AppStrings.ActionBuilder.EventTrigger.EventTitle)}</h4>
    <button
      type="button"
      class="event-remove"
      aria-label={translateKey(AppStrings.ActionBuilder.EventTrigger.RemoveTriggerAriaLabel)}
      onclick={remove}
    >
      {translateKey(AppStrings.ActionBuilder.EventTrigger.RemoveTrigger)}
    </button>
  </div>

  {#if eventCatalog.error}
    <p class="event-error" role="alert">{eventCatalog.error}</p>
  {/if}

  <label class="event-field">
    <span class="event-label">{translateKey(AppStrings.ActionBuilder.EventTrigger.NameLabel)}</span>
    <input
      class="event-input"
      type="text"
      maxlength="100"
      placeholder={flow.name ?? ''}
      aria-label={translateKey(AppStrings.ActionBuilder.EventTrigger.NameLabel)}
      value={flow.name ?? ''}
      oninput={event => onNameChange((event.currentTarget as HTMLInputElement).value)}
    />
  </label>

  <div class="event-selects">
    <label class="event-field">
      <span class="event-label">{translateKey(AppStrings.ActionBuilder.EventTrigger.ProviderField)}</span>
      <select
        class="event-input"
        disabled={eventCatalog.loading}
        value={selectedProviderId}
        onchange={event => onProviderChange((event.currentTarget as HTMLSelectElement).value)}
      >
        <option value="">{translateKey(AppStrings.ActionBuilder.EventTrigger.ProviderPlaceholder)}</option>
        {#each providerOptions as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </label>

    <label class="event-field">
      <span class="event-label">{translateKey(AppStrings.ActionBuilder.EventTrigger.EventField)}</span>
      <select
        class="event-input"
        disabled={eventCatalog.loading || !selectedProviderId}
        value={selectedEventId}
        onchange={event => onEventChange((event.currentTarget as HTMLSelectElement).value)}
      >
        <option value="">{translateKey(AppStrings.ActionBuilder.EventTrigger.EventPlaceholder)}</option>
        {#each eventOptions as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </label>
  </div>

  {#if definition}
    {#if definition.description}
      <p class="event-description">{definition.description}</p>
    {/if}

    {#if visibleParameters.length > 0}
      <div class="event-section">
        <h5 class="event-section-label">
          {translateKey(
            isScheduled
              ? AppStrings.ActionBuilder.EventTrigger.Schedule
              : AppStrings.ActionBuilder.EventTrigger.OnlyRunWhen,
          )}
        </h5>
        {#each visibleParameters as param (param.name)}
          <ParamRow
            {param}
            onchange={(value, valueLabel) => onParamChange(param.name, value, valueLabel)}
          />
        {/each}
      </div>
    {/if}

    {#if !isScheduled}
      <div class="event-section">
        <h5 class="event-section-label">{translateKey(AppStrings.ActionBuilder.EventTrigger.ExtraCondition)}</h5>
        {#if filter}
          <ConditionBuilder
            expression={filter}
            variables={store.pickerVariables}
            comparisonOperators={store.comparisonOperators}
            onchange={onFilterChange}
          />
          <button type="button" class="event-link" onclick={removeFilter}>
            {translateKey(AppStrings.ActionBuilder.EventTrigger.RemoveCondition)}
          </button>
        {:else}
          <button type="button" class="event-link" onclick={addFilter}>
            {translateKey(AppStrings.ActionBuilder.EventTrigger.AddCondition)}
          </button>
        {/if}
      </div>
    {/if}
  {:else if !eventCatalog.loading}
    <p class="event-hint">{translateKey(AppStrings.ActionBuilder.EventTrigger.PickEventHint)}</p>
  {/if}
</div>

<style>
  .event-trigger-editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }

  .event-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2, 0.5rem);
  }

  .event-title {
    margin: 0;
    font-size: var(--text-sm, 0.875rem);
    font-weight: var(--font-semibold, 600);
    color: var(--color-text-primary);
  }

  .event-remove {
    background: none;
    border: none;
    color: var(--color-danger, #bf616a);
    cursor: pointer;
    font-size: var(--text-xs, 0.75rem);
    padding: 0;
  }

  .event-error {
    margin: 0;
    color: var(--color-danger, #bf616a);
    font-size: var(--text-xs, 0.75rem);
  }

  .event-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .event-label {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary);
  }

  .event-input {
    padding: 0.375rem var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm, 0.875rem);
    width: 100%;
  }

  .event-selects {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2, 0.5rem);
  }

  .event-description {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--text-xs, 0.75rem);
  }

  .event-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
  }

  .event-section-label {
    margin: 0;
    font-size: var(--text-xs, 0.75rem);
    font-weight: var(--font-semibold, 600);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .event-link {
    align-self: flex-start;
    background: none;
    border: none;
    color: var(--color-accent);
    cursor: pointer;
    font-size: var(--text-xs, 0.75rem);
    padding: 0;
  }

  .event-hint {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm, 0.875rem);
  }
</style>
