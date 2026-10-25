<script lang="ts">
  /*
   * Folder hierarchy navigation rail docked to the side of the deck.
   *
   * Displays the tree of folders under the active profile, allows navigating between folders,
   * collapsing/expanding subfolders, creating new folders, and renaming or deleting folders.
   */
  import { AppStrings, Strings } from '@macro-deck/runtime';
  import {
    canDeleteFolder,
    createFolder,
    deleteFolder,
    folderStore,
    getChildFolders,
    renameFolder,
    selectFolder,
    toggleFolderExpanded,
  } from '$lib/folders.svelte';
  import { profileStore } from '$lib/profiles.svelte';
  import { translateKey } from '$lib/localization.svelte';
  import Button from './Button.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import Modal from './Modal.svelte';

  let isCreatingFolder = $state(false);
  let newFolderName = $state('');
  let createParentId = $state<string | null>(null);

  let folderToRename = $state<{ id: string; name: string } | null>(null);
  let renameValue = $state('');

  let folderToDelete = $state<{ id: string; name: string } | null>(null);

  function startCreate(parentId: string | null = null): void {
    createParentId = parentId;
    newFolderName = '';
    isCreatingFolder = true;
  }

  async function handleConfirmCreate(): Promise<void> {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    await createFolder(trimmed, createParentId);
    isCreatingFolder = false;
    newFolderName = '';
  }

  function startRename(folder: { id: string; name: string }): void {
    folderToRename = folder;
    renameValue = folder.name;
  }

  async function handleConfirmRename(): Promise<void> {
    if (!folderToRename) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    await renameFolder(folderToRename.id, trimmed);
    folderToRename = null;
    renameValue = '';
  }

  function startDelete(folder: { id: string; name: string }): void {
    if (!canDeleteFolder(folder.id)) return;
    folderToDelete = folder;
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!folderToDelete) return;
    await deleteFolder(folderToDelete.id);
    folderToDelete = null;
  }
</script>

<aside class="folder-nav" aria-label={translateKey(AppStrings.Widgets.Folder.Title)}>
  <div class="folder-nav-header">
    <h2 class="folder-nav-title">{translateKey(AppStrings.Widgets.Folder.Title)}</h2>
  </div>

  <div class="folder-nav-list" role="tree">
    {#each folderStore.rootFolders as rootFolder (rootFolder.id)}
      {@render folderItem(rootFolder, 0)}
    {/each}
  </div>

  {#if !profileStore.isCurrentProfileLocked}
    <div class="folder-nav-footer">
      <Button
        variant="secondary"
        fill
        onclick={() => startCreate(null)}
      >
        <span class="btn-icon">＋</span>
        <span>{translateKey(AppStrings.Widgets.Folder.NewFolder)}</span>
      </Button>
    </div>
  {/if}
</aside>

{#snippet folderItem(folder: typeof folderStore.rootFolders[number], depth: number)}
  {@const isSelected = folderStore.selectedFolderId === folder.id}
  {@const children = getChildFolders(folder.id)}
  {@const hasChildren = children.length > 0}
  {@const isExpanded = folder.isExpanded}

  <div
    class="folder-row"
    class:is-selected={isSelected}
    style:padding-left="{depth * 16 + 12}px"
    role="treeitem"
    aria-selected={isSelected}
    aria-expanded={hasChildren ? isExpanded : undefined}
    tabindex="0"
    onclick={() => selectFolder(folder.id)}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectFolder(folder.id);
      }
    }}
  >
    {#if hasChildren}
      <button
        type="button"
        class="folder-toggle-btn"
        aria-label={isExpanded ? 'Collapse subfolders' : 'Expand subfolders'}
        onclick={(e) => {
          e.stopPropagation();
          toggleFolderExpanded(folder.id);
        }}
      >
        {isExpanded ? '▾' : '▸'}
      </button>
    {:else}
      <span class="folder-toggle-spacer"></span>
    {/if}

    <span class="folder-icon">📁</span>
    <span class="folder-name" title={folder.name}>{folder.name}</span>

    {#if folder.isDefault && folder.parentId === null}
      <span class="folder-start-badge" title={translateKey(AppStrings.Widgets.Folder.StartFolder)}>★</span>
    {/if}

    {#if !profileStore.isCurrentProfileLocked}
      <div class="folder-row-actions">
        <button
          type="button"
          class="row-action-btn"
          title={translateKey(AppStrings.Widgets.Folder.RenameFolderHeading)}
          aria-label="{translateKey(AppStrings.Widgets.Folder.RenameFolderHeading)} {folder.name}"
          onclick={(e) => {
            e.stopPropagation();
            startRename(folder);
          }}
        >
          ✎
        </button>
        {#if canDeleteFolder(folder.id)}
          <button
            type="button"
            class="row-action-btn danger"
            title={translateKey(AppStrings.Widgets.Folder.DeleteHeading)}
            aria-label="{translateKey(AppStrings.Widgets.Folder.DeleteHeading)} {folder.name}"
            onclick={(e) => {
              e.stopPropagation();
              startDelete(folder);
            }}
          >
            ✕
          </button>
        {/if}
      </div>
    {/if}
  </div>

  {#if hasChildren && isExpanded}
    {#each children as child (child.id)}
      {@render folderItem(child, depth + 1)}
    {/each}
  {/if}
{/snippet}

{#if isCreatingFolder}
  <Modal
    heading={translateKey(AppStrings.Widgets.Folder.NewFolder)}
    showFooter
    onclose={() => { isCreatingFolder = false; }}
  >
    <div class="modal-form">
      <input
        type="text"
        class="folder-name-input"
        placeholder={translateKey(AppStrings.Widgets.Folder.FolderNamePlaceholder)}
        bind:value={newFolderName}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            void handleConfirmCreate();
          }
        }}
      />
    </div>

    {#snippet footer()}
      <Button variant="secondary" onclick={() => { isCreatingFolder = false; }}>
        {translateKey(Strings.Common.Cancel)}
      </Button>
      <Button variant="primary" disabled={!newFolderName.trim()} onclick={handleConfirmCreate}>
        {translateKey(Strings.Common.Save)}
      </Button>
    {/snippet}
  </Modal>
{/if}

{#if folderToRename}
  <Modal
    heading={translateKey(AppStrings.Widgets.Folder.RenameFolderHeading)}
    showFooter
    onclose={() => { folderToRename = null; }}
  >
    <div class="modal-form">
      <input
        type="text"
        class="folder-name-input"
        placeholder={translateKey(AppStrings.Widgets.Folder.FolderNamePlaceholder)}
        bind:value={renameValue}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            void handleConfirmRename();
          }
        }}
      />
    </div>

    {#snippet footer()}
      <Button variant="secondary" onclick={() => { folderToRename = null; }}>
        {translateKey(Strings.Common.Cancel)}
      </Button>
      <Button variant="primary" disabled={!renameValue.trim()} onclick={handleConfirmRename}>
        {translateKey(Strings.Common.Save)}
      </Button>
    {/snippet}
  </Modal>
{/if}

{#if folderToDelete}
  <ConfirmDialog
    heading={translateKey(AppStrings.Widgets.Folder.DeleteHeading)}
    message={translateKey(AppStrings.Widgets.Folder.DeleteConfirmGeneric)}
    confirmText={translateKey(Strings.Common.Delete)}
    cancelText={translateKey(Strings.Common.Cancel)}
    danger
    onconfirm={handleConfirmDelete}
    oncancel={() => { folderToDelete = null; }}
  />
{/if}

<style>
  .folder-nav {
    height: 100%;
    width: 14rem;
    flex-shrink: 0;
    background-color: var(--color-bg-secondary);
    border-inline-start: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .folder-nav-header {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }

  .folder-nav-title {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .folder-nav-list {
    flex: 1;
    padding: var(--space-2) 0;
    overflow-y: auto;
  }

  .folder-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    user-select: none;
    transition: background-color var(--transition-fast);
    position: relative;
    border-radius: var(--radius-sm);
    margin: 1px var(--space-2);
  }

  .folder-row:hover {
    background-color: var(--color-bg-hover);
  }

  .folder-row.is-selected {
    background-color: var(--color-accent-muted);
    color: var(--color-accent);
    font-weight: var(--font-semibold);
  }

  .folder-toggle-btn {
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .folder-toggle-spacer {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .folder-icon {
    font-size: var(--text-sm);
    flex-shrink: 0;
  }

  .folder-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: var(--text-sm);
  }

  .folder-start-badge {
    color: var(--color-accent);
    font-size: var(--text-xs);
  }

  .folder-row-actions {
    display: none;
    align-items: center;
    gap: 4px;
  }

  .folder-row:hover .folder-row-actions {
    display: flex;
  }

  .row-action-btn {
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: var(--text-xs);
    padding: 2px 4px;
    color: var(--color-text-muted);
    border-radius: var(--radius-sm);
  }

  .row-action-btn:hover {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .row-action-btn.danger:hover {
    color: var(--color-danger);
  }

  .folder-nav-footer {
    padding: var(--space-3);
    border-top: 1px solid var(--color-border);
  }

  .btn-icon {
    margin-inline-end: var(--space-1);
  }

  .modal-form {
    padding: var(--space-3) 0;
  }

  .folder-name-input {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    box-sizing: border-box;
  }

  .folder-name-input:focus {
    outline: none;
    border-color: var(--color-accent);
  }
</style>
