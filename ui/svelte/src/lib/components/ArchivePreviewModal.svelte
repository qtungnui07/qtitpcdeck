<script lang="ts">
  /*
   * The archive preview a dropped widget archive opens before anything is
   * imported, ported from the Angular archive-preview-modal: the host's summary
   * (kind, counts, encryption), a password field when the archive is sealed,
   * and the confirm/cancel pair. Errors stay on the modal so a wrong password
   * is retried in place.
   */
  import { translateKey } from '$lib/localization.svelte';
  import Modal from './Modal.svelte';
  import Button from './Button.svelte';
  import {
    archiveImport,
    cancelArchiveImport,
    confirmArchiveImport,
    dismissArchiveError,
    submitArchivePassword,
  } from '$lib/archive-import.svelte';

  interface Props {
    folderId: string;
    x: number;
    y: number;
    onimported: (count: number) => void;
  }

  let { folderId, x, y, onimported }: Props = $props();

  let password = $state('');
  let busy = $state(false);

  async function onConfirm(): Promise<void> {
    if (archiveImport.summary === null || busy) return;
    busy = true;
    const widgets = await confirmArchiveImport(folderId, x, y);
    busy = false;
    if (widgets !== null) {
      onimported(widgets.length);
    }
  }

  async function onSubmitPassword(): Promise<void> {
    if (archiveImport.summary === null || busy) return;
    busy = true;
    const widgets = await submitArchivePassword(folderId, x, y, password);
    busy = false;
    if (widgets !== null) {
      onimported(widgets.length);
    }
  }
</script>

{#if archiveImport.summary !== null}
  {@const summary = archiveImport.summary}
  <Modal
    heading={summary.name || translateKey('macrodeck:Common.Import')}
    size="small"
    onclose={cancelArchiveImport}
  >
    <div class="archive-preview">
      {#if archiveImport.error}
        <div class="preview-error" role="alert">
          <span>{archiveImport.error}</span>
          <button type="button" class="error-dismiss" onclick={dismissArchiveError}>×</button>
        </div>
      {/if}

      <dl class="preview-facts">
        <div><dt>Kind</dt><dd>{summary.kind}</dd></div>
        <div><dt>From version</dt><dd>{summary.appVersion || '—'}</dd></div>
        <div><dt>Widgets</dt><dd>{summary.widgetCount}</dd></div>
        <div><dt>Icons</dt><dd>{summary.iconCount}</dd></div>
        {#if summary.includesSecrets}
          <div><dt>Contains secrets</dt><dd>Yes</dd></div>
        {/if}
      </dl>

      {#if archiveImport.passwordVisible || summary.encrypted}
        <label class="preview-field">
          <span class="preview-label">Archive password</span>
          <input
            class="preview-input"
            class:is-invalid={archiveImport.passwordInvalid}
            type="password"
            bind:value={password}
            onkeydown={event => {
              if (event.key === 'Enter') void onSubmitPassword();
            }}
          />
          {#if archiveImport.passwordInvalid}
            <span class="preview-hint">The password is not correct.</span>
          {/if}
        </label>
      {/if}

      <div class="preview-actions">
        <Button variant="secondary" onclick={cancelArchiveImport}>{translateKey('macrodeck:Common.Cancel')}</Button>
        {#if archiveImport.passwordVisible || summary.encrypted}
          <Button variant="primary" disabled={password === '' || busy} onclick={() => void onSubmitPassword()}>
            {translateKey('macrodeck:Common.Import')}
          </Button>
        {:else}
          <Button variant="primary" disabled={busy} onclick={() => void onConfirm()}>
            {translateKey('macrodeck:Common.Import')}
          </Button>
        {/if}
      </div>
    </div>
  </Modal>
{/if}

<style>
  .archive-preview {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }

  .preview-error {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border-radius: var(--radius-md, 6px);
    background: var(--color-danger-muted, rgba(191, 97, 106, 0.15));
    color: var(--color-danger, #bf616a);
    font-size: var(--text-sm, 0.875rem);
  }

  .error-dismiss {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0;
  }

  .preview-facts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2, 0.5rem) var(--space-4, 1rem);
    margin: 0;
  }

  .preview-facts div {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .preview-facts dt {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .preview-facts dd {
    margin: 0;
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-primary);
  }

  .preview-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .preview-label {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary);
  }

  .preview-input {
    padding: 0.5rem var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm, 0.875rem);
  }

  .preview-input.is-invalid {
    border-color: var(--color-danger, #bf616a);
  }

  .preview-hint {
    color: var(--color-danger, #bf616a);
    font-size: var(--text-xs, 0.75rem);
  }

  .preview-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2, 0.5rem);
  }
</style>
