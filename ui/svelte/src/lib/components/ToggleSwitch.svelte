<script lang="ts">
  /*
   * A two-state toggle switch.
   *
   * The underlying input is an invisible native checkbox that covers the entire
   * track so assistive technology recognizes it and pointer hits forward natively.
   */

  interface Props {
    checked?: boolean;
    disabled?: boolean;
    busy?: boolean;
    label?: string;
    ariaLabel?: string;
    onchange?: (checked: boolean) => void;
  }

  let {
    checked = false,
    disabled = false,
    busy = false,
    label = '',
    ariaLabel = '',
    onchange,
  }: Props = $props();

  function onInput(event: Event): void {
    if (disabled || busy) {
      event.preventDefault();
      return;
    }
    const target = event.currentTarget as HTMLInputElement;
    onchange?.(target.checked);
  }
</script>

<label
  class="ts"
  class:ts-checked={checked}
  class:ts-disabled={disabled}
  class:ts-busy={busy}
>
  <input
    type="checkbox"
    class="ts-input"
    {checked}
    {disabled}
    aria-busy={busy || undefined}
    aria-label={ariaLabel || undefined}
    onchange={onInput}
  />
  <span class="ts-track">
    <span class="ts-thumb">
      {#if busy}
        <span class="ts-spinner" aria-hidden="true"></span>
      {/if}
    </span>
  </span>
  {#if label}
    <span class="ts-label">{label}</span>
  {/if}
</label>

<style>
  .ts {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .ts-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ts-busy {
    cursor: progress;
  }

  .ts-input {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 1;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: inherit;
  }

  .ts-track {
    position: relative;
    box-sizing: border-box;
    width: 2rem;
    height: 1.125rem;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    transition: background-color var(--transition-fast), border-color var(--transition-fast);
    flex-shrink: 0;
  }

  .ts-checked .ts-track {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }

  .ts-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: calc(1.125rem - 6px);
    height: calc(1.125rem - 6px);
    background: #fff;
    border-radius: 50%;
    transition: transform var(--transition-fast);
  }

  .ts-checked .ts-thumb {
    transform: translateX(calc(2rem - 1.125rem));
  }

  .ts-spinner {
    position: absolute;
    inset: 1px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: ts-spin 0.7s linear infinite;
  }

  @keyframes ts-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .ts-label {
    font-size: var(--text-md);
    color: var(--color-text-primary);
  }
</style>
