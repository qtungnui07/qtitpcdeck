<script lang="ts">
  /*
   * User Fonts library page.
   *
   * Displays installed TrueType/OpenType user fonts, grouped by family, with style
   * name and sample rendering. Users can import new fonts via file picker or drag-and-drop,
   * or remove existing fonts with confirmation.
   */

  import { onMount } from 'svelte';
  import {
    AppStrings,
    type UserFont,
    type UserFontImportStatus,
  } from '@macro-deck/runtime';
  import Button from '$lib/components/Button.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { translateKey } from '$lib/localization.svelte';
  import { showToast } from '$lib/toasts.svelte';
  import {
    ensureFontFace,
    importUserFonts,
    loadUserFonts,
    removeUserFont,
    sampleFontFamily,
    userFontStore,
  } from '$lib/user-fonts.svelte';

  const STATUS_KEY: Record<Exclude<UserFontImportStatus, 'Imported'>, string> = {
    AlreadyPresent: AppStrings.Library.Fonts.Status.AlreadyPresent,
    UnsupportedFormat: AppStrings.Library.Fonts.Status.UnsupportedFormat,
    TooLarge: AppStrings.Library.Fonts.Status.TooLarge,
    InvalidFont: AppStrings.Library.Fonts.Status.InvalidFont,
    AlreadyInstalled: AppStrings.Library.Fonts.Status.AlreadyInstalled,
    AlreadyImported: AppStrings.Library.Fonts.Status.AlreadyImported,
  };

  let fileInput = $state<HTMLInputElement | null>(null);
  let isImporting = $state(false);
  let isDragOver = $state(false);
  let fontPendingRemoval = $state<UserFont | null>(null);

  onMount(() => {
    void loadUserFonts();
  });

  $effect(() => {
    for (const font of userFontStore.fonts) {
      if (font.faceId) {
        ensureFontFace(font.faceId);
      }
    }
  });

  function faceName(font: UserFont): string {
    return `${font.family} ${font.styleName}`;
  }

  function removeLabel(font: UserFont): string {
    return translateKey(AppStrings.Library.Fonts.RemoveAriaLabel, { name: faceName(font) });
  }

  function removeMessage(font: UserFont): string {
    return translateKey(AppStrings.Library.Fonts.RemoveConfirmMessage, { name: faceName(font) });
  }

  function pickFiles(): void {
    fileInput?.click();
  }

  async function onFilesPicked(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files ?? []);
    target.value = '';
    await importFiles(files);
  }

  function onDragOver(event: DragEvent): void {
    event.preventDefault();
    isDragOver = true;
  }

  function onDragLeave(event: DragEvent): void {
    event.preventDefault();
    isDragOver = false;
  }

  async function onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    isDragOver = false;
    const files = Array.from(event.dataTransfer?.files ?? []);
    await importFiles(files);
  }

  async function importFiles(files: File[]): Promise<void> {
    if (files.length === 0 || isImporting) return;
    isImporting = true;
    try {
      const outcome = await importUserFonts(files);
      if (!outcome.success) {
        showToast(translateKey(AppStrings.Library.Fonts.ImportFailed), { variant: 'error' });
        return;
      }

      const importedCount = outcome.results.filter(r => r.status === 'Imported').length;
      if (importedCount > 0) {
        showToast(translateKey(AppStrings.Library.Fonts.Imported, { count: importedCount }));
      }
      for (const result of outcome.results) {
        if (result.status === 'Imported') continue;
        const key = STATUS_KEY[result.status as Exclude<UserFontImportStatus, 'Imported'>];
        if (key) {
          showToast(translateKey(key, { fileName: result.fileName }), {
            variant: result.status === 'AlreadyPresent' ? 'success' : 'error',
          });
        }
      }
    } finally {
      isImporting = false;
    }
  }

  async function confirmRemove(): Promise<void> {
    const font = fontPendingRemoval;
    fontPendingRemoval = null;
    if (!font) return;

    const ok = await removeUserFont(font.fontId);
    if (!ok) {
      showToast(translateKey(AppStrings.Library.Fonts.RemoveFailed), { variant: 'error' });
    }
  }
</script>

<div
  class="fonts-page"
  class:file-drag-over={isDragOver}
  role="region"
  aria-label={translateKey(AppStrings.Nav.Fonts)}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
>
  <header class="fonts-header">
    <div>
      <h1 class="fonts-title">{translateKey(AppStrings.Nav.Fonts)}</h1>
      <p class="fonts-subtitle">{translateKey(AppStrings.Library.Page.FontsDescription)}</p>
    </div>
    <Button variant="primary" disabled={isImporting} onclick={pickFiles}>
      <span class="icon icon-plus icon-sm" aria-hidden="true"></span>
      {translateKey(AppStrings.Library.Fonts.ImportAction)}
    </Button>
  </header>

  <p class="fonts-license">
    <span class="icon icon-info icon-sm" aria-hidden="true"></span>
    <span>{translateKey(AppStrings.Library.Fonts.LicenseNote)}</span>
  </p>

  {#if userFontStore.groups.length === 0}
    {#if !userFontStore.isLoading}
      <EmptyState
        icon="type"
        heading={translateKey(AppStrings.Library.Fonts.EmptyTitle)}
        message={translateKey(AppStrings.Library.Fonts.EmptyDescription)}
      />
    {/if}
  {:else}
    <div class="font-families">
      {#each userFontStore.groups as group (group.family)}
        <section class="font-family">
          <h2 class="font-family-name">{group.family}</h2>
          <ul class="font-faces">
            {#each group.faces as font (font.fontId)}
              <li class="font-face">
                <div class="font-face-meta">
                  <span class="font-face-style">{font.styleName}</span>
                  <span class="tag">{font.format.toUpperCase()}</span>
                </div>
                {#if font.faceId}
                  <span
                    class="font-face-sample"
                    style:font-family={sampleFontFamily(font)}
                  >
                    {translateKey(AppStrings.Library.Fonts.Sample)}
                  </span>
                {:else}
                  <span class="font-face-sample"></span>
                {/if}
                <Button
                  variant="danger-ghost"
                  size="icon"
                  title={removeLabel(font)}
                  ariaLabel={removeLabel(font)}
                  onclick={() => (fontPendingRemoval = font)}
                >
                  <span class="icon icon-trash icon-sm" aria-hidden="true"></span>
                </Button>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {/if}

  <div class="drop-hint" aria-hidden="true">
    <span class="icon icon-download icon-2xl"></span>
    <span>{translateKey(AppStrings.Library.Fonts.ImportAction)}</span>
  </div>
</div>

<input
  bind:this={fileInput}
  type="file"
  hidden
  multiple
  accept=".ttf,.otf"
  onchange={onFilesPicked}
/>

{#if fontPendingRemoval}
  <ConfirmDialog
    heading={translateKey(AppStrings.Library.Fonts.RemoveConfirmHeading)}
    message={removeMessage(fontPendingRemoval)}
    confirmText={translateKey(AppStrings.Library.Fonts.RemoveConfirmAction)}
    danger={true}
    onconfirm={confirmRemove}
    oncancel={() => (fontPendingRemoval = null)}
  />
{/if}

<style>
  .fonts-page {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
  }

  .fonts-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-shrink: 0;
  }

  .fonts-title {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--font-bold);
    color: var(--color-text-primary);
  }

  .fonts-subtitle {
    margin: var(--space-1) 0 0;
    font-size: var(--text-md);
    color: var(--color-text-muted);
  }

  .fonts-license {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    margin: 0;
    max-width: 48rem;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .font-families {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .font-family {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background-color: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .font-family-name {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .font-faces {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .font-face {
    display: grid;
    grid-template-columns: minmax(8rem, 12rem) 1fr auto;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-top: 1px solid var(--color-border);
  }

  .font-face:first-child {
    border-top: none;
  }

  .font-face-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .font-face-style {
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .font-face-sample {
    font-size: var(--text-xl);
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    padding: 1px var(--space-1);
    border-radius: var(--radius-sm);
    background: var(--color-bg-tertiary);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .drop-hint {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    border: 2px dashed var(--color-accent);
    border-radius: var(--radius-lg);
    background: var(--color-accent-muted, rgba(136, 192, 208, 0.15));
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    pointer-events: none;
  }

  .fonts-page.file-drag-over .drop-hint {
    display: flex;
  }
</style>
