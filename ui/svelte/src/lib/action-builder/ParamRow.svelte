<script lang="ts">
  /*
   * One parameter row of an action card, ported from the Angular
   * ParamRowComponent in its client-rendered role.
   *
   * A parameter value is either a literal or a `{ $var }` variable reference;
   * string-typed controls accept either by text (a lone `{{ vars.x }}` token
   * is a reference the host understands). Controls cover the common types;
   * the specialized ones (hotkey recorders, icon pickers, state mapping,
   * nested action builders) render the unsupported-field placeholder until
   * their workstreams land.
   */
  import {
    AppStrings,
    type ActionBlockParameter,
    type ParameterValue,
    isVariableReference,

    WIDGET_TARGET_SELF,
  } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';
  import { folderStore } from '$lib/folders.svelte';
  import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
  import HotkeyRecorder from './HotkeyRecorder.svelte';
  import KeyboardSequenceEditor from './KeyboardSequenceEditor.svelte';

  import type { HotkeyValue, KeyboardSequenceValue } from '@macro-deck/runtime';


  interface Props {
    param: Omit<ActionBlockParameter, 'value'> & { value: ParameterValue };
    disabled?: boolean;
    invalid?: boolean;
    onchange: (value: ParameterValue, valueLabel?: string) => void;
  }

  let { param, disabled = false, invalid = false, onchange }: Props = $props();

  // Controls whose dedicated editors are not ported yet; the row keeps its
  // label and layout and says so instead of silently dropping the field.
  const PENDING_TYPES: ReadonlySet<string> = new Set([
    'actions-list-editor',
    'action-picker',
    'icon-display',
    'icon',
    'image',
    'file',
    'folder',
  ]);

  const isPending = $derived(PENDING_TYPES.has(param.type));

  const value = $derived(param.value);
  const stringValue = $derived.by(() => {
    if (isVariableReference(value)) return `{{ vars.${value.$var} }}`;
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return '';
    return String(value);
  });
  const numberValue = $derived(typeof value === 'number' ? value : null);
  const booleanValue = $derived(value === true);
  const arrayValue = $derived(Array.isArray(value) ? (value as string[]) : []);

  const hotkeyValue = $derived(
    value && typeof value === 'object' && !Array.isArray(value) && 'modifiers' in (value as Record<string, unknown>)
      ? (value as unknown as HotkeyValue)
      : null,
  );





  const sequenceValue = $derived.by(() => {
    const v = param.value;
    return v && typeof v === 'object' && !Array.isArray(v) && Array.isArray((v as Record<string, unknown>)['steps'])
      ? (v as unknown as KeyboardSequenceValue)
      : ({ steps: [], repeat: 1, repeatDelayMs: 0 } as KeyboardSequenceValue);
  });



  const options = $derived(param.options ?? []);

  // A widget-target row offers the widgets that exist, with the owner's own
  // entry named rather than a bare id when it can be found.
  const widgetOptions = $derived.by(() => {
    const entries = [{ value: WIDGET_TARGET_SELF, label: translateKey(AppStrings.Forms.WidgetTargetPicker.ThisWidget) }];
    for (const folder of folderStore.folders) {
      for (const widget of folder.widgets) {
        const label = (widget.data as { label?: unknown } | undefined)?.label;
        entries.push({
          value: widget.id,
          label: typeof label === 'string' && label !== '' ? label : widget.id,
        });
      }
    }
    return entries;
  });

  function onStringInput(event: Event & { currentTarget: EventTarget & HTMLInputElement | HTMLTextAreaElement }): void {
    onchange((event.currentTarget as HTMLInputElement).value);
  }

  function onNumberInput(event: Event & { currentTarget: EventTarget & HTMLInputElement }): void {
    const text = (event.currentTarget as HTMLInputElement).value;
    if (text === '') {
      onchange(null);
      return;
    }
    const parsed = Number(text);
    if (Number.isFinite(parsed)) onchange(parsed);
  }

  function onChoiceChange(event: Event & { currentTarget: EventTarget & HTMLSelectElement }): void {
    const select = event.currentTarget as HTMLSelectElement;
    const option = options.find(o => String(o.value) === select.value);
    onchange(select.value, option?.label ?? select.value);
  }

  function onMultiToggle(option: { value: ParameterValue; label?: string }, checked: boolean): void {
    const next = checked
      ? [...arrayValue, String(option.value)]
      : arrayValue.filter(v => v !== String(option.value));
    onchange(next);
  }
</script>

<div class="param-row" class:is-invalid={invalid}>
  {#if param.type !== 'boolean'}
    <label class="param-label" for="param-{param.name}">
      {param.label}
      {#if param.required}<span class="param-required" aria-hidden="true">*</span>{/if}
    </label>
  {/if}

  <div class="param-control">
    {#if param.type === 'string' || param.type === 'password' || param.type === 'secret' || param.type === 'url' || param.type === 'ipaddress' || param.type === 'autocomplete' || param.type === 'dynamic-choice' && options.length === 0}
      {#if param.multiline}
        <textarea
          id="param-{param.name}"
          class="param-input"
          rows="3"
          placeholder={param.placeholder ?? ''}
          {disabled}
          value={stringValue}
          oninput={onStringInput}
        ></textarea>
      {:else}
        <input
          id="param-{param.name}"
          class="param-input"
          type={param.type === 'password' || param.type === 'secret' ? 'password' : 'text'}
          placeholder={param.placeholder ?? (param.type === 'string' ? '{{ vars.x }}' : '')}
          {disabled}
          value={stringValue}
          oninput={onStringInput}
        />
      {/if}
    {:else if param.type === 'number' || param.type === 'duration'}
      <input
        id="param-{param.name}"
        class="param-input"
        type="number"
        min={param.min ?? undefined}
        max={param.max ?? undefined}
        step={param.step ?? undefined}
        {disabled}
        value={numberValue ?? ''}
        oninput={onNumberInput}
      />
    {:else if param.type === 'boolean'}
      <div class="param-boolean">
        <span class="param-label">{param.label}</span>
        <ToggleSwitch checked={booleanValue} {disabled} onchange={next => onchange(next as unknown as ParameterValue)} />
      </div>
    {:else if param.type === 'choice' || param.type === 'dynamic-choice'}
      <select class="param-select" {disabled} value={stringValue} onchange={onChoiceChange}>
        {#if !param.required && !options.some(o => String(o.value) === '')}
          <option value=""></option>
        {/if}
        {#each options as option (String(option.value))}
          <option value={String(option.value)}>{option.label ?? String(option.value)}</option>
        {/each}
      </select>
    {:else if param.type === 'multiselect'}
      <div class="param-multiselect" role="group" aria-label={param.label}>
        {#each options as option (String(option.value))}
          {@const optionValue = String(option.value)}
          <label class="param-multiselect-option">
            <input
              type="checkbox"
              {disabled}
              checked={arrayValue.includes(optionValue)}
              onchange={event => onMultiToggle(option, (event.currentTarget as HTMLInputElement).checked)}
            />
            <span>{option.label ?? optionValue}</span>
          </label>
        {/each}
      </div>
    {:else if param.type === 'color'}
      <div class="param-color-row">
        {#if stringValue.startsWith('#') && stringValue.length <= 9}
          <input
            type="color"
            class="param-color-swatch"
            {disabled}
            value={stringValue.length === 7 ? stringValue : '#000000'}
            oninput={event => onchange((event.currentTarget as HTMLInputElement).value)}
            aria-label={param.label}
          />
        {:else}
          <span class="param-color-swatch param-color-swatch-empty" aria-hidden="true"></span>
        {/if}
        <input
          id="param-{param.name}"
          class="param-input"
          type="text"
          placeholder="#rrggbb"
          {disabled}
          value={stringValue}
          oninput={onStringInput}
        />
      </div>
    {:else if param.type === 'json' || param.type === 'code'}
      <textarea
        id="param-{param.name}"
        class="param-input param-code"
        spellcheck="false"
        rows="6"
        placeholder={param.placeholder ?? ''}
        {disabled}
        value={stringValue}
        oninput={onStringInput}
      ></textarea>
    {:else if param.type === 'datetime'}
      <input
        id="param-{param.name}"
        class="param-input"
        type="datetime-local"
        {disabled}
        value={stringValue}
        oninput={onStringInput}
      />
    {:else if param.type === 'keyvalue'}
      {@const record = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, string>}
      <div class="param-keyvalue">
        {#each Object.entries(record) as [key, entryValue] (key)}
          <div class="param-keyvalue-row">
            <span class="param-keyvalue-key">{key}</span>
            <input
              class="param-input"
              type="text"
              {disabled}
              value={entryValue}
              oninput={event => onchange({ ...record, [key]: (event.currentTarget as HTMLInputElement).value })}
            />
          </div>
        {/each}
      </div>
    {:else if param.type === 'hotkey' || param.type === 'keyboard-combo'}
      <HotkeyRecorder
        value={hotkeyValue}
        onchange={next => onchange(param.type === 'hotkey' ? next : (next ? { modifiers: next.modifiers, key: next.key } : null))}
      />
    {:else if param.type === 'keyboard-sequence'}
      <KeyboardSequenceEditor value={sequenceValue} onchange={next => onchange(next as unknown as ParameterValue)} />
    {:else if param.type === 'widget-target'}
      <select class="param-select" {disabled} value={stringValue} onchange={onChoiceChange}>
        {#each widgetOptions as widget (widget.value)}
          <option value={widget.value}>{widget.label}</option>
        {/each}
      </select>
    {:else if param.type === 'object' || param.type === 'array'}
      <div class="param-pending" title={param.type}>
        {translateKey(AppStrings.UiRender.UnsupportedField)}
      </div>
    {:else if isPending}
      <div class="param-pending" title={param.type}>
        {translateKey(AppStrings.UiRender.UnsupportedField)}
      </div>
    {:else}
      <input
        id="param-{param.name}"
        class="param-input"
        type="text"
        placeholder={param.placeholder ?? ''}
        {disabled}
        value={stringValue}
        oninput={onStringInput}
      />
    {/if}
  </div>
</div>

<style>
  .param-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .param-label {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary);
  }

  .param-required {
    color: var(--color-danger, #bf616a);
  }

  .param-boolean {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2, 0.5rem);
  }

  .param-input,
  .param-select {
    width: 100%;
    padding: 0.375rem var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm, 0.875rem);
  }

  .is-invalid .param-input,
  .is-invalid .param-select {
    border-color: var(--color-danger, #bf616a);
  }

  .param-code {
    font-family: var(--font-mono);
  }

  .param-multiselect {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 12rem;
    overflow-y: auto;
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
  }

  .param-multiselect-option {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    font-size: var(--text-sm, 0.875rem);
    cursor: pointer;
  }

  .param-color-row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .param-color-swatch {
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: none;
    cursor: pointer;
    flex: none;
  }

  .param-color-swatch-empty {
    background: var(--color-bg-tertiary);
  }

  .param-keyvalue {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .param-keyvalue-row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .param-keyvalue-key {
    font-family: var(--font-mono);
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-accent);
    width: 8rem;
    flex: none;
    overflow-wrap: anywhere;
  }

  .param-pending {
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md, 6px);
    color: var(--color-text-muted);
    font-size: var(--text-xs, 0.75rem);
  }
</style>
