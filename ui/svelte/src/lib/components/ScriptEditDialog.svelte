<script lang="ts">
  /*
   * Dialog for creating a new script or renaming an existing one.
   *
   * Scripts require a non-empty name. Description is optional.
   */

  import type { Script } from '@macro-deck/runtime';
  import { AppStrings } from '@macro-deck/runtime';
  import Button from '$lib/components/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { translateKey } from '$lib/localization.svelte';

  export interface ScriptEditResult {
    name: string;
    description: string;
  }

  interface Props {
    mode: 'create' | 'edit';
    script?: Script | null;
    onsave: (result: ScriptEditResult) => void;
    oncancel: () => void;
  }

  let { mode, script = null, onsave, oncancel }: Props = $props();

  let name = $state('');
  let description = $state('');

  $effect(() => {
    name = script?.name ?? '';
    description = script?.description ?? '';
  });

  const title = $derived(
    translateKey(
      mode === 'create'
        ? AppStrings.Scripts.NewScriptHeading
        : AppStrings.Scripts.RenameScriptHeading,
    ),
  );

  const saveLabel = $derived(
    translateKey(
      mode === 'create'
        ? AppStrings.Scripts.CreateScriptAction
        : AppStrings.Scripts.SaveChangesAction,
    ),
  );

  function submit(e?: Event): void {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    onsave({
      name: trimmed,
      description: description.trim(),
    });
  }
</script>

<Modal
  heading={title}
  maxWidth="420px"
  showFooter={false}
  onclose={oncancel}
>
  <form class="script-form" onsubmit={submit}>
    <label class="field">
      <span class="label">
        {translateKey(AppStrings.Scripts.NameFieldLabel)}
        <span class="required" aria-hidden="true">*</span>
      </span>
      <input
        class="input"
        type="text"
        placeholder={translateKey(AppStrings.Scripts.NameFieldPlaceholder)}
        bind:value={name}
        required
      />
    </label>

    <label class="field">
      <span class="label">{translateKey(AppStrings.Scripts.DescriptionFieldLabel)}</span>
      <input
        class="input"
        type="text"
        placeholder={translateKey(AppStrings.Scripts.DescriptionFieldPlaceholder)}
        bind:value={description}
      />
    </label>

    <div class="actions">
      <Button variant="secondary" onclick={oncancel}>
        {translateKey('macrodeck:Common.Cancel')}
      </Button>
      <Button variant="primary" type="submit" disabled={!name.trim()}>
        {saveLabel}
      </Button>
    </div>
  </form>
</Modal>

<style>
  .script-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
  }

  .required {
    color: var(--color-danger);
    margin-left: 2px;
  }

  .input {
    min-height: var(--control-height);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font: inherit;
    font-size: var(--text-sm);
    box-sizing: border-box;
    width: 100%;
  }

  .input:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
</style>
