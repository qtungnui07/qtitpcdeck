<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label?: string;
    checked?: boolean;
    disabled?: boolean;
    onchange?: (checked: boolean) => void;
    children?: Snippet;
  }

  let { label = '', checked = false, disabled = false, onchange, children }: Props = $props();

  function onToggle(event: Event): void {
    onchange?.((event.currentTarget as HTMLInputElement).checked);
  }
</script>

<label class="cb-wrap">
  <input class="cb-box" type="checkbox" {checked} {disabled} onchange={onToggle} />
  {#if label}
    <span class="cb-label">{label}</span>
  {:else}
    {@render children?.()}
  {/if}
</label>

<style>
  .cb-wrap {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    cursor: default;
    min-width: 0;
  }

  .cb-box {
    width: 0.8125rem;
    height: 0.8125rem;
    flex-shrink: 0;
    accent-color: var(--color-accent);
  }

  .cb-box:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .cb-label {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    min-width: 0;
  }
</style>
