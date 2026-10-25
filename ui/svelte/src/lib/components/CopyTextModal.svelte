<script lang="ts">
  import { onMount } from 'svelte';
  import { AppStrings, Strings } from '@macro-deck/runtime';
  import Button from '$lib/components/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { translateKey } from '$lib/localization.svelte';
  import { selectAllText } from '$lib/text-clipboard';

  interface Props {
    heading?: string;
    message?: string;
    value?: string;
    confirmText?: string;
    zIndex?: number | null;
    onclose: () => void;
  }

  let {
    heading,
    message = '',
    value = '',
    confirmText,
    zIndex = null,
    onclose,
  }: Props = $props();

  let fieldEl = $state<HTMLInputElement | null>(null);

  const resolvedHeading = $derived(
    heading ?? translateKey(AppStrings.Dialogs.CopyText.DefaultHeading),
  );
  const resolvedConfirm = $derived(
    confirmText ?? translateKey(Strings.Common.Done),
  );
  const textToCopyLabel = $derived(
    translateKey(AppStrings.Dialogs.CopyText.FieldAriaLabel),
  );

  function select(): void {
    if (fieldEl) {
      selectAllText(fieldEl);
    }
  }

  onMount(() => {
    select();
  });
</script>

<Modal
  heading={resolvedHeading}
  showFooter
  {zIndex}
  {onclose}
>
  {#if message}
    <p class="copy-text-message">{message}</p>
  {/if}
  <input
    bind:this={fieldEl}
    class="copy-text-field"
    type="text"
    readonly
    aria-label={textToCopyLabel}
    {value}
    onfocus={select}
    onclick={select}
  />

  {#snippet footer()}
    <Button variant="primary" onclick={onclose}>{resolvedConfirm}</Button>
  {/snippet}
</Modal>

<style>
  .copy-text-message {
    margin: 0 0 var(--space-3);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    line-height: 1.5;
  }

  .copy-text-field {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    user-select: all;
    cursor: text;
    box-sizing: border-box;
  }

  .copy-text-field:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -1px;
  }
</style>
