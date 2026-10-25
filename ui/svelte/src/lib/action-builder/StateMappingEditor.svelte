<script lang="ts">
  /*
   * The button-state mapping editor for a state-provider widget, ported down
   * from the Angular node-state-mapping-editor + modal as one inline editor:
   * rules of `when` (condition) -> state, evaluated top to bottom, with a
   * fallback state for when nothing matches.
   */
  import { AppStrings, generateBlockId } from '@macro-deck/runtime';
  import type { ButtonStateMappingRule, ConditionExpression, UiNodeOption } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';
  import ConditionBuilder from './ConditionBuilder.svelte';

  export interface StateMappingValue {
    rules: ButtonStateMappingRule[];
    fallbackStateId: string;
  }

  interface Props {
    value: StateMappingValue | undefined;
    stateOptions: UiNodeOption[];
    onchange: (value: StateMappingValue) => void;
  }

  let { value, stateOptions, onchange }: Props = $props();

  const rules = $derived(value?.rules ?? []);
  const fallbackStateId = $derived(value?.fallbackStateId ?? '');

  function onRuleConditionChange(index: number, expression: ConditionExpression): void {
    onchange({
      rules: rules.map((rule, at) => (at === index ? { ...rule, when: expression } : rule)),
      fallbackStateId,
    });
  }

  function onRuleStateChange(index: number, stateId: string): void {
    onchange({
      rules: rules.map((rule, at) => (at === index ? { ...rule, stateId } : rule)),
      fallbackStateId,
    });
  }

  function addRule(): void {
    onchange({
      rules: [
        ...rules,
        {
          id: generateBlockId(),
          stateId: stateOptions[0]?.value ?? '',
          when: { kind: 'compare', id: generateBlockId(), left: { $var: 'x' }, operator: '==', right: '' },
        },
      ],
      fallbackStateId,
    });
  }

  function removeRule(index: number): void {
    onchange({ rules: rules.filter((_, at) => at !== index), fallbackStateId });
  }

  function onFallbackChange(stateId: string): void {
    if (stateId === '') return;
    onchange({ rules, fallbackStateId: stateId });
  }
</script>

<div class="state-mapping">
  {#each rules as rule, index (rule.id)}
    <div class="rule" data-rule-index={index}>
      <div class="rule-state-row">
        <span class="rule-label">{translateKey(AppStrings.Widgets.Editor.StateMapping)}</span>
        <select
          class="state-select"
          value={rule.stateId}
          onchange={event => onRuleStateChange(index, (event.currentTarget as HTMLSelectElement).value)}
        >
          {#each stateOptions as option (option.value)}
            <option value={option.value}>{option.label ?? option.value}</option>
          {/each}
        </select>
        {#if rules.length > 1}
          <button type="button" class="rule-remove" onclick={() => removeRule(index)}>×</button>
        {/if}
      </div>
      {#if rule.when}
        <ConditionBuilder
          expression={rule.when}
          variables={[]}
          comparisonOperators={[
            { label: '==', value: '==' },
            { label: '!=', value: '!=' },
            { label: '>', value: '>' },
            { label: '<', value: '<' },
            { label: '>=', value: '>=' },
            { label: '<=', value: '<=' },
            { label: 'isNotEmpty', value: 'isNotEmpty' },
            { label: 'isEmpty', value: 'isEmpty' },
          ]}
          onchange={expression => onRuleConditionChange(index, expression)}
        />
      {/if}
    </div>
  {/each}

  <div class="fallback-row">
    <span class="rule-label">{translateKey(AppStrings.Widgets.Editor.ConfigureStateMapping)}</span>
    <select class="state-select" value={fallbackStateId} onchange={event => onFallbackChange((event.currentTarget as HTMLSelectElement).value)}>
      {#each stateOptions as option (option.value)}
        <option value={option.value}>{option.label ?? option.value}</option>
      {/each}
    </select>
  </div>

  <button type="button" class="rule-add" onclick={addRule}>
    + {translateKey('macrodeck:Common.Add')}
  </button>
</div>

<style>
  .state-mapping {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }

  .rule {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
  }

  .rule-state-row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .rule-label {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary);
  }

  .state-select {
    flex: 1;
    padding: 0.3rem var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm, 0.875rem);
  }

  .rule-remove {
    background: none;
    border: none;
    color: var(--color-danger, #bf616a);
    cursor: pointer;
    padding: 0 0.25rem;
  }

  .fallback-row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .rule-add {
    align-self: flex-start;
    background: none;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md, 6px);
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: var(--text-xs, 0.75rem);
    padding: 0.25rem var(--space-2, 0.5rem);
  }
</style>
