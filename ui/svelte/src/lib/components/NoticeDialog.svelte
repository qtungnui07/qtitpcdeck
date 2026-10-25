<script lang="ts">
  /*
   * A one-button dialog that can offer to stop appearing.
   *
   * The "don't show again" checkbox is reported back through the close callback rather than stored
   * here: only the caller knows where the preference belongs, and a dialog that persisted it itself
   * would have to know which of a dozen settings keys it was for.
   */
  import Button from './Button.svelte';
  import Checkbox from './Checkbox.svelte';
  import Modal from './Modal.svelte';
  import { translateKey } from '$lib/localization.svelte';

  interface Props {
    heading?: string;
    message?: string;
    confirmText?: string;
    showDontShowAgain?: boolean;
    dontShowAgainLabel?: string;
    onclosed?: (dontShowAgain: boolean) => void;
  }

  let {
    heading,
    message = '',
    confirmText,
    showDontShowAgain = true,
    dontShowAgainLabel,
    onclosed,
  }: Props = $props();

  let dontShowAgain = $state(false);

  const resolvedHeading = $derived(heading ?? translateKey('macrodeck.app:Dialogs.Notice.DefaultHeading'));
  const resolvedConfirm = $derived(confirmText ?? translateKey('macrodeck.app:Dialogs.Notice.GotIt'));
  const resolvedLabel = $derived(
    dontShowAgainLabel ?? translateKey('macrodeck.app:Dialogs.Notice.DontShowAgain'),
  );
</script>

<Modal heading={resolvedHeading} showFooter onclose={() => onclosed?.(dontShowAgain)}>
  <p class="notice-message">{message}</p>

  {#snippet footer()}
    <div class="notice-footer">
      {#if showDontShowAgain}
        <Checkbox
          label={resolvedLabel}
          checked={dontShowAgain}
          onchange={value => (dontShowAgain = value)}
        />
      {/if}
      <Button variant="primary" onclick={() => onclosed?.(dontShowAgain)}>{resolvedConfirm}</Button>
    </div>
  {/snippet}
</Modal>

<style>
  .notice-message {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    line-height: 1.5;
  }

  /* Checkbox left, action right - and stacked on narrow viewports so neither is squeezed. */
  .notice-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    width: 100%;
  }
</style>
