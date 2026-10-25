<script lang="ts">
  /*
   * A yes/no dialog, with an optional third answer.
   *
   * The third answer exists because some decisions are not binary - "save, discard, cancel" - and
   * forcing them into two buttons makes the user guess which one means what. It widens the dialog
   * because three translated labels wrap at the default width and the decision then reads as two
   * unrelated rows.
   */
  import type { Snippet } from 'svelte';
  import Button from './Button.svelte';
  import Modal from './Modal.svelte';
  import { translateKey } from '$lib/localization.svelte';

  interface Props {
    heading?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    altText?: string;
    danger?: boolean;
    onconfirm?: () => void;
    oncancel?: () => void;
    onalt?: () => void;
    children?: Snippet;
  }

  let {
    heading,
    message,
    confirmText,
    cancelText,
    altText = '',
    danger = false,
    onconfirm,
    oncancel,
    onalt,
    children,
  }: Props = $props();

  const resolvedHeading = $derived(heading ?? translateKey('macrodeck.app:Dialogs.Confirm.DefaultHeading'));
  const resolvedMessage = $derived(message ?? translateKey('macrodeck.app:Dialogs.Confirm.DefaultMessage'));
  const resolvedConfirm = $derived(confirmText ?? translateKey('macrodeck:Common.Confirm'));
  const resolvedCancel = $derived(cancelText ?? translateKey('macrodeck:Common.Cancel'));
</script>

<Modal
  heading={resolvedHeading}
  showFooter
  maxWidth={altText ? 'min(92vw, 46rem)' : '450px'}
  onclose={() => oncancel?.()}
>
  <p class="confirmation-message">{resolvedMessage}</p>
  {@render children?.()}

  {#snippet footer()}
    <Button variant="secondary" onclick={() => oncancel?.()}>{resolvedCancel}</Button>
    <Button variant={danger ? 'danger' : 'primary'} onclick={() => onconfirm?.()}>{resolvedConfirm}</Button>
    {#if altText}
      <Button variant="primary" onclick={() => onalt?.()}>{altText}</Button>
    {/if}
  {/snippet}
</Modal>

<style>
  /* Body copy, not a heading - the modal title above it already carries --text-lg. */
  .confirmation-message {
    margin: 0;
    font-size: var(--text-base);
    color: var(--color-text-secondary);
    line-height: 1.6;
  }
</style>
