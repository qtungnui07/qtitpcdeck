<script lang="ts">
  /*
   * Dialog for running a script that takes parameterized inputs.
   *
   * Converts user inputs to wire values according to each input's declared type.
   */

  import type { ScriptInput, ScriptInputValue } from '@macro-deck/runtime';
  import { AppStrings, scriptInputDefaultValue } from '@macro-deck/runtime';
  import Button from '$lib/components/Button.svelte';
  import Checkbox from '$lib/components/Checkbox.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { translateKey } from '$lib/localization.svelte';

  interface Props {
    scriptName: string;
    inputs: ScriptInput[];
    onrun: (supplied: Record<string, ScriptInputValue>) => void;
    oncancel: () => void;
  }

  let { scriptName, inputs, onrun, oncancel }: Props = $props();

  let values = $state<Record<string, unknown>>({});
  let touched = $state<Set<string>>(new Set<string>());

  $effect(() => {
    const seeded: Record<string, unknown> = {};
    for (const input of inputs) {
      seeded[input.name] = scriptInputDefaultValue(input);
    }
    values = seeded;
    touched = new Set<string>();
  });

  const heading = $derived(
    translateKey(AppStrings.Scripts.RunScriptHeading, { name: scriptName }),
  );

  function isMissing(input: ScriptInput, value: unknown): boolean {
    if (input.required !== true || input.defaultValue !== undefined) return false;
    if (input.type === 'boolean') return false;
    return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
  }

  const canRun = $derived(
    inputs.every(input => !isMissing(input, values[input.name])),
  );

  function setValue(name: string, value: unknown): void {
    values = { ...values, [name]: value };
    touched = new Set(touched).add(name);
  }

  function isSupplied(input: ScriptInput, value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (value === '' && input.type !== 'text') return false;
    return touched.has(input.name) || (input.required === true && input.defaultValue === undefined);
  }

  function toWireValue(input: ScriptInput, value: unknown): ScriptInputValue {
    switch (input.type) {
      case 'boolean':
        return value === true || value === 'true';
      case 'numeric': {
        const numeric = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(numeric) ? numeric : null;
      }
      default:
        return value === null || value === undefined ? '' : String(value);
    }
  }

  function submit(e?: Event): void {
    e?.preventDefault();
    if (!canRun) return;

    const supplied: Record<string, ScriptInputValue> = {};
    for (const input of inputs) {
      const val = values[input.name];
      if (!isSupplied(input, val)) continue;
      supplied[input.name] = toWireValue(input, val);
    }
    onrun(supplied);
  }
</script>

<Modal
  {heading}
  maxWidth="460px"
  showFooter={false}
  onclose={oncancel}
>
  <form class="run-form" onsubmit={submit}>
    <div class="fields">
      {#each inputs as input (input.name)}
        {@const label = input.label || input.name}
        <div class="field">
          {#if input.type === 'boolean'}
            <Checkbox
              label={label}
              checked={values[input.name] === true || values[input.name] === 'true'}
              onchange={(checked) => setValue(input.name, checked)}
            />
          {:else}
            <label class="input-label" for="input-{input.name}">
              <span>{label}</span>
              {#if input.required && input.defaultValue === undefined}
                <span class="required" aria-hidden="true">*</span>
              {/if}
            </label>

            {#if input.type === 'numeric'}
              <input
                id="input-{input.name}"
                class="input"
                type="number"
                value={values[input.name] ?? ''}
                oninput={(e) => setValue(input.name, (e.target as HTMLInputElement).value)}
              />
            {:else if input.type === 'color'}
              <div class="color-row">
                <input
                  id="input-{input.name}"
                  class="color-picker"
                  type="color"
                  value={String(values[input.name] || '#000000')}
                  oninput={(e) => setValue(input.name, (e.target as HTMLInputElement).value)}
                />
                <input
                  class="input color-text"
                  type="text"
                  value={values[input.name] ?? ''}
                  oninput={(e) => setValue(input.name, (e.target as HTMLInputElement).value)}
                />
              </div>
            {:else}
              <input
                id="input-{input.name}"
                class="input"
                type="text"
                value={values[input.name] ?? ''}
                oninput={(e) => setValue(input.name, (e.target as HTMLInputElement).value)}
              />
            {/if}
          {/if}

          {#if input.description}
            <span class="description">{input.description}</span>
          {/if}
        </div>
      {/each}
    </div>

    <div class="actions">
      <Button variant="secondary" onclick={oncancel}>
        {translateKey('macrodeck:Common.Cancel')}
      </Button>
      <Button variant="primary" type="submit" disabled={!canRun}>
        {translateKey(AppStrings.Scripts.RunAction)}
      </Button>
    </div>
  </form>
</Modal>

<style>
  .run-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .input-label {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
  }

  .required {
    color: var(--color-danger);
  }

  .input {
    min-height: var(--control-height);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font: inherit;
    font-size: var(--text-sm);
    box-sizing: border-box;
    width: 100%;
  }

  .input:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .color-row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .color-picker {
    width: var(--control-height);
    height: var(--control-height);
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: none;
    cursor: pointer;
  }

  .color-text {
    flex: 1;
  }

  .description {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
</style>
