<script lang="ts">
  /*
   * The config input primitives, ported from the Angular UiInputComponent.
   *
   * Every control edits through `context.setValue`, which layers the value
   * over the tree and emits `change` - the page forwards that to the host
   * session, and the host's next revision is what actually replaces the
   * property. No control writes the node it was given.
   *
   * Coverage note: the common primitives are ported one for one. The
   * specialized pickers (variable/device/integration picker, the action
   * builder, state mapping, thresholds, hotkey recorders) still render the
   * unsupported-field placeholder; they land in the action-builder and
   * form-control workstreams that follow, and the placeholder keeps the rest
   * of the tree around them usable meanwhile.
   */
  import { getContext, onDestroy } from 'svelte';
  import {
    AppStrings,
    UiConfigEvents,
    UiConfigPrimitives,
    UiConfigProperties,
    type UiNode,
    type UiNodeOption,
    emitsEvent,
    nodeBoolean,
    nodeNumber,
    nodeRaw,
    nodeOptions,
    nodeString,
    nodeText,
  } from '@macro-deck/runtime';
  import { localizationTranslator, translateKey } from '$lib/localization.svelte';
  import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
  import SegmentedControl, { type SegmentedOption } from '$lib/components/SegmentedControl.svelte';
  import Button from '$lib/components/Button.svelte';
  import NodeActionBuilder from '$lib/action-builder/NodeActionBuilder.svelte';
  import ThresholdEditor from '$lib/action-builder/ThresholdEditor.svelte';
  import StateMappingEditor from '$lib/action-builder/StateMappingEditor.svelte';
  import { readThresholds } from '@macro-deck/runtime';
  import UiNodeView from './UiNode.svelte';
  import { UI_RENDER_CONTEXT, type UiRenderContext } from './ui-render-context.svelte';

  interface Props {
    node: UiNode;
  }

  let { node }: Props = $props();

  const types = UiConfigPrimitives;
  const properties = UiConfigProperties;
  const context = getContext<UiRenderContext>(UI_RENDER_CONTEXT)!;

  const TRANSPARENT_COLOR = 'transparent';

  function normalizeHttpsUrl(value: string): string {
    if (!value) return value;
    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith('https://') || trimmed.startsWith('http://')) return trimmed;
    return `https://${trimmed}`;
  }

  const label = $derived(nodeText(node, properties.Label, localizationTranslator));
  const hideLabel = $derived(nodeBoolean(node, properties.HideLabel) === true);
  const visibleLabel = $derived(hideLabel ? null : label);
  const description = $derived(nodeText(node, properties.Description, localizationTranslator));
  const placeholder = $derived(nodeText(node, properties.Placeholder, localizationTranslator) ?? '');
  const required = $derived(nodeBoolean(node, properties.Required) === true);
  const maxLength = $derived(nodeNumber(node, properties.MaxLength) ?? null);
  const min = $derived(nodeNumber(node, properties.Min) ?? null);
  const max = $derived(nodeNumber(node, properties.Max) ?? null);
  const step = $derived(nodeNumber(node, properties.Step) ?? null);
  const multiline = $derived(nodeBoolean(node, properties.Multiline) === true);
  const showSlider = $derived(nodeBoolean(node, properties.ShowSlider) === true && min !== null && max !== null);
  const segmented = $derived(nodeBoolean(node, properties.Segmented) === true);
  const cards = $derived(nodeBoolean(node, properties.Cards) === true);
  const autoPrefixHttps = $derived(nodeBoolean(node, properties.AutoPrefixHttps) === true);

  const toggleRow = $derived(node.type === types.Boolean && !segmented && !hideLabel);
  const booleanFalseLabel = $derived(nodeText(node, properties.FalseLabel, localizationTranslator) ?? '');
  const booleanTrueLabel = $derived(nodeText(node, properties.TrueLabel, localizationTranslator) ?? '');
  const booleanSegmentedOptions = $derived<SegmentedOption[]>([
    { value: 'false', label: booleanFalseLabel },
    { value: 'true', label: booleanTrueLabel },
  ]);

  const supportsReset = $derived(nodeBoolean(node, properties.SupportsReset) === true);
  const colorDefaultValue = $derived(
    supportsReset ? (nodeString(node, properties.DefaultValue) ?? '') : undefined,
  );
  const labelRowReset = $derived.by(() => {
    const fallback = colorDefaultValue;
    return node.type === types.Color && fallback !== undefined && stringValue !== fallback;
  });
  const colorResetLabel = $derived(translateKey(AppStrings.Forms.ColorPicker.ResetAriaLabel));
  const allowTransparent = $derived(nodeBoolean(node, properties.AllowTransparent) === true);

  const disabled = $derived(nodeBoolean(node, properties.Disabled) === true || context.disabled);
  const invalid = $derived(nodeBoolean(node, properties.Invalid) === true);

  const errorEntries = $derived.by(() => {
    const entries: { id: string; text: string }[] = [];

    const validationMessage = nodeText(node, properties.ValidationMessage, localizationTranslator);
    if (validationMessage) entries.push({ id: `${node.id}-validation`, text: validationMessage });

    for (const message of context.messagesFor(node.id)) entries.push(message);

    const optionsError = nodeText(node, properties.Error, localizationTranslator);
    if (optionsError) entries.push({ id: `${node.id}-options-error`, text: optionsError });

    return entries;
  });

  const descriptionId = $derived(description ? `${node.id}-description` : null);
  const ariaDescribedby = $derived.by(() => {
    const ids = [descriptionId, ...errorEntries.map(entry => entry.id)].filter(
      (id): id is string => !!id,
    );
    return ids.length ? ids.join(' ') : null;
  });

  const canReload = $derived(emitsEvent(node, UiConfigEvents.Reload));
  const canAdd = $derived(emitsEvent(node, UiConfigEvents.Add));
  const canRemove = $derived(emitsEvent(node, UiConfigEvents.Remove));

  const options = $derived(nodeOptions(node, localizationTranslator) ?? []);
  const numberOptions = $derived(node.type === types.Number ? options : []);
  const selectOptions = $derived(options);
  const segmentedOptions = $derived<SegmentedOption[]>(
    options.map(option =>
      option.icon
        ? { value: option.value, icon: option.icon, ariaLabel: option.label ?? option.value }
        : { value: option.value, label: option.label ?? option.value },
    ),
  );
  const cardOptions = $derived(
    options.map(option => ({
      value: option.value,
      label: option.label ?? option.value,
      description: option.description ?? '',
    })),
  );

  const rawValue = $derived(context.getValue(node));
  const stringValue = $derived.by(() => {
    const value = rawValue;
    return typeof value === 'string' ? value : value == null ? '' : String(value);
  });
  const numberValue = $derived(typeof rawValue === 'number' ? rawValue : null);
  const booleanValue = $derived(rawValue === true);
  const arrayValue = $derived(Array.isArray(rawValue) ? (rawValue as string[]) : []);
  const recordValue = $derived.by(() => {
    const value = rawValue;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, string>)
      : {};
  });

  const numberOptionValue = $derived(
    numberValue === null || numberValue === undefined ? '' : String(numberValue),
  );

  function onChange(value: unknown): void {
    context.setValue(node, value);
  }

  function onNumberChange(value: string | number): void {
    if (value === '' || value == null) return;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) onChange(parsed);
  }

  function onBooleanSegmentedChange(value: string): void {
    onChange(value === 'true');
  }

  function onUrlBlur(): void {
    if (!autoPrefixHttps) return;
    onChange(normalizeHttpsUrl(stringValue));
  }

  function onOpen(): void {
    context.emit(node, UiConfigEvents.Open);
  }

  let filterTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(filterTimer));

  function onFilter(text: string): void {
    const debounce = nodeNumber(node, properties.FilterDebounceMs) ?? 0;
    if (filterTimer) clearTimeout(filterTimer);
    if (debounce <= 0) {
      context.emit(node, UiConfigEvents.Filter, text);
      return;
    }
    filterTimer = setTimeout(() => context.emit(node, UiConfigEvents.Filter, text), debounce);
  }

  function onReload(): void {
    context.emit(node, UiConfigEvents.Reload);
  }

  function onAdd(): void {
    context.emit(node, UiConfigEvents.Add);
  }

  function onRemove(itemId: string): void {
    context.emit(node, UiConfigEvents.Remove, itemId);
  }

  // KeyValue editing works on a copy: the row of inputs is bound locally and
  // the node's value is replaced wholesale on every edit, so a row can be
  // added or dropped without the host round-tripping per keystroke.
  const keyValueRows = $derived.by(() => {
    const rows: { key: string; value: string }[] = [];
    for (const [key, value] of Object.entries(recordValue)) {
      rows.push({ key, value: typeof value === 'string' ? value : String(value) });
    }
    return rows;
  });

  function onKeyValueChange(index: number, next: { key: string; value: string }): void {
    const rows = keyValueRows.map((row, at) => (at === index ? next : row));
    onChange(Object.fromEntries(rows.map(row => [row.key, row.value])));
  }

  function onKeyValueRemove(index: number): void {
    const rows = keyValueRows.filter((_, at) => at !== index);
    onChange(Object.fromEntries(rows.map(row => [row.key, row.value])));
  }

  function onKeyValueAdd(): void {
    const rows = [...keyValueRows, { key: '', value: '' }];
    onChange(Object.fromEntries(rows.map(row => [row.key, row.value])));
  }

  function onMultiSelectToggle(option: UiNodeOption, checked: boolean): void {
    const current = new Set(arrayValue);
    if (checked) current.add(option.value);
    else current.delete(option.value);
    onChange([...current]);
  }

  // Primitives whose dedicated controls are not ported yet: the tree keeps
  // its label and layout, and the control itself says so instead of silently
  // dropping the field.
  const PENDING_CONTROL_TYPES: ReadonlySet<string> = new Set([
    types.Hotkey,
    types.KeyboardCombo,
    types.KeyboardSequence,
    types.WidgetTarget,
    types.ActionPicker,
    types.VariablePicker,
    types.DevicePicker,
    types.IntegrationPicker,
    types.IconDisplay,
  ]);

  // --- thresholds
  const thresholdsValue = $derived.by(() => {
    const stored = readThresholds(rawValue);
    return stored ?? { bands: [{ id: "band-1", color: "#34c759" }] };
  });
  const thresholdsUnit = $derived(nodeText(node, properties.Unit, localizationTranslator));
  const fixedCount = $derived(nodeBoolean(node, properties.FixedCount) === true);
  const fixedColors = $derived(nodeBoolean(node, properties.FixedColors) === true);
  const maxCount = $derived(nodeNumber(node, properties.MaxCount) ?? null);
  const thresholdsCanReset = $derived(nodeBoolean(node, properties.SupportsReset) === true);

  // --- state mapping
  const stateMappingValue = $derived.by(() => {
    const v = rawValue;
    return v !== null && typeof v === "object" && !Array.isArray(v) && Array.isArray((v as Record<string, unknown>)["rules"])
      && typeof (v as Record<string, unknown>)["fallbackStateId"] === "string"
      ? (v as unknown as { rules: { id: string; stateId: string }[]; fallbackStateId: string })
      : undefined;
  });
  const nodeStateOptions = $derived.by(() => {
    const raw = nodeRaw(node, properties.States);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && typeof (item as Record<string, unknown>)["value"] === "string")
      .map(item => ({ value: (item as Record<string, unknown>)["value"] as string, label: typeof (item as Record<string, unknown>)["label"] === "string" ? (item as Record<string, unknown>)["label"] as string : undefined }));
  });

  const isPendingControl = $derived(PENDING_CONTROL_TYPES.has(node.type));
</script>

<div
  class="config-node-field"
  class:is-invalid={invalid}
  class:is-toggle={toggleRow}
  class:is-label-hidden={hideLabel}
  role={hideLabel && label ? 'group' : null}
  aria-label={hideLabel ? label : null}
>
  {#if visibleLabel}
    {#if labelRowReset}
      <div class="config-node-label-row">
        <label class="config-node-label" for={node.id}>
          {visibleLabel}
          {#if required}<span class="config-node-required" aria-hidden="true">*</span>{/if}
        </label>
        <button
          class="config-node-label-reset"
          type="button"
          disabled={disabled}
          title={colorResetLabel}
          aria-label={colorResetLabel}
          onclick={() => onChange(colorDefaultValue)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>
    {:else}
      <label class="config-node-label" for={node.id}>
        {visibleLabel}
        {#if required}<span class="config-node-required" aria-hidden="true">*</span>{/if}
      </label>
    {/if}
  {/if}

  <div class="config-node-control">
    {#if node.type === types.String || node.type === types.IpAddress || node.type === types.Password || node.type === types.Secret}
      {#if multiline}
        <textarea
          id={node.id}
          name={node.id}
          class="config-input"
          placeholder={placeholder}
          required={required}
          maxlength={maxLength ?? undefined}
          {disabled}
          aria-describedby={ariaDescribedby}
          aria-invalid={invalid ? 'true' : undefined}
          rows="3"
          value={stringValue}
          oninput={event => onChange((event.currentTarget as HTMLTextAreaElement).value)}
        ></textarea>
      {:else}
        <input
          id={node.id}
          name={node.id}
          class="config-input"
          type={node.type === types.Password || node.type === types.Secret ? 'password' : 'text'}
          placeholder={placeholder}
          required={required}
          maxlength={maxLength ?? undefined}
          {disabled}
          aria-describedby={ariaDescribedby}
          aria-invalid={invalid ? 'true' : undefined}
          value={stringValue}
          oninput={event => onChange((event.currentTarget as HTMLInputElement).value)}
        />
      {/if}
    {:else if node.type === types.Url}
      <input
        id={node.id}
        name={node.id}
        class="config-input"
        type="url"
        placeholder={placeholder}
        required={required}
        maxlength={maxLength ?? undefined}
        {disabled}
        aria-describedby={ariaDescribedby}
        aria-invalid={invalid ? 'true' : undefined}
        value={stringValue}
        oninput={event => onChange((event.currentTarget as HTMLInputElement).value)}
        onblur={onUrlBlur}
      />
    {:else if node.type === types.Number}
      {#if numberOptions.length > 0}
        <select
          class="config-select"
          {disabled}
          aria-label={label ?? ''}
          value={numberOptionValue}
          onchange={event => onNumberChange((event.currentTarget as HTMLSelectElement).value)}
        >
          {#each numberOptions as option (option.value)}
            <option value={option.value}>{option.label ?? option.value}</option>
          {/each}
        </select>
      {:else if showSlider}
        <div class="config-node-slider-row">
          <input
            type="range"
            class="config-node-slider"
            min={min ?? undefined}
            max={max ?? undefined}
            step={step ?? 1}
            {disabled}
            value={numberValue ?? 0}
            oninput={event => onNumberChange((event.currentTarget as HTMLInputElement).value)}
          />
          <input
            id={node.id}
            name={node.id}
            class="config-input"
            type="number"
            min={min ?? undefined}
            max={max ?? undefined}
            step={step ?? undefined}
            {disabled}
            aria-describedby={ariaDescribedby}
            aria-invalid={invalid ? 'true' : undefined}
            value={numberValue ?? ''}
            oninput={event => onNumberChange((event.currentTarget as HTMLInputElement).value)}
          />
        </div>
      {:else}
        <input
          id={node.id}
          name={node.id}
          class="config-input"
          type="number"
          required={required}
          min={min ?? undefined}
          max={max ?? undefined}
          step={step ?? undefined}
          {disabled}
          aria-describedby={ariaDescribedby}
          aria-invalid={invalid ? 'true' : undefined}
          value={numberValue ?? ''}
          oninput={event => onNumberChange((event.currentTarget as HTMLInputElement).value)}
        />
      {/if}
    {:else if node.type === types.Boolean}
      {#if segmented}
        <SegmentedControl
          options={booleanSegmentedOptions}
          value={booleanValue ? 'true' : 'false'}
          ariaLabel={label ?? ''}
          onchange={onBooleanSegmentedChange}
        />
      {:else}
        <ToggleSwitch checked={booleanValue} {disabled} onchange={onChange} />
      {/if}
    {:else if node.type === types.Choice || node.type === types.DynamicChoice}
      {#if cards}
        <div class="config-choice-cards">
          {#each cardOptions as option (option.value)}
            <button
              type="button"
              class="config-choice-card"
              class:active={option.value === stringValue}
              {disabled}
              onclick={() => onChange(option.value)}
            >
              <span class="config-choice-card-name">{option.label}</span>
              {#if option.description}
                <span class="config-choice-card-desc">{option.description}</span>
              {/if}
            </button>
          {/each}
        </div>
      {:else if segmented}
        <SegmentedControl
          options={segmentedOptions}
          value={stringValue}
          ariaLabel={label ?? ''}
          onchange={onChange}
        />
      {:else if node.type === types.DynamicChoice && canReload}
        <div class="config-node-slider-row">
          <select
            class="config-select"
            {disabled}
            aria-label={label ?? ''}
            value={stringValue}
            onchange={event => onChange((event.currentTarget as HTMLSelectElement).value)}
            onfocus={onOpen}
          >
            {#each selectOptions as option (option.value)}
              <option value={option.value}>{option.label ?? option.value}</option>
            {/each}
          </select>
          <Button variant="ghost" size="icon" ariaLabel={translateKey(AppStrings.UiRender.ReloadOptions)} onclick={onReload}>
            <span class="icon icon-refresh icon-sm" aria-hidden="true"></span>
          </Button>
        </div>
      {:else}
        <select
          class="config-select"
          {disabled}
          aria-label={label ?? ''}
          value={stringValue}
          onchange={event => onChange((event.currentTarget as HTMLSelectElement).value)}
          onfocus={onOpen}
        >
          {#each selectOptions as option (option.value)}
            <option value={option.value}>{option.label ?? option.value}</option>
          {/each}
        </select>
      {/if}
    {:else if node.type === types.Autocomplete}
      <input
        id={node.id}
        name={node.id}
        class="config-input"
        list="{node.id}-datalist"
        placeholder={placeholder}
        {disabled}
        value={stringValue}
        oninput={event => {
          onChange((event.currentTarget as HTMLInputElement).value);
          onFilter((event.currentTarget as HTMLInputElement).value);
        }}
        onfocus={onOpen}
      />
      <datalist id="{node.id}-datalist">
        {#each options as option (option.value)}
          <option value={option.value}>{option.label ?? ''}</option>
        {/each}
      </datalist>
    {:else if node.type === types.MultiSelect}
      <div class="config-multiselect" role="group" aria-label={label ?? ''}>
        {#each options as option (option.value)}
          {@const checked = arrayValue.includes(option.value)}
          <label class="config-multiselect-option">
            <input
              type="checkbox"
              {disabled}
              checked={checked}
              onchange={event => onMultiSelectToggle(option, (event.currentTarget as HTMLInputElement).checked)}
            />
            <span>{option.label ?? option.value}</span>
          </label>
        {/each}
      </div>
    {:else if node.type === types.Color}
      <div class="config-color-row">
        {#if stringValue.startsWith('#') && stringValue.length <= 9}
          <input
            type="color"
            class="config-color-swatch"
            {disabled}
            value={stringValue.length === 7 ? stringValue : '#000000'}
            oninput={event => onChange((event.currentTarget as HTMLInputElement).value)}
            aria-label={label ?? ''}
          />
        {:else}
          <span class="config-color-swatch config-color-swatch-empty" aria-hidden="true"></span>
        {/if}
        <input
          id={node.id}
          name={node.id}
          class="config-input"
          type="text"
          placeholder={placeholder}
          {disabled}
          value={stringValue}
          oninput={event => onChange((event.currentTarget as HTMLInputElement).value)}
        />
        {#if allowTransparent}
          <Button variant="ghost" size="compact" onclick={() => onChange(TRANSPARENT_COLOR)}>
            {translateKey(AppStrings.Widgets.GridSettings.ColorTransparent)}
          </Button>
        {/if}
      </div>
    {:else if node.type === types.File || node.type === types.Folder || node.type === types.Image}
      <input
        id={node.id}
        name={node.id}
        class="config-input"
        type="text"
        placeholder={placeholder}
        {disabled}
        aria-describedby={ariaDescribedby}
        aria-invalid={invalid ? 'true' : undefined}
        value={stringValue}
        oninput={event => onChange((event.currentTarget as HTMLInputElement).value)}
      />
    {:else if node.type === types.Duration}
      <input
        id={node.id}
        name={node.id}
        class="config-input"
        type="number"
        min="0"
        {disabled}
        aria-describedby={ariaDescribedby}
        value={numberValue ?? ''}
        oninput={event => onNumberChange((event.currentTarget as HTMLInputElement).value)}
      />
    {:else if node.type === types.DateTime}
      <input
        id={node.id}
        name={node.id}
        class="config-input"
        type="datetime-local"
        {disabled}
        value={stringValue}
        oninput={event => onChange((event.currentTarget as HTMLInputElement).value)}
      />
    {:else if node.type === types.Json || node.type === types.Code}
      <textarea
        id={node.id}
        name={node.id}
        class="config-input config-code"
        spellcheck="false"
        placeholder={placeholder}
        {disabled}
        rows="6"
        value={stringValue}
        oninput={event => onChange((event.currentTarget as HTMLTextAreaElement).value)}
      ></textarea>
    {:else if node.type === types.KeyValue}
      <div class="config-keyvalue">
        {#each keyValueRows as row, index (index)}
          <div class="config-keyvalue-row">
            <input
              class="config-input config-keyvalue-key"
              type="text"
              placeholder="key"
              {disabled}
              value={row.key}
              oninput={event => onKeyValueChange(index, { key: (event.currentTarget as HTMLInputElement).value, value: row.value })}
            />
            <input
              class="config-input"
              type="text"
              placeholder="value"
              {disabled}
              value={row.value}
              oninput={event => onKeyValueChange(index, { key: row.key, value: (event.currentTarget as HTMLInputElement).value })}
            />
            <Button variant="ghost" size="icon-compact" ariaLabel={translateKey('macrodeck:Common.Remove')} onclick={() => onKeyValueRemove(index)}>
              <span class="icon icon-close icon-xs" aria-hidden="true"></span>
            </Button>
          </div>
        {/each}
        <Button variant="secondary" size="compact" onclick={onKeyValueAdd}>
          {translateKey('macrodeck:Common.Add')}
        </Button>
      </div>
    {:else if node.type === types.Icon}
      <input
        id={node.id}
        name={node.id}
        class="config-input"
        type="text"
        placeholder={placeholder}
        {disabled}
        value={stringValue}
        oninput={event => onChange((event.currentTarget as HTMLInputElement).value)}
      />
    {:else if node.type === types.ActionsListEditor}
      <!-- The builder sources the catalogue, variables and this node's own
           metadata itself (issue #837); the row only hands it the node. -->
      <NodeActionBuilder {node} />
    {:else if node.type === types.Object}
      <div class="config-node-object">
        {#each node.children ?? [] as child (child.id)}
          <UiNodeView node={child} />
        {/each}
      </div>
    {:else if node.type === types.Array}
      <div class="config-node-array">
        {#each node.children ?? [] as item (item.id)}
          {#if item.type !== types.Object || item.children?.length}
            <div class="config-node-array-item">
              <UiNodeView node={item} />
              {#if canRemove}
                <Button variant="ghost" size="compact" onclick={() => onRemove(item.id)}>
                  {translateKey('macrodeck:Common.Remove')}
                </Button>
              {/if}
            </div>
          {/if}
        {/each}
        {#if canAdd}
          <Button variant="secondary" size="compact" onclick={onAdd}>
            {translateKey('macrodeck:Common.Add')}
          </Button>
        {/if}
      </div>
    {:else if node.type === types.Thresholds}
      <ThresholdEditor
        value={thresholdsValue}
        min={min ?? null}
        max={max ?? null}
        unit={thresholdsUnit ?? null}
        {disabled}
        {fixedCount}
        {fixedColors}
        {maxCount}
        canReset={thresholdsCanReset}
        onchange={next => onChange(next ?? null)}
      />
    {:else if node.type === types.StateMappingEditor}
      <StateMappingEditor
        value={stateMappingValue as never}
        stateOptions={nodeStateOptions}
        onchange={next => onChange(next as never)}
      />
    {:else if isPendingControl}
      <div class="config-node-unsupported" data-unsupported-type={node.type} title={node.type}>
        {translateKey(AppStrings.UiRender.UnsupportedField)}
      </div>
    {/if}
  </div>

  {#if description}
    <p class="config-node-description" id={descriptionId}>{description}</p>
  {/if}
  {#each errorEntries as entry (entry.id)}
    <p class="config-node-error" id={entry.id}>{entry.text}</p>
  {/each}
</div>

<style>
  .config-node-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
    min-width: 0;
  }

  .config-node-field.is-toggle {
    flex-direction: row;
    align-items: center;
    gap: var(--space-3, 0.75rem);
  }

  .config-node-label {
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary);
  }

  .config-node-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2, 0.5rem);
  }

  .config-node-required {
    color: var(--color-danger, #bf616a);
    margin-left: 0.125rem;
  }

  .config-node-label-reset {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .config-node-label-reset:hover:not(:disabled) {
    color: var(--color-text-primary);
  }

  .config-node-label-reset:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .config-node-label-reset svg {
    width: 0.875rem;
    height: 0.875rem;
  }

  .config-node-control {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
    min-width: 0;
  }

  .config-node-field.is-toggle .config-node-control {
    flex-direction: row;
    align-items: center;
  }

  .config-input {
    width: 100%;
    padding: 0.5rem var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm, 0.875rem);
  }

  .config-input:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -1px;
  }

  .config-input:disabled {
    opacity: 0.5;
  }

  .is-invalid .config-input {
    border-color: var(--color-danger, #bf616a);
  }

  textarea.config-input {
    resize: vertical;
    font-family: inherit;
  }

  .config-code {
    font-family: var(--font-mono);
  }

  .config-select {
    width: 100%;
    padding: 0.5rem var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm, 0.875rem);
  }

  .config-node-slider-row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .config-node-slider {
    flex: 1;
    accent-color: var(--color-accent);
  }

  .config-node-slider-row .config-input {
    width: 6rem;
    flex: none;
  }

  .config-choice-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    gap: var(--space-2, 0.5rem);
  }

  .config-choice-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
    padding: var(--space-3, 0.75rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    text-align: left;
    cursor: pointer;
    font-size: var(--text-sm, 0.875rem);
  }

  .config-choice-card:hover:not(:disabled) {
    border-color: var(--color-accent);
  }

  .config-choice-card.active {
    border-color: var(--color-accent);
    background: var(--color-accent-muted, rgba(136, 192, 208, 0.15));
  }

  .config-choice-card-name {
    font-weight: var(--font-semibold, 600);
  }

  .config-choice-card-desc {
    color: var(--color-text-secondary);
    font-size: var(--text-xs, 0.75rem);
  }

  .config-multiselect {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
    max-height: 14rem;
    overflow-y: auto;
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
  }

  .config-multiselect-option {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .config-color-row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .config-color-swatch {
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: none;
    cursor: pointer;
    flex: none;
  }

  .config-color-swatch-empty {
    background: var(--color-bg-tertiary);
    cursor: default;
  }

  .config-keyvalue {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .config-keyvalue-row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .config-keyvalue-key {
    width: 40%;
    flex: none;
  }

  .config-node-object {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
    padding: var(--space-3, 0.75rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
  }

  .config-node-array {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .config-node-array-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2, 0.5rem);
  }

  .config-node-array-item > :global(.ui-node) {
    flex: 1;
    min-width: 0;
  }

  .config-node-description {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-xs, 0.75rem);
  }

  .config-node-error {
    margin: 0;
    color: var(--color-danger, #bf616a);
    font-size: var(--text-xs, 0.75rem);
  }

  .config-node-unsupported {
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md, 6px);
    color: var(--color-text-muted);
    font-size: var(--text-sm, 0.875rem);
  }

  .icon {
    display: inline-block;
    width: 1rem;
    height: 1rem;
  }
</style>
