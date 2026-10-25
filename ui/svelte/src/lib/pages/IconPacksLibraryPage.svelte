<script lang="ts">
  /*
   * Icon Packs library page.
   *
   * Displays the list of installed and built-in icon packs on the rail, and
   * the icons of the selected pack in a responsive grid. Supports multi-selection,
   * batch deletion, pack creation/editing, pack/icon context menus, exporting,
   * clipboard copying with manual fallback dialog, and drag-and-drop importing.
   */

  import { onMount } from 'svelte';
  import type { IpcIcon, IpcIconPack } from '@macro-deck/runtime';
  import { AppStrings } from '@macro-deck/runtime';
  import Button from '$lib/components/Button.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import ContextMenu, { type ContextMenuItem } from '$lib/components/ContextMenu.svelte';
  import CopyTextModal from '$lib/components/CopyTextModal.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import IconGrid from '$lib/components/IconGrid.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import PackEditModal, { type PackEditData } from '$lib/components/PackEditModal.svelte';
  import RailItem from '$lib/components/RailItem.svelte';
  import RailPage from '$lib/components/RailPage.svelte';
  import {
    createPack,
    deleteIcons,
    deletePack,
    exportPack,
    iconPackStore,
    importIconPacks,
    loadIconPacks,
    loadIcons,
    renameIcon,
    updatePack,
    uploadIcons,
  } from '$lib/icon-packs.svelte';
  import { translateKey } from '$lib/localization.svelte';
  import { navigate, route } from '$lib/router.svelte';
  import { clipboardFailureDetail, copyText } from '$lib/text-clipboard';
  import { showToast } from '$lib/toasts.svelte';

  let selectedPackId = $state<string | null>(null);
  let searchQuery = $state('');
  let requestedPackId: string | null = route.query.pack ?? null;

  let packDialogMode = $state<'create' | 'edit' | null>(null);
  let packPendingDeletion = $state<IpcIconPack | null>(null);
  let packMenuState = $state<{ pack: IpcIconPack; x: number; y: number } | null>(null);
  let iconMenuState = $state<{ icon: IpcIcon; x: number; y: number } | null>(null);
  let importMenuState = $state<{ x: number; y: number } | null>(null);
  let addPackMenuState = $state<{ x: number; y: number } | null>(null);

  let iconPendingRename = $state<IpcIcon | null>(null);
  let renameValue = $state('');
  let manualCopy = $state<{ value: string; message: string } | null>(null);

  let selectedIconIds = $state<ReadonlySet<string>>(new Set());
  let iconsPendingDeletion = $state<IpcIcon[] | null>(null);
  let selectionAnchorId: string | null = null;

  let fileInputEl = $state<HTMLInputElement | null>(null);
  let folderInputEl = $state<HTMLInputElement | null>(null);
  let packInputEl = $state<HTMLInputElement | null>(null);

  let isDetailDragOver = $state(false);
  let dragOverPackId = $state<string | null>(null);

  onMount(() => {
    if (iconPackStore.packs.length === 0 && !iconPackStore.isLoading) {
      void loadIconPacks();
    }
  });

  $effect(() => {
    const packs = iconPackStore.packs;
    if (packs.length === 0) {
      selectedPackId = null;
      return;
    }

    if (requestedPackId && packs.some(p => p.id === requestedPackId)) {
      selectedPackId = requestedPackId;
      requestedPackId = null;
      return;
    }

    if (!selectedPackId || !packs.some(p => p.id === selectedPackId)) {
      selectedPackId = packs.find(p => p.isDefault)?.id ?? packs[0].id;
    }
  });

  $effect(() => {
    const packId = selectedPackId;
    if (packId && !iconPackStore.isPackLoaded(packId)) {
      void loadIcons(packId);
    }
  });

  const selectedPack = $derived(
    iconPackStore.packs.find(p => p.id === selectedPackId) ?? null,
  );

  const icons = $derived(
    selectedPackId ? iconPackStore.iconsFor(selectedPackId) : [],
  );

  const filteredIcons = $derived.by(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return icons;
    return icons.filter(icon => icon.name.toLowerCase().includes(query));
  });

  const packMenuItems = $derived.by<ContextMenuItem[]>(() => {
    const pack = packMenuState?.pack;
    const readOnly = pack?.isReadOnly ?? false;
    return [
      {
        id: 'edit',
        label: translateKey(AppStrings.IconPacks.EditPackAction),
        icon: 'icon-pencil',
        disabled: readOnly,
      },
      {
        id: 'import',
        label: translateKey(AppStrings.IconPacks.ImportIconsAction),
        icon: 'icon-download',
        disabled: readOnly,
      },
      {
        id: 'export',
        label: translateKey(AppStrings.IconPacks.ExportPackAction),
        icon: 'icon-upload',
        dividerAfter: true,
      },
      {
        id: 'delete',
        label: translateKey(AppStrings.IconPacks.DeletePackAction),
        icon: 'icon-trash',
        danger: true,
        disabled: (pack?.isDefault ?? false) || !(pack?.canDelete ?? true),
      },
    ];
  });

  const iconMenuItems = $derived.by<ContextMenuItem[]>(() => {
    const readOnly = selectedPack?.isReadOnly ?? false;
    const menuIcon = iconMenuState?.icon;
    const selection = selectedIconIds;
    const bulk = menuIcon && selection.has(menuIcon.id) && selection.size > 1 ? selection.size : 0;
    return [
      {
        id: 'rename',
        label: translateKey('macrodeck:Common.Rename'),
        icon: 'icon-pencil',
        disabled: readOnly || bulk > 0,
      },
      {
        id: 'appearances',
        label: translateKey(AppStrings.IconPacks.Appearances.MenuItem),
        icon: 'icon-layers',
        disabled: bulk > 0,
      },
      {
        id: 'copy-id',
        label: translateKey(AppStrings.IconPacks.CopyIconIdAction),
        icon: 'icon-copy',
        dividerAfter: true,
      },
      {
        id: 'delete',
        label: translateKey(AppStrings.IconPacks.DeleteIconAction, { count: bulk > 0 ? bulk : 1 }),
        icon: 'icon-trash',
        danger: true,
        disabled: readOnly,
      },
    ];
  });

  const importMenuItems: ContextMenuItem[] = [
    {
      id: 'files',
      label: translateKey(AppStrings.IconPacks.ImportFilesAction),
      icon: 'icon-file-text',
    },
    {
      id: 'folder',
      label: translateKey(AppStrings.IconPacks.ImportFolderAction),
      icon: 'icon-folder',
    },
  ];

  const addPackMenuItems: ContextMenuItem[] = [
    {
      id: 'create',
      label: translateKey(AppStrings.IconPacks.CreatePackAction),
      icon: 'icon-plus',
    },
    {
      id: 'import',
      label: translateKey(AppStrings.IconPacks.ImportPackAction),
      icon: 'icon-download',
    },
  ];

  function selectPack(pack: IpcIconPack): void {
    selectedPackId = pack.id;
    searchQuery = '';
    clearSelection();
  }

  function onIconClick(click: { icon: IpcIcon; toggle: boolean; range: boolean }): void {
    const id = click.icon.id;
    const toggle = click.toggle || (!click.range && selectedIconIds.size > 0);
    if (toggle) {
      const next = new Set(selectedIconIds);
      if (!next.delete(id)) {
        next.add(id);
      }
      selectedIconIds = next;
      selectionAnchorId = id;
      return;
    }

    if (click.range && selectionAnchorId) {
      const currentIcons = filteredIcons;
      const anchorIndex = currentIcons.findIndex(i => i.id === selectionAnchorId);
      const targetIndex = currentIcons.findIndex(i => i.id === id);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const [from, to] =
          anchorIndex <= targetIndex
            ? [anchorIndex, targetIndex]
            : [targetIndex, anchorIndex];
        selectedIconIds = new Set(currentIcons.slice(from, to + 1).map(i => i.id));
        return;
      }
    }

    selectedIconIds = new Set([id]);
    selectionAnchorId = id;
  }

  function clearSelection(): void {
    selectedIconIds = new Set();
    selectionAnchorId = null;
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (
      packDialogMode !== null ||
      iconPendingRename !== null ||
      iconsPendingDeletion !== null ||
      packPendingDeletion !== null ||
      manualCopy !== null
    ) {
      return;
    }

    if (event.key === 'Escape' && selectedIconIds.size > 0) {
      clearSelection();
      return;
    }

    const isEditable =
      event.target instanceof HTMLElement &&
      (event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.isContentEditable);

    if ((event.key === 'Delete' || event.key === 'Backspace') && !isEditable) {
      requestDeleteSelection();
    }
  }

  function requestDeleteSelection(): void {
    if (selectedIconIds.size === 0 || selectedPack?.isReadOnly) {
      return;
    }
    iconsPendingDeletion = icons.filter(i => selectedIconIds.has(i.id));
  }

  function deleteIconsMessage(iconsList: IpcIcon[]): string {
    if (iconsList.length === 1) {
      return translateKey(AppStrings.IconPacks.DeleteIconMessage, { name: iconsList[0].name });
    }
    return translateKey(AppStrings.IconPacks.DeleteIconsMessage, { count: iconsList.length });
  }

  async function confirmDeleteIcons(): Promise<void> {
    const toDelete = iconsPendingDeletion;
    iconsPendingDeletion = null;
    const packId = selectedPackId;
    if (!toDelete || toDelete.length === 0 || !packId) {
      return;
    }
    await deleteIcons(toDelete.map(i => i.id), packId);
    clearSelection();
  }

  function openCreatePack(): void {
    packDialogMode = 'create';
  }

  function openEditPack(): void {
    if (selectedPack && !selectedPack.isReadOnly) {
      packDialogMode = 'edit';
    }
  }

  async function onPackDialogSave(result: PackEditData): Promise<void> {
    if (packDialogMode === 'create') {
      const pack = await createPack(result);
      if (pack) {
        selectedPackId = pack.id;
      }
    } else {
      const packId = selectedPackId;
      if (packId) {
        await updatePack(packId, result);
      }
    }
    packDialogMode = null;
  }

  function requestDeletePack(pack: IpcIconPack): void {
    if (!pack.isDefault && (pack.canDelete ?? true)) {
      packPendingDeletion = pack;
    }
  }

  function deletePackMessage(pack: IpcIconPack): string {
    const key =
      pack.ownerKind === 'Store'
        ? AppStrings.IconPacks.DeleteStorePackMessage
        : AppStrings.IconPacks.DeletePackMessage;
    return translateKey(key, { name: pack.name, count: pack.iconCount });
  }

  async function confirmDeletePack(): Promise<void> {
    const pack = packPendingDeletion;
    packPendingDeletion = null;
    if (pack) {
      await deletePack(pack.id);
    }
  }

  function sourceLabel(pack: IpcIconPack): string | null {
    switch (pack.ownerKind) {
      case 'Store':
        return translateKey(AppStrings.IconPacks.SourceStore);
      case 'Plugin':
        return translateKey(AppStrings.IconPacks.SourcePlugin);
      case 'BuiltIn':
        return translateKey(AppStrings.IconPacks.SourceBuiltIn);
      default:
        return null;
    }
  }

  function sourceTitle(pack: IpcIconPack): string {
    if (pack.ownerKind === 'BuiltIn') {
      return translateKey(AppStrings.IconPacks.ManagedByMacroDeck);
    }
    if (pack.ownerKind !== 'Plugin') {
      return translateKey(AppStrings.IconPacks.ManagedByStore);
    }
    return pack.ownerName
      ? translateKey(AppStrings.IconPacks.ManagedByPlugin, { name: pack.ownerName })
      : translateKey(AppStrings.IconPacks.ManagedByUnnamedPlugin);
  }

  function openInStore(packageId: string): void {
    navigate(`/store/IconPack/${encodeURIComponent(packageId)}`);
  }

  async function handleExportPack(pack: IpcIconPack): Promise<void> {
    const result = await exportPack(pack.id);
    if (!result.ok) {
      showToast(translateKey(AppStrings.IconPacks.PackExportFailed), {
        detail: result.error,
        variant: 'error',
      });
      return;
    }
    if (!result.canceled) {
      showToast(
        translateKey(AppStrings.IconPacks.PackExported, { name: pack.name }),
        { detail: result.fileName },
      );
    }
  }

  function openPackMenu(event: MouseEvent, pack: IpcIconPack): void {
    event.preventDefault();
    selectPack(pack);
    packMenuState = { pack, x: event.clientX, y: event.clientY };
  }

  function onPackMenuAction(action: string): void {
    const pack = packMenuState?.pack;
    packMenuState = null;
    if (!pack) return;

    switch (action) {
      case 'edit':
        openEditPack();
        break;
      case 'import':
        pickFiles();
        break;
      case 'export':
        void handleExportPack(pack);
        break;
      case 'delete':
        requestDeletePack(pack);
        break;
    }
  }

  function openIconMenu(data: { icon: IpcIcon; x: number; y: number }): void {
    iconMenuState = data;
  }

  async function onIconMenuAction(action: string): Promise<void> {
    const icon = iconMenuState?.icon;
    iconMenuState = null;
    if (!icon) return;

    switch (action) {
      case 'rename':
        renameValue = icon.name;
        iconPendingRename = icon;
        break;
      case 'appearances':
        break;
      case 'copy-id':
        await copyIconId(icon);
        break;
      case 'delete': {
        const selection = selectedIconIds;
        if (selection.has(icon.id) && selection.size > 1) {
          requestDeleteSelection();
        } else {
          iconsPendingDeletion = [icon];
        }
        break;
      }
    }
  }

  async function copyIconId(icon: IpcIcon): Promise<void> {
    const result = await copyText(icon.id);
    if (result.status === 'copied') {
      showToast(translateKey(AppStrings.IconPacks.IconIdCopied), { detail: icon.id });
      return;
    }

    manualCopy = {
      value: icon.id,
      message: `${clipboardFailureDetail(result.reason)} ${translateKey(AppStrings.IconPacks.CopyManualInstruction)}`,
    };
  }

  async function confirmRename(): Promise<void> {
    const icon = iconPendingRename;
    const name = renameValue.trim();
    iconPendingRename = null;
    if (icon && name && name !== icon.name) {
      await renameIcon(icon.id, name);
    }
  }

  function cancelRename(): void {
    iconPendingRename = null;
  }

  function openImportMenu(event: MouseEvent): void {
    const trigger = event.currentTarget as HTMLElement;
    const rect = trigger.getBoundingClientRect();
    importMenuState = { x: rect.left, y: rect.bottom + 4 };
  }

  function onImportMenuAction(action: string): void {
    importMenuState = null;
    switch (action) {
      case 'files':
        pickFiles();
        break;
      case 'folder':
        pickFolder();
        break;
    }
  }

  function pickFiles(): void {
    fileInputEl?.click();
  }

  function pickFolder(): void {
    folderInputEl?.click();
  }

  function pickPackFiles(): void {
    packInputEl?.click();
  }

  function openAddPackMenu(event: MouseEvent): void {
    const trigger = event.currentTarget as HTMLElement;
    const rect = trigger.getBoundingClientRect();
    addPackMenuState = { x: rect.left, y: rect.bottom + 4 };
  }

  function onAddPackMenuAction(action: string): void {
    addPackMenuState = null;
    switch (action) {
      case 'create':
        openCreatePack();
        break;
      case 'import':
        pickPackFiles();
        break;
    }
  }

  async function onFilesPicked(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files ?? []);
    target.value = '';
    if (files.length > 0 && selectedPack) {
      await importFilesInto(selectedPack, files);
    }
  }

  async function onPacksPicked(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files ?? []);
    target.value = '';
    if (files.length > 0) {
      await importPacks(files);
    }
  }

  async function importPacks(files: File[]): Promise<void> {
    const res = await importIconPacks(files);
    if (res.success && res.packs && res.packs.length > 0) {
      showToast(
        translateKey(AppStrings.IconPacks.PackImported),
        { detail: res.packs.map(p => p.name).join(', ') },
      );
    } else if (!res.success) {
      showToast(translateKey(AppStrings.IconPacks.PackImportFailed), { variant: 'error' });
    }
  }

  async function importFilesInto(pack: IpcIconPack, files: File[]): Promise<void> {
    if (pack.isReadOnly || files.length === 0) return;
    await uploadIcons(pack.id, files);
  }

  function isArchiveFile(file: File): boolean {
    const name = file.name.toLowerCase();
    return (
      name.endsWith('.macrodeckiconpack') ||
      name.endsWith('.streamdeckiconpack') ||
      name.endsWith('.tpi') ||
      name.endsWith('.zip')
    );
  }

  function handleDetailDragOver(event: DragEvent): void {
    event.preventDefault();
    isDetailDragOver = true;
  }

  function handleDetailDragLeave(event: DragEvent): void {
    event.preventDefault();
    isDetailDragOver = false;
  }

  async function handleDetailDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    isDetailDragOver = false;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length === 0) return;

    const archives = files.filter(isArchiveFile);
    const regular = files.filter(f => !isArchiveFile(f));

    if (archives.length > 0) {
      await importPacks(archives);
    }

    if (selectedPack && !selectedPack.isReadOnly && regular.length > 0) {
      await importFilesInto(selectedPack, regular);
    }
  }

  async function handlePackRailDrop(pack: IpcIconPack, event: DragEvent): Promise<void> {
    event.preventDefault();
    dragOverPackId = null;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length === 0) return;

    const archives = files.filter(isArchiveFile);
    const regular = files.filter(f => !isArchiveFile(f));

    if (archives.length > 0) {
      await importPacks(archives);
    }

    if (!pack.isReadOnly && regular.length > 0) {
      await importFilesInto(pack, regular);
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<RailPage railTitle={translateKey(AppStrings.Nav.IconPacks)}>
  {#snippet banner()}
    {#if iconPackStore.loadError}
      <div class="error-banner" role="alert">
        <span>{iconPackStore.loadError}</span>
      </div>
    {/if}
  {/snippet}

  {#snippet railActions()}
    <Button
      variant="secondary"
      size="icon"
      title={translateKey(AppStrings.IconPacks.AddIconPack)}
      ariaLabel={translateKey(AppStrings.IconPacks.AddIconPack)}
      onclick={openAddPackMenu}
    >
      <span class="icon icon-plus icon-sm" aria-hidden="true"></span>
    </Button>
  {/snippet}

  {#snippet rail()}
    {#if iconPackStore.isLoading && iconPackStore.packs.length === 0}
      <p class="pack-status">{translateKey(AppStrings.IconPacks.LoadingIconPacks)}</p>
    {:else if iconPackStore.packs.length === 0}
      <EmptyState
        heading={translateKey(AppStrings.IconPacks.NoPacksYetHeading)}
        message={translateKey(AppStrings.IconPacks.NoPacksYetMessage)}
      />
    {:else}
      <ul
        class="pack-list"
        role="listbox"
        aria-label={translateKey(AppStrings.IconPacks.IconPacksAriaLabel)}
      >
        {#each iconPackStore.packs as pack (pack.id)}
          <li
            class="pack-item"
            class:file-drag-over={dragOverPackId === pack.id}
            ondragover={(e) => {
              e.preventDefault();
              dragOverPackId = pack.id;
            }}
            ondragleave={() => {
              if (dragOverPackId === pack.id) dragOverPackId = null;
            }}
            ondrop={(e) => handlePackRailDrop(pack, e)}
          >
            <RailItem
              label={pack.name}
              count={pack.iconCount}
              active={pack.id === selectedPackId}
              onclick={() => selectPack(pack)}
              oncontextmenu={(e) => openPackMenu(e, pack)}
            >
              {#if pack.isReadOnly}
                <span
                  class="icon icon-lock icon-xs"
                  role="img"
                  title={translateKey(AppStrings.IconPacks.ReadOnlyPack)}
                  aria-label={translateKey(AppStrings.IconPacks.ReadOnlyPack)}
                ></span>
              {/if}
              {#if pack.isDefault}
                <span class="tag">{translateKey(AppStrings.IconPacks.DefaultTag)}</span>
              {/if}
              {#if sourceLabel(pack)}
                <span class="tag" title={sourceTitle(pack)}>{sourceLabel(pack)}</span>
              {/if}
            </RailItem>
          </li>
        {/each}
      </ul>
    {/if}
  {/snippet}

  <div
    class="pack-detail"
    class:file-drag-over={isDetailDragOver}
    ondragover={handleDetailDragOver}
    ondragleave={handleDetailDragLeave}
    ondrop={handleDetailDrop}
    role="region"
    aria-label={selectedPack ? selectedPack.name : translateKey(AppStrings.Nav.IconPacks)}
  >
    {#if selectedPack}
      <header class="detail-header">
        <div class="detail-title">
          <h2 title={selectedPack.name}>{selectedPack.name}</h2>
          {#if selectedPack.isReadOnly}
            <span class="tag">
              <span class="icon icon-lock icon-xs" aria-hidden="true"></span>
              {translateKey(AppStrings.IconPacks.ReadOnly)}
            </span>
          {/if}
          {#if sourceLabel(selectedPack)}
            <span class="tag" title={sourceTitle(selectedPack)}>
              {sourceLabel(selectedPack)}
            </span>
          {/if}
          {#if selectedPack.aiAssets === 'Generated'}
            <span class="tag">
              <span class="icon icon-sparkles icon-xs" aria-hidden="true"></span>
              {translateKey(AppStrings.IconPacks.AiGenerated)}
            </span>
          {/if}
        </div>

        <p class="detail-meta">
          {#if selectedPack.description}
            <span>{selectedPack.description}</span>
          {/if}
          {#if selectedPack.author}
            <span>{translateKey(AppStrings.IconPacks.ByAuthor, { name: selectedPack.author })}</span>
          {/if}
          {#if selectedPack.version}
            <span>{translateKey(AppStrings.IconPacks.VersionLabel, { version: selectedPack.version })}</span>
          {/if}
          <span>{translateKey(AppStrings.IconPacks.IconCount, { count: selectedPack.iconCount })}</span>
        </p>

        <div class="detail-actions">
          <div class="search">
            <input
              type="search"
              class="search-input"
              placeholder={translateKey(AppStrings.IconPacks.SearchIconsPlaceholder)}
              bind:value={searchQuery}
            />
          </div>
          {#if selectedPack.storePackageId}
            <Button
              variant="secondary"
              onclick={() => openInStore(selectedPack.storePackageId!)}
            >
              <span class="icon icon-store icon-sm" aria-hidden="true"></span>
              {translateKey('macrodeck.app:Integrations.Detail.ViewInStoreAction')}
            </Button>
          {/if}
          {#if !selectedPack.isReadOnly}
            <Button variant="primary" onclick={pickFiles}>
              <span class="icon icon-download icon-sm" aria-hidden="true"></span>
              {translateKey('macrodeck:Common.Import')}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              title={translateKey(AppStrings.IconPacks.MoreImportOptions)}
              ariaLabel={translateKey(AppStrings.IconPacks.MoreImportOptions)}
              onclick={openImportMenu}
            >
              <span class="icon icon-dots-vertical icon-sm" aria-hidden="true"></span>
            </Button>
            <Button variant="secondary" onclick={openEditPack}>
              <span class="icon icon-pencil icon-sm" aria-hidden="true"></span>
              {translateKey('macrodeck:Common.Edit')}
            </Button>
          {/if}
        </div>
      </header>

      {#if icons.length === 0}
        {#if selectedPack.isReadOnly}
          <EmptyState
            icon="lock"
            heading={translateKey(AppStrings.IconPacks.EmptyReadOnlyHeading)}
            message={translateKey(AppStrings.IconPacks.EmptyReadOnlyMessage)}
          />
        {:else}
          <EmptyState
            icon="image"
            heading={translateKey(AppStrings.IconPacks.NoIconsYetHeading)}
            message={translateKey(AppStrings.IconPacks.NoIconsYetMessage)}
          >
            <p class="supported-types">
              {translateKey(AppStrings.IconPacks.SupportedFileTypes)}
            </p>
          </EmptyState>
        {/if}
      {:else if filteredIcons.length === 0}
        <EmptyState
          heading={translateKey(AppStrings.IconPacks.NoMatchingIconsHeading)}
          message={translateKey(AppStrings.IconPacks.NoMatchingIconsMessage)}
        />
      {:else}
        {#if selectedIconIds.size > 0}
          <div
            class="selection-bar"
            role="toolbar"
            aria-label={translateKey(AppStrings.IconPacks.IconSelectionAriaLabel)}
          >
            <span class="selection-count">
              {translateKey(AppStrings.IconPacks.IconsSelectedCount, { count: selectedIconIds.size })}
            </span>
            <Button variant="ghost" onclick={clearSelection}>
              {translateKey(AppStrings.IconPacks.Clear)}
            </Button>
            {#if !selectedPack.isReadOnly}
              <Button variant="danger" onclick={requestDeleteSelection}>
                <span class="icon icon-trash icon-sm" aria-hidden="true"></span>
                {translateKey('macrodeck:Common.Delete')}
              </Button>
            {/if}
          </div>
        {/if}
        <IconGrid
          icons={filteredIcons}
          selectable={true}
          multiSelect={true}
          {selectedIconIds}
          oniconclick={onIconClick}
          oniconcontextmenu={openIconMenu}
        />
      {/if}

      {#if !selectedPack.isReadOnly}
        <div class="drop-hint" class:visible={isDetailDragOver} aria-hidden="true">
          <span class="icon icon-download icon-2xl" aria-hidden="true"></span>
          <span>{translateKey(AppStrings.IconPacks.DropHintImportInto, { name: selectedPack.name })}</span>
        </div>
      {/if}
    {:else}
      <EmptyState
        heading={translateKey(AppStrings.IconPacks.SelectAnIconPackHeading)}
        message={translateKey(AppStrings.IconPacks.SelectAnIconPackMessage)}
      />
    {/if}
  </div>
</RailPage>

<input
  bind:this={fileInputEl}
  type="file"
  hidden
  multiple
  accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.lottie,.json,.zip,.streamDeckIconPack,.tpi,.macroDeckIconPack,.ico,.icns,.exe,.dll"
  onchange={onFilesPicked}
/>
<input
  bind:this={folderInputEl}
  type="file"
  hidden
  webkitdirectory
  onchange={onFilesPicked}
/>
<input
  bind:this={packInputEl}
  type="file"
  hidden
  multiple
  accept=".macroDeckIconPack,.streamDeckIconPack,.tpi,.zip"
  onchange={onPacksPicked}
/>

{#if packMenuState}
  <ContextMenu
    items={packMenuItems}
    x={packMenuState.x}
    y={packMenuState.y}
    onselect={onPackMenuAction}
    onclose={() => (packMenuState = null)}
  />
{/if}

{#if iconMenuState}
  <ContextMenu
    items={iconMenuItems}
    x={iconMenuState.x}
    y={iconMenuState.y}
    onselect={onIconMenuAction}
    onclose={() => (iconMenuState = null)}
  />
{/if}

{#if importMenuState}
  <ContextMenu
    items={importMenuItems}
    x={importMenuState.x}
    y={importMenuState.y}
    onselect={onImportMenuAction}
    onclose={() => (importMenuState = null)}
  />
{/if}

{#if addPackMenuState}
  <ContextMenu
    items={addPackMenuItems}
    x={addPackMenuState.x}
    y={addPackMenuState.y}
    onselect={onAddPackMenuAction}
    onclose={() => (addPackMenuState = null)}
  />
{/if}

{#if packDialogMode}
  <PackEditModal
    mode={packDialogMode}
    pack={packDialogMode === 'edit' ? selectedPack : null}
    onsave={onPackDialogSave}
    oncancel={() => (packDialogMode = null)}
  />
{/if}

{#if packPendingDeletion}
  <ConfirmDialog
    heading={translateKey(AppStrings.IconPacks.DeletePackHeading)}
    message={deletePackMessage(packPendingDeletion)}
    confirmText={translateKey(AppStrings.IconPacks.DeletePackAction)}
    danger={true}
    onconfirm={confirmDeletePack}
    oncancel={() => (packPendingDeletion = null)}
  />
{/if}

{#if iconsPendingDeletion}
  <ConfirmDialog
    heading={translateKey(AppStrings.IconPacks.DeleteIconsHeading, { count: iconsPendingDeletion.length })}
    message={deleteIconsMessage(iconsPendingDeletion)}
    confirmText={translateKey(AppStrings.IconPacks.DeleteIconAction, { count: iconsPendingDeletion.length })}
    danger={true}
    onconfirm={confirmDeleteIcons}
    oncancel={() => (iconsPendingDeletion = null)}
  />
{/if}

{#if iconPendingRename}
  <Modal
    heading={translateKey(AppStrings.IconPacks.RenameIconHeading)}
    maxWidth="360px"
    showFooter={false}
    onclose={cancelRename}
  >
    <form class="rename-form" onsubmit={(e) => { e.preventDefault(); void confirmRename(); }}>
      <input
        class="rename-input"
        placeholder={translateKey(AppStrings.IconPacks.IconNamePlaceholder)}
        bind:value={renameValue}
        name="iconName"
      />
      <div class="rename-actions">
        <Button variant="secondary" onclick={cancelRename}>
          {translateKey('macrodeck:Common.Cancel')}
        </Button>
        <Button variant="primary" type="submit" disabled={!renameValue.trim()}>
          {translateKey('macrodeck:Common.Rename')}
        </Button>
      </div>
    </form>
  </Modal>
{/if}

{#if manualCopy}
  <CopyTextModal
    heading={translateKey(AppStrings.IconPacks.CopyIconIdAction)}
    message={manualCopy.message}
    value={manualCopy.value}
    onclose={() => (manualCopy = null)}
  />
{/if}

<style>
  .error-banner {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    background: var(--color-danger-subtle, #fee2e2);
    color: var(--color-danger, #b91c1c);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .pack-status {
    margin: 0;
    padding: var(--space-3);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    text-align: center;
  }

  .pack-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-y: auto;
    min-height: 0;
  }

  .pack-item {
    display: block;
    margin: 0;
    padding: 0;
  }

  .pack-item.file-drag-over {
    border-radius: var(--radius-md);
    outline: 2px dashed var(--color-accent);
    outline-offset: -2px;
    background: var(--color-accent-muted);
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 1px var(--space-1);
    border-radius: var(--radius-sm);
    background: var(--color-bg-tertiary);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .tag .icon {
    background-color: var(--color-text-muted);
  }

  .pack-detail {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
  }

  .detail-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .detail-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .detail-title h2 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .detail-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .search {
    flex: 1 1 200px;
    max-width: 320px;
    min-width: 140px;
  }

  .search-input {
    width: 100%;
    box-sizing: border-box;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    outline: none;
  }

  .search-input:focus {
    border-color: var(--color-accent);
  }

  .selection-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-md);
    background: var(--color-accent-muted);
  }

  .selection-count {
    flex: 1 1 auto;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-primary);
  }

  .drop-hint {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    border: 2px dashed var(--color-accent);
    border-radius: var(--radius-lg);
    background: var(--color-accent-muted);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    pointer-events: none;
  }

  .drop-hint.visible {
    display: flex;
  }

  .drop-hint .icon {
    background-color: var(--color-accent);
  }

  .rename-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .rename-input {
    width: 100%;
    box-sizing: border-box;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    outline: none;
  }

  .rename-input:focus {
    border-color: var(--color-accent);
  }

  .rename-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  .supported-types {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    max-width: 26rem;
    text-align: center;
  }
</style>
