<script lang="ts">
  /*
   * The hotkey recorder, ported from the Angular HotkeyRecorderComponent.
   * The key press is captured on the document (hotkey-capture) rather than on
   * the button, which WebKit does not focus on click; Escape cancels, a click
   * elsewhere cancels, and bare modifiers are held, not recorded.
   */
  import { onDestroy } from 'svelte';
  import { type HotkeyValue, keyFromEvent } from '@macro-deck/runtime';
  import { startHotkeyCapture, stopHotkeyCapture } from '$lib/hotkey-capture';

  interface Props {
    value: HotkeyValue | null;
    onchange: (value: HotkeyValue | null) => void;
  }

  let { value, onchange }: Props = $props();

  let recording = $state(false);
  let hostEl = $state<HTMLElement | null>(null);

  const display = $derived(
    value ? [...value.modifiers, value.key].filter(Boolean).join(' + ') : '',
  );

  function startRecording(): void {
    if (recording || !hostEl) return;
    recording = true;
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

        const next: HotkeyValue = {
          modifiers,
          key: keyFromEvent(event),
          code: event.code,
        };
        value = next;
        onchange(next);
        stopRecording();
      },
      cancel: () => {
        recording = false;
      },
    });
  }

  function stopRecording(): void {
    recording = false;
    stopHotkeyCapture();
  }

  function clear(): void {
    value = null;
    onchange(null);
  }

  onDestroy(() => stopHotkeyCapture());
</script>

<span bind:this={hostEl} class="hotkey-root"></span>
<div class="hotkey-group">
  <button
    type="button"
    class="hotkey-field"
    class:recording
    onclick={startRecording}
  >
    {#if recording}
      <span class="hotkey-hint-highlight">…</span>
    {:else if value}
      <span class="hotkey-value">{display}</span>
    {:else}
      <span class="hotkey-hint">Press a key combination</span>
    {/if}
  </button>
  {#if value && !recording}
    <button
      type="button"
      class="hotkey-clear"
      aria-label="Clear hotkey"
      onclick={clear}
    >×</button>
  {/if}
</div>

<style>
  .hotkey-group {
    display: inline-flex;
    align-items: stretch;
    gap: 0.25rem;
  }

  .hotkey-field {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 9rem;
    padding: 0.375rem var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm, 0.875rem);
    cursor: pointer;
  }

  .hotkey-field.recording {
    border-color: var(--color-accent);
  }

  .hotkey-value {
    font-family: var(--font-mono);
  }

  .hotkey-hint,
  .hotkey-hint-highlight {
    color: var(--color-text-muted);
  }

  .hotkey-hint-highlight {
    animation: hotkey-pulse 0.9s ease-in-out infinite alternate;
  }

  @keyframes hotkey-pulse {
    from { opacity: 0.4; }
    to { opacity: 1; }
  }

  .hotkey-clear {
    background: none;
    border: none;
    color: var(--color-danger, #bf616a);
    cursor: pointer;
    font-size: var(--text-base, 1rem);
    padding: 0 0.25rem;
  }
</style>
