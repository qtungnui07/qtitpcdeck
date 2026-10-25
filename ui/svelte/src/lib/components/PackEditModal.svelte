<script lang="ts">
  /*
   * Dialog for creating a new custom icon pack or editing metadata on an existing one.
   *
   * Built-in and read-only packs can never be opened in this dialog because their
   * definitions are supplied by the system or a plugin and cannot be mutated.
   */

  import type { IconPackAiAssets, IpcIconPack } from '@macro-deck/runtime';
  import { AppStrings } from '@macro-deck/runtime';
  import Button from '$lib/components/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { translateKey } from '$lib/localization.svelte';

  export interface PackEditData {
    name: string;
    description?: string;
    author?: string;
    version?: string;
    aiAssets: IconPackAiAssets;
  }

  interface Props {
    mode: 'create' | 'edit';
    pack?: IpcIconPack | null;
    onsave: (result: PackEditData) => void;
    oncancel: () => void;
  }

  let { mode, pack, onsave, oncancel }: Props = $props();

  let name = $state('');
  let description = $state('');
  let author = $state('');
  let version = $state('');
  let aiAssets = $state<IconPackAiAssets>('NotDeclared');

  $effect(() => {
    name = pack?.name ?? '';
    description = pack?.description ?? '';
    author = pack?.author ?? '';
    version = pack?.version ?? '';
    aiAssets = pack?.aiAssets ?? 'NotDeclared';
  });

  const title = $derived(
    translateKey(
      mode === 'create'
        ? AppStrings.IconPacks.NewPackHeading
        : AppStrings.IconPacks.EditPackHeading,
    ),
  );

  const saveLabel = $derived(
    translateKey(
      mode === 'create'
        ? AppStrings.IconPacks.CreatePackAction
        : AppStrings.IconPacks.SaveChangesAction,
    ),
  );

  function submit(e?: Event): void {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    onsave({
      name: trimmed,
      description: description.trim() || undefined,
      author: author.trim() || undefined,
      version: version.trim() || undefined,
      aiAssets,
    });
  }
</script>

<Modal
  heading={title}
  maxWidth="460px"
  showFooter={false}
  onclose={oncancel}
>
  <form class="pack-form" onsubmit={submit}>
    <label class="field">
      <span class="label">
        {translateKey(AppStrings.IconPacks.NameFieldLabel)}
        <span class="required" aria-hidden="true">*</span>
      </span>
      <input
        class="input"
        type="text"
        placeholder={translateKey(AppStrings.IconPacks.NameFieldPlaceholder)}
        bind:value={name}
        required
      />
    </label>

    <label class="field">
      <span class="label">{translateKey(AppStrings.IconPacks.DescriptionFieldLabel)}</span>
      <input
        class="input"
        type="text"
        placeholder={translateKey(AppStrings.IconPacks.DescriptionFieldPlaceholder)}
        bind:value={description}
      />
    </label>

    <div class="field-row">
      <label class="field">
        <span class="label">{translateKey(AppStrings.IconPacks.AuthorFieldLabel)}</span>
        <input
          class="input"
          type="text"
          placeholder={translateKey(AppStrings.IconPacks.AuthorFieldPlaceholder)}
          bind:value={author}
        />
      </label>

      <label class="field">
        <span class="label">{translateKey(AppStrings.IconPacks.VersionFieldLabel)}</span>
        <input
          class="input"
          type="text"
          placeholder="1.0.0"
          bind:value={version}
        />
      </label>
    </div>

    <label class="field">
      <span class="label">{translateKey(AppStrings.IconPacks.AiFieldLabel)}</span>
      <select class="select" bind:value={aiAssets}>
        <option value="NotDeclared">{translateKey(AppStrings.IconPacks.AiNotDeclared)}</option>
        <option value="None">{translateKey(AppStrings.IconPacks.AiNone)}</option>
        <option value="Generated">{translateKey(AppStrings.IconPacks.AiGenerated)}</option>
      </select>
      <span class="hint">{translateKey(AppStrings.IconPacks.AiFieldHint)}</span>
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
  .pack-form {
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

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .input,
  .select {
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

  .input:focus-visible,
  .select:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .hint {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
</style>
