<script lang="ts">
  /*
   * The announcement dialog.
   *
   * The body is plain text for now. The Angular original rendered it as Markdown; that renderer is
   * a separate port, and shipping a half-working one would be worse than showing the text as
   * written until it lands.
   */
  import Button from './Button.svelte';
  import Modal from './Modal.svelte';
  import { translateKey } from '$lib/localization.svelte';

  interface Props {
    title: string;
    content: string;
    publishedAt?: string | null;
    ondismiss?: () => void;
  }

  let { title, content, publishedAt = null, ondismiss }: Props = $props();

  const publishedOn = $derived.by(() => {
    if (!publishedAt) return null;
    const date = new Date(publishedAt);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
  });
</script>

<Modal heading={title} size="large" onclose={() => ondismiss?.()}>
  <div class="whats-new-modal">
    {#if publishedOn}
      <p class="whats-new-modal__meta">
        {translateKey('macrodeck.app:Announcements.PublishedOn', { date: publishedOn })}
      </p>
    {/if}
    <div class="whats-new-modal__changelog">{content}</div>
  </div>

  {#snippet footer()}
    <div class="whats-new-modal__actions">
      <Button variant="primary" onclick={() => ondismiss?.()}>
        {translateKey('macrodeck.app:Dialogs.Notice.GotIt')}
      </Button>
    </div>
  {/snippet}
</Modal>

<style>
  .whats-new-modal {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    height: 100%;
  }

  .whats-new-modal__meta {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  .whats-new-modal__changelog {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    gap: var(--space-3);
    min-height: 0;
    overflow-y: auto;
    padding-inline-end: var(--space-2);
    white-space: pre-wrap;
  }

  .whats-new-modal__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
