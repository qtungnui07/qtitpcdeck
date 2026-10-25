<script lang="ts">
  /*
   * The primary Deck page.
   *
   * Coordinates:
   * 1. Profile selection and status (locked / unlocked / readonly).
   * 2. Folder tree navigation and selection.
   * 3. Widget grid rendering (cols, rows, spacing, border radius, background, empty cells).
   * 4. Edit mode vs. live execution mode toggle.
   * 5. Widget creation modal when an empty cell is clicked in edit mode.
   * 6. Grid settings modal for resizing dimensions and adjusting styling.
   */
  import { untrack } from 'svelte';
  import {
    type ActionButtonTriggerType,
    AppStrings,
    BUILT_IN_WIDGET_TYPES,
    type EmptyCellStyle,
    type GridWidget,
    resolveLocalizedText,
    Strings,
    type WidgetType,
  } from '@macro-deck/runtime';
  import {
    addWidgetAt,
    executeActionButtonTrigger,
    folderStore,
    goBack,
    removeWidget,
    setEmptyCellStyle,
    setGridDimensions,
    setWidgetBorderRadius,
    setWidgetSpacing,
    updateWidget,
  } from '$lib/folders.svelte';
  import { profileStore, selectProfile } from '$lib/profiles.svelte';
  import { translateKey } from '$lib/localization.svelte';
  import { navigate } from '$lib/router.svelte';
  import {
    defaultWidgetDataFor,
    loadWidgetTypes,
    widgetTypeName,
    widgetTypeStore,
  } from '$lib/widget-types.svelte';
  import { localizationTranslator } from '$lib/localization.svelte';
  import Button from '$lib/components/Button.svelte';
  import WidgetPreview from '$lib/render/WidgetPreview.svelte';
  import DeckGrid from '$lib/components/DeckGrid.svelte';
  import ContextMenu, { type ContextMenuItem } from '$lib/components/ContextMenu.svelte';
  import ArchivePreviewModal from '$lib/components/ArchivePreviewModal.svelte';
  import { archiveImport, beginArchiveImport } from '$lib/archive-import.svelte';
  import { showToast } from '$lib/toasts.svelte';
  import { addWidgetFromApplication, commitWidgetLayout } from '$lib/folders.svelte';
  import { restoreFromPath } from '$lib/icon-packs.svelte';
  import type { ShellDropKind } from '$lib/shell-drop.util';
  import FolderNavigation from '$lib/components/FolderNavigation.svelte';
  import Modal from '$lib/components/Modal.svelte';

  let editMode = $state(false);
  let selectedWidgetId = $state<string | null>(null);

  // The tile context menu: an overlay over the grid, one widget at a time.
  let widgetContextMenu = $state<{ widget: GridWidget; x: number; y: number } | null>(null);
  let busyCell = $state<{ x: number; y: number } | null>(null);
  let archiveAnchor = $state<{ x: number; y: number } | null>(null);

  async function handleWidgetMove(widgetId: string, rect: { x: number; y: number; w: number; h: number }): Promise<void> {
    const result = await commitWidgetLayout(new Map([[widgetId, rect]]));
    if (!result.success) {
      showToast(result.error?.message ?? translateKey(AppStrings.Errors.Folder.CommitLayoutFailed), { variant: 'error' });
    }
  }
  function openWidgetContextMenu(widget: GridWidget, x: number, y: number): void {
    widgetContextMenu = { widget, x, y };
  }

  // A file dragged from the OS onto the grid: an executable or shortcut becomes an
  // application widget through the host; icon-pack archives import in place. The
  // remaining archive kinds have no import flow on this surface yet.
  async function handleShellDrop(kind: ShellDropKind, path: string, cell: { x: number; y: number } | null): Promise<void> {
    if (kind === 'application') {
      if (cell === null) return;
      busyCell = cell;
      const result = await addWidgetFromApplication(cell.x, cell.y, path);
      busyCell = null;
      if (!result.success) {
        showToast(result.error?.message ?? translateKey(AppStrings.Errors.Folder.AddApplicationFailed), { variant: 'error' });
      }
      return;
    }

    if (kind === 'iconPack') {
      const name = await restoreFromPath(path);
      if (name !== null) {
        showToast(translateKey(AppStrings.Deck.IconPackImported), { variant: 'success', detail: name });
      } else {
        showToast(translateKey(AppStrings.Deck.IconPackImportFailed), { variant: 'error' });
      }
      return;
    }

    if (kind === 'widgets') {
      archiveAnchor = cell ?? { x: 0, y: 0 };
      await beginArchiveImport(path);
      if (archiveImport.summary === null) archiveAnchor = null;
      return;
    }

    showToast('Importing this file type from the shell is not wired up yet.', { variant: 'error' });
  }
  function widgetContextMenuItems(): ContextMenuItem[] {
    const widget = widgetContextMenu?.widget;
    if (!widget) return [];
    return [
      { id: 'edit', label: translateKey(Strings.Common.Edit) },
      { id: 'delete', label: translateKey(Strings.Common.Delete), danger: true },
    ];
  }

  async function onWidgetContextSelect(id: string): Promise<void> {
    const widget = widgetContextMenu?.widget;
    widgetContextMenu = null;
    if (!widget) return;
    if (id === 'edit') {
      void navigate(`/deck/widgets/${widget.id}`);
    } else if (id === 'delete') {
      await handleWidgetDelete(widget.id);
    }
  }

  // Widget creation state when clicking an empty cell in edit mode
  let creatingAtCell = $state<{ x: number; y: number } | null>(null);
  let selectedNewWidgetType = $state<WidgetType>('ActionButton');
  let newWidgetLabel = $state('');
  let typeQuery = $state('');
  let typeSearchInput = $state<HTMLInputElement | undefined>(undefined);

  interface TypeChoice {
    id: string;
    builtIn: boolean;
    description: string;
    provider: string;
  }

  // The picker offers the host's own catalogue once it has arrived (built-ins
  // plus every plugin's types); the built-in list is the stand-in until then.
  const typeChoices = $derived.by<{ builtIn: TypeChoice[]; plugins: TypeChoice[]; total: number }>(() => {
    const catalogue = widgetTypeStore.types;
    const all: TypeChoice[] = catalogue.length > 0
      ? catalogue.map(entry => ({
        id: entry.id,
        builtIn: entry.isBuiltIn,
        description: entry.description ? resolveLocalizedText(entry.description, localizationTranslator) : '',
        provider: entry.providerName ? resolveLocalizedText(entry.providerName, localizationTranslator) : '',
      }))
      : BUILT_IN_WIDGET_TYPES.map(id => ({ id, builtIn: true, description: '', provider: '' }));

    const query = typeQuery.trim().toLowerCase();
    const matches = all.filter(choice =>
      query === ''
      || widgetTypeName(choice.id).toLowerCase().includes(query)
      || choice.id.toLowerCase().includes(query)
      || choice.provider.toLowerCase().includes(query));

    const byName = (a: TypeChoice, b: TypeChoice): number =>
      widgetTypeName(a.id).localeCompare(widgetTypeName(b.id), undefined, { sensitivity: 'base' });

    return {
      builtIn: matches.filter(choice => choice.builtIn).sort(byName),
      plugins: matches.filter(choice => !choice.builtIn).sort(byName),
      total: matches.length,
    };
  });

  // Kick the catalogue and put the caret in the search box when the picker
  // opens. Untracked so a catalogue that lands while the dialog is open does
  // not re-run this and wipe what the user has typed.
  $effect(() => {
    if (creatingAtCell === null) return;
    untrack(() => {
      void loadWidgetTypes();
      queueMicrotask(() => typeSearchInput?.focus());
    });
  });

  function chooseType(id: string): void {
    selectedNewWidgetType = id as WidgetType;
  }

  function previewDataFor(id: string): Record<string, unknown> {
    return (defaultWidgetDataFor(id) ?? {}) as Record<string, unknown>;
  }

  function descriptionOf(choice: TypeChoice): string {
    return choice.description;
  }

  // Grid settings modal
  let isEditingGridSettings = $state(false);
  let settingsCols = $state(5);
  let settingsRows = $state(3);
  let settingsSpacing = $state(12);
  let settingsBorderRadius = $state(22);
  let settingsEmptyCellStyle = $state<EmptyCellStyle>('visible');

  function toggleEditMode(): void {
    if (profileStore.isCurrentProfileLocked) return;
    editMode = !editMode;
    selectedWidgetId = null;
  }

  function handleCellClick(cell: { x: number; y: number }): void {
    if (!editMode || profileStore.isCurrentProfileLocked) return;
    creatingAtCell = cell;
    selectedNewWidgetType = 'ActionButton';
    newWidgetLabel = '';
    typeQuery = '';
  }

  async function handleConfirmAddWidget(): Promise<void> {
    if (!creatingAtCell || !folderStore.selectedFolderId) return;
    const widget = await addWidgetAt(
      creatingAtCell.x,
      creatingAtCell.y,
      selectedNewWidgetType,
    );
    // The label field was a no-op before: the widget was created with the type
    // defaults and whatever was typed there was dropped on the floor.
    const label = newWidgetLabel.trim();
    if (widget && label !== '') {
      const data = { ...(widget.data as Record<string, unknown>), label };
      await updateWidget(widget.id, { data: data as GridWidget['data'] });
    }
    creatingAtCell = null;
  }

  function handleWidgetClick(widget: GridWidget): void {
    if (editMode) {
      // The Angular deck opens the editor straight away; the local selection
      // toggle only highlighted the tile and left no way in.
      void navigate(`/deck/widgets/${widget.id}`);
    }
  }

  function handleWidgetTrigger(widget: GridWidget, triggerType: ActionButtonTriggerType): void {
    if (!editMode) {
      executeActionButtonTrigger(widget, triggerType);
    }
  }

  async function handleWidgetDelete(widgetId: string): Promise<void> {
    await removeWidget(widgetId);
    if (selectedWidgetId === widgetId) {
      selectedWidgetId = null;
    }
  }

  function openGridSettings(): void {
    settingsCols = folderStore.currentCols;
    settingsRows = folderStore.currentRows;
    settingsSpacing = folderStore.currentSpacing;
    settingsBorderRadius = folderStore.currentBorderRadius ?? 22;
    settingsEmptyCellStyle = folderStore.currentEmptyCellStyle;
    isEditingGridSettings = true;
  }

  async function handleSaveGridSettings(): Promise<void> {
    const folderId = folderStore.selectedFolderId;
    if (!folderId) return;

    if (settingsCols !== folderStore.currentCols || settingsRows !== folderStore.currentRows) {
      await setGridDimensions(settingsCols, settingsRows);
    }
    if (settingsSpacing !== folderStore.currentSpacing) {
      await setWidgetSpacing(settingsSpacing);
    }
    if (settingsBorderRadius !== folderStore.currentBorderRadius) {
      await setWidgetBorderRadius(settingsBorderRadius);
    }
    if (settingsEmptyCellStyle !== folderStore.currentEmptyCellStyle) {
      await setEmptyCellStyle(settingsEmptyCellStyle);
    }

    isEditingGridSettings = false;
  }
</script>

<div class="deck-page">
  {#if folderStore.isLoading}
    <div class="deck-state-container loading-state">
      <h1 class="deck-title visually-hidden">{folderStore.currentFolderName}</h1>
      <div class="spinner"></div>
      <p class="state-message">{translateKey(AppStrings.Deck.LoadingFolders)}</p>
    </div>
  {:else if !folderStore.selectedFolder}
    <div class="deck-state-container empty-state">
      <h1 class="deck-title visually-hidden">{folderStore.currentFolderName}</h1>
      <p class="state-message">{translateKey(AppStrings.Deck.NoFoldersAvailable)}</p>
      {#if folderStore.loadError}
        <p class="error-message">{folderStore.loadError}</p>
      {/if}
    </div>
  {:else}
    <div class="deck-content">
      <header class="deck-header">
        <div class="deck-title-area">
          <div class="deck-title-row">
            {#if folderStore.canGoBack}
              <Button
                variant="ghost"
                size="compact"
                title="Go back"
                ariaLabel="Go back"
                onclick={goBack}
              >
                ←
              </Button>
            {/if}
            <h1 class="deck-title">{folderStore.currentFolderName}</h1>
          </div>
          <p class="deck-subtitle">
            {translateKey(AppStrings.Deck.GridSubtitle, {
              cols: folderStore.currentCols,
              rows: folderStore.currentRows,
            })}
          </p>
        </div>

        <div class="deck-header-actions">
          {#if profileStore.profiles.length > 1}
            <select
              class="profile-select"
              aria-label="Profile selector"
              value={profileStore.selectedProfileId ?? ''}
              onchange={(e) => {
                const target = e.currentTarget as HTMLSelectElement;
                if (target.value) selectProfile(target.value);
              }}
            >
              {#each profileStore.profiles as profile (profile.id)}
                <option value={profile.id}>{profile.name}</option>
              {/each}
            </select>
          {/if}

          {#if !profileStore.isCurrentProfileLocked}
            <Button
              variant={editMode ? 'primary' : 'secondary'}
              onclick={toggleEditMode}
            >
              <span>{editMode ? '🔒' : '🔓'}</span>
              <span>{editMode ? translateKey(AppStrings.Deck.Lock) : translateKey(AppStrings.Deck.Unlock)}</span>
            </Button>
          {:else}
            <span class="deck-readonly-badge" role="status">
              <span>🔒</span>
              <span>{translateKey(AppStrings.Deck.ReadOnly)}</span>
            </span>
          {/if}

          {#if editMode && !profileStore.isCurrentProfileLocked}
            <Button
              variant="secondary"
              title={translateKey(AppStrings.Widgets.Grid.SettingsTitle)}
              ariaLabel={translateKey(AppStrings.Widgets.Grid.SettingsTitle)}
              onclick={openGridSettings}
            >
              <span>⚙</span>
              <span>{translateKey(AppStrings.Widgets.Grid.SettingsTitle)}</span>
            </Button>
          {/if}
        </div>
      </header>

      <main class="deck-grid-area">
        <DeckGrid
          cols={folderStore.currentCols}
          rows={folderStore.currentRows}
          widgets={folderStore.currentWidgets}
          background={folderStore.currentBackground}
          spacing={folderStore.currentSpacing}
          borderRadius={folderStore.currentBorderRadius}
          emptyCellStyle={folderStore.currentEmptyCellStyle}
          shadows={folderStore.currentShadows}
          {editMode}
          live
          {selectedWidgetId}
          oncellclick={handleCellClick}
          onwidgetclick={handleWidgetClick}
          onwidgettrigger={handleWidgetTrigger}
          onwidgetdelete={handleWidgetDelete}
          onwidgetcontextmenu={openWidgetContextMenu}
          onwidgetmove={handleWidgetMove}
          onshellDrop={handleShellDrop}
          {busyCell}
        />
      </main>

  {#if archiveImport.summary !== null && archiveAnchor !== null}
    <ArchivePreviewModal
      folderId={folderStore.selectedFolderId ?? ''}
      x={archiveAnchor.x}
      y={archiveAnchor.y}
      onimported={(count) => {
        showToast(`Imported ${count} widget(s).`, { variant: 'success' });
        archiveAnchor = null;
      }}
    />
  {/if}
  {#if widgetContextMenu !== null}
    <ContextMenu
      items={widgetContextMenuItems()}
      x={widgetContextMenu.x}
      y={widgetContextMenu.y}
      onselect={(id) => void onWidgetContextSelect(id)}
      onclose={() => (widgetContextMenu = null)}
    />
  {/if}
    </div>

    <FolderNavigation />
  {/if}
</div>

{#if creatingAtCell}
  <Modal
    heading={translateKey(AppStrings.Widgets.TypeSelector.Heading)}
    size="medium"
    showFooter
    onclose={() => { creatingAtCell = null; }}
  >
    <div class="type-picker">
      <input
        bind:this={typeSearchInput}
        class="form-input type-search"
        type="search"
        bind:value={typeQuery}
        placeholder={translateKey(AppStrings.Widgets.TypeSelector.SearchPlaceholder)}
        aria-label={translateKey(AppStrings.Widgets.TypeSelector.SearchAriaLabel)}
      />

      {#if typeChoices.builtIn.length > 0}
        <h3 class="type-group">
          {translateKey(AppStrings.Widgets.TypeSelector.GroupBuiltIn)}
        </h3>
        <div class="type-grid">
          {#each typeChoices.builtIn as choice (choice.id)}
            {@const previewData = previewDataFor(choice.id)}
            <button
              type="button"
              class="type-card"
              class:type-card-selected={selectedNewWidgetType === choice.id}
              aria-pressed={selectedNewWidgetType === choice.id}
              title={descriptionOf(choice) || widgetTypeName(choice.id)}
              onclick={() => chooseType(choice.id)}
            >
              <span class="type-card-preview">
                <WidgetPreview
                  widgetType={choice.id}
                  data={previewData}
                  width={76}
                  height={76}
                  sample
                  disabled
                />
              </span>
              <span class="type-card-name">{widgetTypeName(choice.id)}</span>
            </button>
          {/each}
        </div>
      {/if}

      {#if typeChoices.plugins.length > 0}
        <h3 class="type-group">
          {translateKey(AppStrings.Widgets.TypeSelector.GroupPlugins)}
        </h3>
        <div class="type-grid">
          {#each typeChoices.plugins as choice (choice.id)}
            {@const previewData = previewDataFor(choice.id)}
            <button
              type="button"
              class="type-card"
              class:type-card-selected={selectedNewWidgetType === choice.id}
              aria-pressed={selectedNewWidgetType === choice.id}
              title={descriptionOf(choice) || widgetTypeName(choice.id)}
              onclick={() => chooseType(choice.id)}
            >
              <span class="type-card-preview">
                <WidgetPreview
                  widgetType={choice.id}
                  data={previewData}
                  width={76}
                  height={76}
                  sample
                  disabled
                />
              </span>
              <span class="type-card-name">{widgetTypeName(choice.id)}</span>
              {#if choice.provider}
                <span class="type-card-provider">{choice.provider}</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}

      {#if typeChoices.total === 0}
        <p class="type-no-matches" role="status">
          {translateKey(AppStrings.Widgets.TypeSelector.NoMatches)}
        </p>
      {/if}

      <label class="form-label type-label-field">
        <span>{translateKey(AppStrings.Widgets.Editor.Label)}</span>
        <input
          type="text"
          class="form-input"
          placeholder={translateKey(AppStrings.Widgets.Editor.ButtonLabelPlaceholder)}
          bind:value={newWidgetLabel}
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              void handleConfirmAddWidget();
            }
          }}
        />
      </label>
    </div>

    {#snippet footer()}
      <Button variant="secondary" onclick={() => { creatingAtCell = null; }}>
        {translateKey(Strings.Common.Cancel)}
      </Button>
      <Button variant="primary" onclick={handleConfirmAddWidget}>
        {translateKey(Strings.Common.Save)}
      </Button>
    {/snippet}
  </Modal>
{/if}

{#if isEditingGridSettings}
  <Modal
    heading={translateKey(AppStrings.Widgets.Grid.SettingsTitle)}
    showFooter
    onclose={() => { isEditingGridSettings = false; }}
  >
    <div class="grid-settings-form">
      <div class="settings-row">
        <label class="form-label" for="grid-cols-input">
          <span>{translateKey(AppStrings.Widgets.GridSettings.Columns)}</span>
          <input
            id="grid-cols-input"
            type="number"
            class="form-input"
            min={folderStore.minCols}
            max={folderStore.maxCols}
            disabled={folderStore.colsLocked}
            bind:value={settingsCols}
          />
        </label>

        <label class="form-label" for="grid-rows-input">
          <span>{translateKey(AppStrings.Widgets.GridSettings.Rows)}</span>
          <input
            id="grid-rows-input"
            type="number"
            class="form-input"
            min={folderStore.minRows}
            max={folderStore.maxRows}
            disabled={folderStore.rowsLocked}
            bind:value={settingsRows}
          />
        </label>
      </div>

      <div class="settings-row">
        <label class="form-label" for="grid-spacing-input">
          <span>{translateKey(AppStrings.Widgets.GridSettings.WidgetSpacing)}</span>
          <input
            id="grid-spacing-input"
            type="number"
            class="form-input"
            min="0"
            max="64"
            disabled={!folderStore.spacingHonoured}
            bind:value={settingsSpacing}
          />
        </label>

        <label class="form-label" for="grid-radius-input">
          <span>{translateKey(AppStrings.Widgets.GridSettings.CornerRadius)}</span>
          <input
            id="grid-radius-input"
            type="number"
            class="form-input"
            min="0"
            max="60"
            disabled={!folderStore.cornerRadiusHonoured}
            bind:value={settingsBorderRadius}
          />
        </label>
      </div>

      <label class="form-label" for="grid-empty-style-select">
        <span>{translateKey(AppStrings.Widgets.GridSettings.EmptyCells)}</span>
        <select
          id="grid-empty-style-select"
          class="form-select"
          bind:value={settingsEmptyCellStyle}
        >
          <option value="visible">{translateKey(AppStrings.Widgets.GridSettings.EmptyCellsVisible)}</option>
          <option value="transparent">{translateKey(AppStrings.Widgets.GridSettings.EmptyCellsTransparent)}</option>
        </select>
      </label>
    </div>

    {#snippet footer()}
      <Button variant="secondary" onclick={() => { isEditingGridSettings = false; }}>
        {translateKey(Strings.Common.Cancel)}
      </Button>
      <Button variant="primary" onclick={handleSaveGridSettings}>
        {translateKey(Strings.Common.Save)}
      </Button>
    {/snippet}
  </Modal>
{/if}

<style>
  .deck-page {
    height: 100%;
    width: 100%;
    display: flex;
    position: relative;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    overflow: hidden;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .deck-state-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-6);
  }

  .state-message {
    font-size: var(--text-lg);
    color: var(--color-text-muted);
  }

  .error-message {
    font-size: var(--text-sm);
    color: var(--color-danger);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: ds-spin 0.8s linear infinite;
  }

  .deck-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
    overflow: hidden;
  }

  .deck-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-5);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    gap: var(--space-4);
  }

  .deck-title-area {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .deck-title-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .deck-title {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--font-bold);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .deck-subtitle {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .deck-header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .profile-select {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .profile-select:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .deck-readonly-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background-color: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
  }

  .deck-grid-area {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  .create-widget-form,
  .grid-settings-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3) 0;
  }

  .type-picker {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-bottom: var(--space-2);
  }

  .type-search {
    position: sticky;
    top: 0;
    z-index: 1;
    background-color: var(--color-bg-primary);
  }

  .type-group {
    margin: var(--space-2) 0 0;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
    gap: var(--space-2);
  }

  .type-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    cursor: pointer;
    min-width: 0;
  }

  .type-card:hover {
    border-color: var(--color-accent);
    background-color: var(--color-bg-hover);
  }

  .type-card-selected {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 1px var(--color-accent) inset;
    background-color: var(--color-accent-muted);
    color: var(--color-text-primary);
  }

  .type-card-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 76px;
    height: 76px;
    border-radius: 14px;
    overflow: hidden;
    background-color: var(--color-bg-primary);
    pointer-events: none;
  }

  .type-card-name {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    text-align: center;
    overflow-wrap: anywhere;
  }

  .type-card-provider {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    text-align: center;
  }

  .type-no-matches {
    margin: var(--space-3) 0;
    text-align: center;
    color: var(--color-text-muted);
  }

  .type-label-field {
    margin-top: var(--space-3);
  }

  .settings-row {
    display: flex;
    gap: var(--space-3);
  }

  .settings-row > * {
    flex: 1;
  }

  .form-label {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
  }

  .form-input,
  .form-select {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    box-sizing: border-box;
    width: 100%;
  }

  .form-input:focus,
  .form-select:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .form-input:disabled,
  .form-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @keyframes ds-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
