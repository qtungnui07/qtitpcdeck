<script lang="ts">
  /*
   * A keyboard sequence editor, ported down from the Angular
   * KeyboardSequenceEditorComponent: steps of key combos (captured the same
   * way the hotkey recorder captures), typed text and delays, plus the
   * sequence's repeat count. Steps are reorderable with the move buttons and
   * removable one by one.
   */
  import {
    type KeyComboStepValue,
    keyFromEvent,
    type KeyboardSequenceValue,
    type KeyboardStepValue,
  } from '@macro-deck/runtime';
  import { startHotkeyCapture, stopHotkeyCapture } from '$lib/hotkey-capture';
  import { onDestroy } from 'svelte';

  interface Props {
    value: KeyboardSequenceValue | null;
    onchange: (value: KeyboardSequenceValue | null) => void;
  }

  let { value, onchange }: Props = $props();

  let recordingIndex = $state<number | null>(null);
  let hostEl = $state<HTMLElement | null>(null);
  let pendingCombo = $state<KeyComboStepValue | null>(null);

  const steps = $derived(value?.steps ?? []);
  const repeat = $derived(value?.repeat ?? 1);
  const repeatDelayMs = $derived(value?.repeatDelayMs ?? 0);

  function stepDisplay(step: KeyboardStepValue): string {
    if (step.type === 'keyCombo' || step.type === 'keyDown' || step.type === 'keyUp') {
      return [...step.modifiers, step.key].filter(Boolean).join(' + ');
    }
    if (step.type === 'text') return `"${step.text}"`;
    if (step.type === 'delay') return `${step.milliseconds} ms`;
    return '?';
  }

  function emit(steps: KeyboardStepValue[]): void {
    onchange({ steps, repeat, repeatDelayMs });
  }

  function startRecording(index: number): void {
    if (!hostEl) return;
    pendingCombo = null;
    recordingIndex = index;
    startHotkeyCapture(hostEl, {
      key: (event, held) => {
        const modifiers: string[] = [];
        for (const code of held) {
          if (code.includes('Control')) modifiers.push('Ctrl');
          else if (code.includes('Alt')) modifiers.push('Alt');
          else if (code.includes('Shift')) modifiers.push('Shift');
          else if (code.includes('Meta')) modifiers.push('Meta');
        }
        if (event.ctrlKey && !modifiers.includes('Ctrl')) modifiers.push('Ctrl');
        if (event.altKey && !modifiers.includes('Alt')) modifiers.push('Alt');
        if (event.shiftKey && !modifiers.includes('Shift')) modifiers.push('Shift');
        if (event.metaKey && !modifiers.includes('Meta')) modifiers.push('Meta');

        pendingCombo = { type: 'keyCombo', modifiers, key: keyFromEvent(event) };
        stopHotkeyCapture();
        // A second click on the step confirms the captured combo.
      },
      cancel: () => {
        recordingIndex = null;
      },
    });
  }

  function confirmCombo(index: number): void {
    if (pendingCombo === null) return;
    const next = steps.map((step, at) =>
      at === index ? pendingCombo : step,
    ) as KeyboardStepValue[];
    pendingCombo = null;
    recordingIndex = null;
    emit(next);
  }

  function onStepInput(index: number, value: string): void {
    const next = steps.map((step, at) =>
      at === index && step.type === 'text' ? { ...step, text: value } : step,
    );
    emit(next);
  }

  function onStepNumberInput(index: number, raw: string): void {
    const parsed = Number(raw);
    const step = steps[index];
    if (step === undefined || step.type !== 'delay') return;
    const next = steps.map((existing, at) =>
      at === index ? ({ ...existing, milliseconds: Number.isFinite(parsed) ? parsed : 0 } as KeyboardStepValue) : existing,
    );
    emit(next);
  }

  function onRepeatInput(raw: string): void {
    const parsed = Number(raw);
    onchange({
      steps,
      repeat: Number.isFinite(parsed) ? Math.max(1, parsed) : 1,
      repeatDelayMs,
    });
  }

  function onRepeatDelayInput(raw: string): void {
    const parsed = Number(raw);
    onchange({
      steps,
      repeat,
      repeatDelayMs: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
    });
  }

  function moveStep(index: number, direction: -1 | 1): void {
    const at = index + direction;
    if (at < 0 || at >= steps.length) return;
    const next = [...steps];
    [next[index], next[at]] = [next[at], next[index]];
    emit(next);
  }

  function removeStep(index: number): void {
    emit(steps.filter((_, at) => at !== index));
  }

  function addComboStep(): void {
    emit([...steps, { type: 'keyCombo', modifiers: [], key: '' } as KeyComboStepValue]);
  }

  function addTextStep(): void {
    emit([...steps, { type: 'text', text: '' } as KeyboardStepValue]);
  }

  function addDelayStep(): void {
    emit([...steps, { type: 'delay', milliseconds: 100 } as KeyboardStepValue]);
  }

  onDestroy(() => stopHotkeyCapture());
</script>

<span bind:this={hostEl} class="seq-capture-host"></span>

<div class="seq">
  {#each steps as step, index (index)}
    <div class="seq-row">
      <span class="seq-index">{index + 1}</span>

      {#if step.type === 'keyCombo'}
        <span class="seq-value">{stepDisplay(step)}</span>
      {:else if step.type === 'text'}
        <input
          class="seq-input"
          type="text"
          placeholder="text"
          value={step.text}
          oninput={event => onStepInput(index, (event.currentTarget as HTMLInputElement).value)}
        />
      {:else if step.type === 'delay'}
        <input
          class="seq-input"
          type="number"
          min="0"
          placeholder="ms"
          value={step.milliseconds}
          oninput={event => onStepNumberInput(index, (event.currentTarget as HTMLInputElement).value)}
        />
      {:else}
        <span class="seq-value">{stepDisplay(step)}</span>
      {/if}

      <button type="button" class="seq-btn" title="Move up" onclick={() => moveStep(index, -1)}>↑</button>
      <button type="button" class="seq-btn" title="Move down" onclick={() => moveStep(index, 1)}>↓</button>
      <button type="button" class="seq-btn seq-remove" title="Remove" onclick={() => removeStep(index)}>×</button>
    </div>

    {#if recordingIndex === index}
      {#if pendingCombo}
        <div class="seq-confirm">
          <span class="seq-value">{stepDisplay(pendingCombo)}</span>
          <button type="button" class="seq-btn seq-confirm-btn" onclick={() => confirmCombo(index)}>Use</button>
          <button type="button" class="seq-btn seq-remove" onclick={() => { pendingCombo = null; recordingIndex = null; }}>×</button>
        </div>
      {:else}
        <div class="seq-hint">Press the key combination…</div>
      {/if}
    {:else if step.type === 'keyCombo' && step.key === ''}
      <button type="button" class="event-link seq-record" onclick={() => startRecording(index)}>Record keys</button>
    {/if}
  {/each}

  <div class="seq-additions">
    <button type="button" class="seq-add" onclick={addComboStep}>+ Keys</button>
    <button type="button" class="seq-add" onclick={addTextStep}>+ Text</button>
    <button type="button" class="seq-add" onclick={addDelayStep}>+ Delay</button>
  </div>

  <div class="seq-repeat">
    <label class="seq-label">Repeat</label>
    <input
      class="seq-input"
      type="number"
      min="1"
      value={repeat}
      oninput={event => onRepeatInput((event.currentTarget as HTMLInputElement).value)}
    />
    <label class="seq-label">Delay ms</label>
    <input
      class="seq-input"
      type="number"
      min="0"
      value={repeatDelayMs}
      oninput={event => onRepeatDelayInput((event.currentTarget as HTMLInputElement).value)}
    />
  </div>
</div>

<style>
  .seq {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .seq-row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .seq-index {
    width: 1.25rem;
    text-align: right;
    color: var(--color-text-muted);
    font-size: var(--text-xs, 0.75rem);
    flex: none;
  }

  .seq-value {
    flex: 1;
    font-family: var(--font-mono);
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-primary);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .seq-input {
    width: 100%;
    padding: 0.3rem var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm, 0.875rem);
  }

  .seq-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: var(--text-sm, 0.875rem);
    padding: 0 0.25rem;
  }

  .seq-btn:hover {
    color: var(--color-text-primary);
  }

  .seq-remove:hover {
    color: var(--color-danger, #bf616a);
  }

  .seq-confirm {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    padding: 0.25rem var(--space-2, 0.5rem);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-md, 6px);
  }

  .seq-confirm-btn {
    color: var(--color-accent);
  }

  .seq-hint,
  .event-link.seq-record {
    color: var(--color-text-muted);
    font-size: var(--text-xs, 0.75rem);
  }

  .event-link.seq-record {
    background: none;
    border: none;
    color: var(--color-accent);
    cursor: pointer;
    align-self: flex-start;
  }

  .seq-additions,
  .seq-repeat {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .seq-add {
    background: none;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md, 6px);
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: var(--text-xs, 0.75rem);
    padding: 0.25rem var(--space-2, 0.5rem);
  }

  .seq-add:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .seq-label {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary);
  }

  .seq-repeat .seq-input {
    width: 5rem;
  }
</style>
