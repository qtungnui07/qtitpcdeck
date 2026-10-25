<script lang="ts">
  /*
   * The condition editor, ported from the Angular ConditionBuilderComponent.
   *
   * A comparison row is left / operator / right; groups join operands with a
   * clickable and/or connective. Operands are either a literal (typed) or a
   * variable reference (picked) - a typed lone `{{ vars.x }}` counts as the
   * reference too, or the dropdown would stop appearing the moment a
   * reference is typed rather than picked (issue #97).
   *
   * The operator set narrows to what the operands can answer: equality and
   * state checks for booleans and choices, comparisons for numbers.
   */
  import {
    AppStrings,
    type ComparisonExpression,
    type ComparisonOperator,
    type ConditionExpression,
    type ParameterValue,
    type Variable,
    type VariableReference,
    appendComparison,
    flipConnectiveAt,
    isComparisonExpression,
    isLogicalExpression,
    isStateOperator,
    isVariableReference,
    removeOperand,
    replaceOperand,
    soleVariableToken,
  } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';
  import Button from '$lib/components/Button.svelte';

  interface Props {
    expression: ConditionExpression;
    variables?: Variable[];
    comparisonOperators: ReadonlyArray<{ label: string; value: ComparisonOperator }>;
    onchange: (replacement: ConditionExpression) => void;
    /** Removes the whole condition; only a caller that can live without one passes it. */
    onremove?: () => void;
  }

  let { expression, variables = [], comparisonOperators, onchange, onremove }: Props = $props();

  const EQUALITY_OPERATORS: ReadonlySet<ComparisonOperator> = new Set(['==', '!=']);
  const NUMERIC_OPERATORS: ReadonlySet<ComparisonOperator> = new Set(['==', '!=', '>', '<', '>=', '<=']);
  const STATE_OPERATORS: ReadonlySet<ComparisonOperator> = new Set(['isEmpty', 'isNotEmpty', 'isAvailable', 'isNotAvailable']);

  function isVariable(value: ParameterValue | undefined): value is VariableReference {
    return isVariableReference(value);
  }

  function resolveVariable(value: ParameterValue | undefined): Variable | undefined {
    const name = referencedVariableName(value);
    return name === null ? undefined : variables.find(v => v.name === name);
  }

  function referencedVariableName(value: ParameterValue | undefined): string | null {
    if (isVariableReference(value)) return value.$var;
    if (typeof value !== 'string') return null;
    const token = soleVariableToken(value);
    return token?.kind === 'variable' ? token.name : null;
  }

  function operandText(value: ParameterValue | undefined): string {
    if (isVariableReference(value)) return `{{ vars.${value.$var} }}`;
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return '';
    return String(value);
  }

  function operatorOptionsFor(comp: ComparisonExpression): ReadonlyArray<{ label: string; value: ComparisonOperator }> {
    switch (narrowingParameter(comp)?.type) {
      case 'choice':
      case 'dynamic-choice':
      case 'autocomplete':
      case 'boolean':
        return comparisonOperators.filter(o => EQUALITY_OPERATORS.has(o.value) || STATE_OPERATORS.has(o.value));
      case 'number':
        return comparisonOperators.filter(o => NUMERIC_OPERATORS.has(o.value) || STATE_OPERATORS.has(o.value));
      default:
        return comparisonOperators;
    }
  }

  // The parameter that decides the operator set: the variable-typed opposite
  // operand. Both sides typed and agreeing keeps the narrowing; disagreeing
  // gives it up.
  function narrowingParameter(comp: ComparisonExpression): { type?: string } | undefined {
    const left = resolveVariable(comp.right);
    const right = resolveVariable(comp.left);
    if (left && right) return left.type === right.type ? { type: left.type } : undefined;
    return left ?? right;
  }

  function isState(op: ComparisonOperator | undefined): boolean {
    return isStateOperator(op);
  }

  function changeComparison(
    comp: ComparisonExpression,
    side: 'left' | 'operator' | 'right',
    value: ParameterValue | ComparisonOperator,
    change: (replacement: ConditionExpression) => void,
  ): void {
    const next: ComparisonExpression =
      side === 'operator'
        ? { ...comp, operator: value as ComparisonOperator }
        : { ...comp, [side]: value as ParameterValue };
    change(next);
  }

  function onOperandInput(
    comp: ComparisonExpression,
    side: 'left' | 'right',
    event: Event & { currentTarget: EventTarget & HTMLInputElement },
    change: (replacement: ConditionExpression) => void,
  ): void {
    changeComparison(comp, side, (event.currentTarget as HTMLInputElement).value, change);
  }

  function onOperatorChange(
    comp: ComparisonExpression,
    event: Event & { currentTarget: EventTarget & HTMLSelectElement },
    change: (replacement: ConditionExpression) => void,
  ): void {
    changeComparison(comp, 'operator', (event.currentTarget as HTMLSelectElement).value as ComparisonOperator, change);
  }

  function onVariablePick(
    comp: ComparisonExpression,
    side: 'left' | 'right',
    event: Event & { currentTarget: EventTarget & HTMLSelectElement },
    change: (replacement: ConditionExpression) => void,
  ): void {
    const name = (event.currentTarget as HTMLSelectElement).value;
    if (name === '') return;
    changeComparison(comp, side, { $var: name }, change);
  }

  function clearVariable(
    comp: ComparisonExpression,
    side: 'left' | 'right',
    change: (replacement: ConditionExpression) => void,
  ): void {
    changeComparison(comp, side, '', change);
  }

  function addCondition(current: ConditionExpression, change: (replacement: ConditionExpression) => void): void {
    const joinKind = isLogicalExpression(current) ? current.kind : 'and';
    change(appendComparison(current, joinKind));
  }

  function connectiveLabel(kind: 'and' | 'or'): string {
    return translateKey(
      kind === 'and' ? AppStrings.ConditionBuilder.ConnectiveAnd : AppStrings.ConditionBuilder.ConnectiveOr,
    );
  }

  function connectiveToggleTitle(kind: 'and' | 'or'): string {
    return translateKey(
      kind === 'and' ? AppStrings.ConditionBuilder.SwitchToOr : AppStrings.ConditionBuilder.SwitchToAnd,
    );
  }
</script>

{#snippet row(comp: ComparisonExpression, change: (replacement: ConditionExpression) => void, onrowremove?: () => void)}
  <div class="cb-row">
    <div class="cb-operand">
      {#if isVariable(comp.left)}
        <select
          class="cb-variable-select"
          aria-label={translateKey(AppStrings.ConditionBuilder.ValuePlaceholder)}
          value={comp.left.$var}
          onchange={event => onVariablePick(comp, 'left', event, change)}
        >
          <option value={comp.left.$var} selected>{operandText(comp.left)}</option>
          {#each variables as variable (variable.name)}
            <option value={variable.name}>{variable.name}</option>
          {/each}
        </select>
        <button
          type="button"
          class="cb-clear"
          title={translateKey(AppStrings.ConditionBuilder.ClearLeftVariable)}
          onclick={() => clearVariable(comp, 'left', change)}>×</button>
      {:else}
        <input
          class="cb-input"
          type="text"
          placeholder={'{{ vars.x }}'}
          value={operandText(comp.left)}
          oninput={event => onOperandInput(comp, 'left', event, change)}
        />
      {/if}
    </div>

    <select
      class="cb-operator"
      aria-label={translateKey(AppStrings.ActionBuilder.Comparison.Is)}
      value={comp.operator}
      onchange={event => onOperatorChange(comp, event, change)}
    >
      {#each operatorOptionsFor(comp) as option (option.value)}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>

    <div class="cb-operand">
      {#if !isState(comp.operator)}
        {#if isVariable(comp.right)}
          <select
            class="cb-variable-select"
            aria-label={translateKey(AppStrings.ConditionBuilder.ValuePlaceholder)}
            value={comp.right.$var}
            onchange={event => onVariablePick(comp, 'right', event, change)}
          >
            <option value={comp.right.$var} selected>{operandText(comp.right)}</option>
            {#each variables as variable (variable.name)}
              <option value={variable.name}>{variable.name}</option>
            {/each}
          </select>
          <button
            type="button"
            class="cb-clear"
            title={translateKey(AppStrings.ConditionBuilder.ClearRightVariable)}
            onclick={() => clearVariable(comp, 'right', change)}>×</button>
        {:else if resolveVariable(comp.left)?.type === 'boolean' || resolveVariable(comp.right)?.type === 'boolean'}
          <select
            class="cb-input"
            aria-label={translateKey(AppStrings.ConditionBuilder.ValuePlaceholder)}
            value={operandText(comp.right)}
            onchange={event =>
              changeComparison(comp, 'right', (event.currentTarget as HTMLSelectElement).value, change)}
          >
            <option value="" selected={operandText(comp.right) === ''}></option>
            <option value="true" selected={operandText(comp.right) === 'true'}>
              {translateKey(AppStrings.ConditionBuilder.True)}
            </option>
            <option value="false" selected={operandText(comp.right) === 'false'}>
              {translateKey(AppStrings.ConditionBuilder.False)}
            </option>
          </select>
        {:else}
          <input
            class="cb-input"
            type="text"
            placeholder={translateKey(AppStrings.ConditionBuilder.ValuePlaceholder)}
            value={operandText(comp.right)}
            oninput={event => onOperandInput(comp, 'right', event, change)}
          />
        {/if}
      {:else}
        <span class="cb-state-spacer" aria-hidden="true"></span>
      {/if}
    </div>

    {#if onrowremove}
      <button
        type="button"
        class="cb-remove"
        title={translateKey(AppStrings.ConditionBuilder.RemoveCondition)}
        onclick={onrowremove}>×</button>
    {/if}
  </div>
{/snippet}

{#snippet node(expr: ConditionExpression, change: (replacement: ConditionExpression) => void, rowRemovable: boolean)}
  {#if isComparisonExpression(expr)}
    {@render row(expr, change, rowRemovable ? onremove : undefined)}
  {:else}
    <div class="cb-group">
      {#each expr.operands as operand, index (operand.id)}
        <div class="cb-group-row">
          {#if index > 0}
            <button
              type="button"
              class="cb-connective"
              title={connectiveToggleTitle(expr.kind)}
              onclick={() => change(flipConnectiveAt(expr, index - 1))}
            >
              {connectiveLabel(expr.kind)}
            </button>
          {:else}
            <span class="cb-connective-spacer"></span>
          {/if}
          {@render node(
            operand,
            replacement => change(replaceOperand(expr, index, replacement)),
            expr.operands.length > 1,
          )}
          {#if expr.operands.length > 1}
            <button
              type="button"
              class="cb-remove"
              title={translateKey(AppStrings.ConditionBuilder.RemoveCondition)}
              onclick={() => {
                const next = removeOperand(expr, index);
                if (next !== null) change(next);
              }}>×</button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
{/snippet}

<div class="cb-root">
  {@render node(expression, onchange, onremove !== undefined)}
  <Button variant="ghost" size="compact" onclick={() => addCondition(expression, onchange)}>
    + {translateKey(AppStrings.ConditionBuilder.AddCondition)}
  </Button>
</div>

<style>
  .cb-root {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
    align-items: flex-start;
  }

  .cb-row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    width: 100%;
  }

  .cb-operand {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
  }

  .cb-input,
  .cb-variable-select,
  .cb-operator {
    padding: 0.375rem var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm, 0.875rem);
    min-width: 0;
    width: 100%;
  }

  .cb-operator {
    width: auto;
    flex: none;
  }

  .cb-clear,
  .cb-remove {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: var(--text-base, 1rem);
    line-height: 1;
    padding: 0.125rem 0.25rem;
  }

  .cb-clear:hover,
  .cb-remove:hover {
    color: var(--color-danger, #bf616a);
  }

  .cb-state-spacer {
    flex: 1;
  }

  .cb-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
    width: 100%;
    padding-left: var(--space-3, 0.75rem);
    border-left: 2px solid var(--color-border);
  }

  .cb-group-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
  }

  .cb-connective {
    align-self: flex-start;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm, 4px);
    color: var(--color-accent);
    cursor: pointer;
    font-size: var(--text-xs, 0.75rem);
    font-weight: var(--font-semibold, 600);
    padding: 0.125rem var(--space-2, 0.5rem);
    text-transform: uppercase;
  }

  .cb-connective:hover {
    border-color: var(--color-accent);
  }

  .cb-connective-spacer {
    height: 0.5rem;
  }
</style>
