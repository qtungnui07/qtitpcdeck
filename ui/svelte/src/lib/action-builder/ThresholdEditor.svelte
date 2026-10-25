<script lang="ts">
  /*
   * The threshold bands editor, ported from the Angular ThresholdEditorComponent:
   * N colour bands over the widget's value axis - the lowest band starts at the
   * scale floor, every other band starts at its `from` mark. Bands insert,
   * recolor, refill and remove; counts can be fixed by the parameter def.
   */
  import { AppStrings, type ThresholdBand, type ThresholdsValue } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';

  interface Props {
    value: ThresholdsValue;
    min?: number | null;
    max?: number | null;
    unit?: string | null;
    label?: string | null;
    disabled?: boolean;
    fixedCount?: boolean;
    fixedColors?: boolean;
    maxCount?: number | null;
    canReset?: boolean;
    onchange: (value: ThresholdsValue) => void;
    onreset?: () => void;
  }

  let {
    value,
    min = null,
    max = null,
    unit = null,
    disabled = false,
    fixedCount = false,
    fixedColors = false,
    maxCount = null,
    canReset = false,
    onchange,
    onreset,
  }: Props = $props();

  const bands = $derived(value.bands ?? []);

  function replace(next: ThresholdBand[]): void {
    onchange({ bands: next });
  }

  function onFromInput(index: number, raw: string): void {
    const parsed = Number(raw);
    const next = bands.map((band, at) =>
      at === index ? { ...band, from: raw === '' ? undefined : (Number.isFinite(parsed) ? parsed : 0) } : band,
    );
    replace(next);
  }

  function onColorInput(index: number, color: string): void {
    const next = bands.map((band, at) => (at === index ? { ...band, color } : band));
    replace(next);
  }

  function addBand(): void {
    const last = bands[bands.length - 1];
    const from = typeof last?.from === 'number'
      ? (typeof bands[bands.length - 2]?.from === 'number'
        ? Math.round((last.from + (bands[bands.length - 2].from as number)) / 2)
        : (last.from ?? 0) + 10)
      : ((min ?? 0) + (max ?? 100)) / 2;
    replace([...bands, { id: `band-${Date.now()}-${Math.round(Math.random() * 1e6)}`, color: '#4c566a', from }]);
  }

  function removeBand(index: number): void {
    replace(bands.filter((_, at) => at !== index));
  }
</script>

<div class="thresholds">
  {#each bands as band, index (band.id)}
    <div class="band-row" data-band-index={index}>
      <input
        type="color"
        class="band-color"
        value={/#[0-9a-fA-F]{6}/.test(band.color) ? band.color : '#000000'}
        disabled={disabled || (fixedColors && index === 0)}
        aria-label={translateKey(AppStrings.Widgets.GridSettings.ColorTransparent)}
        oninput={event => onColorInput(index, (event.currentTarget as HTMLInputElement).value)}
      />
      {#if index > 0}
        <span class="band-from">{unit ?? ''}{min ?? 0} ≤</span>
        <input
          class="band-from-input"
          type="number"
          {disabled}
          value={band.from ?? ''}
          oninput={event => onFromInput(index, (event.currentTarget as HTMLInputElement).value)}
        />
        true
      {:else}
        <span class="band-from band-from-label">≤ {max ?? ''} {unit ?? ''}</span>
      {/if}
      {#if index > 0 && !fixedCount && bands.length > 1}
        <button type="button" class="band-remove" onclick={() => removeBand(index)}>×</button>
      {/if}
    </div>
  {/each}

  <div class="thresholds-actions">
    {#if !fixedCount && bands.length < (maxCount ?? 64)}
      <button type="button" class="band-add" onclick={addBand}>
        + {translateKey('macrodeck:Common.Add')}
      </button>
    {/if}
    {#if canReset && onreset}
      <button type="button" class="band-add" onclick={() => onreset()}>
        {translateKey(AppStrings.Settings.Appearance.PaletteRestoreDefaults)}
      </button>
    {/if}
  </div>
</div>

<style>
  .thresholds {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .band-row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .band-color {
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: none;
    cursor: pointer;
    flex: none;
  }

  .band-from,
  .band-from-label {
    color: var(--color-text-muted);
    font-size: var(--text-xs, 0.75rem);
    flex: none;
  }

  .band-from-input {
    width: 5rem;
    padding: 0.25rem var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm, 0.875rem);
  }

  .band-remove {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 0 0.25rem;
  }

  .band-remove:hover {
    color: var(--color-danger, #bf616a);
  }

  .thresholds-actions {
    display: flex;
    gap: var(--space-2, 0.5rem);
  }

  .band-add {
    background: none;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md, 6px);
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: var(--text-xs, 0.75rem);
    padding: 0.25rem var(--space-2, 0.5rem);
  }

  .band-add:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
</style>
