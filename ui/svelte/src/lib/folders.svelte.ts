/*
 * Folder and widget state, ported from the Angular FolderService.
 *
 * Folders hold grid widgets, layout settings (cols, rows, spacing, background),
 * and folder hierarchy. Widgets render on the Deck grid and execute actions when
 * clicked or triggered.
 *
 * All state is managed via Svelte 5 runes ($state) with read-only getters on
 * folderStore. WebSocket notifications keep folders and widgets in sync in real-time.
 */

import {
  type ActionButtonTriggerType,
  type ActionFlow,
  AppStrings,
  collectDisplayedWidgets,
  DEFAULT_EMPTY_CELL_STYLE,
  defaultWidgetData,
  type EmptyCellStyle,
  findFlowForTrigger,
  type Folder as DomainFolder,
  type FolderCreatedEvent,
  type FolderDeletedEvent,
  folderFromWire,
  type FolderMoveDirection,
  type FolderMoveRequest,
  type FolderNavigationEvent,
  type FoldersReorderedEvent,
  type FolderUpdatedEvent,
  type GridRect,
  type GridWidget,
  type IpcFolder,
  type IpcFolderPlacement,
  type IpcWidget,
  isColorReference,
  isFailureExecutionStatus,
  isWidgetGridView,
  type PinScope,
  type Profile,
  resolveLocalDeckNavigation,
  resolveLocalizedText,
  type Result,
  serializeWidgetData,
  type SetWidgetPinnedRequest,
  WIDGET_GRID_VIEW_ID,
  WIDGET_REFERENCE_GAP,
  type WidgetCreatedEvent,
  type WidgetData,
  type WidgetDeletedEvent,
  widgetFromWire,
  type WidgetPositionsUpdatedEvent,
  type WidgetsCreatedEvent,
  type WidgetsDeletedEvent,
  type WidgetsUpdatedEvent,
  WidgetType as DomainWidgetType,
  type WidgetUpdatedEvent,
} from '@macro-deck/runtime';
import { api, invoke, onConnected, onNotificationOf } from './api.svelte';
import { folderEndpoints, widgetEndpoints } from './endpoints';
import { localizationTranslator, translateKey } from './localization.svelte';
import { profileStore, selectProfile } from './profiles.svelte';
import { showToast } from './toasts.svelte';

export interface FolderContextMenuState {
  isOpen: boolean;
  folderId: string | null;
  x: number;
  y: number;
}

interface FolderLoad {
  profileId: string | null;
  createdFolders: Map<string, DomainFolder>;
  updatedFolders: Map<string, DomainFolder>;
  deletedFolderIds: Set<string>;
  reorderedPlacements: Map<string, IpcFolderPlacement>;
  promise: Promise<void>;
}

const DEFAULT_COLS = 5;
const DEFAULT_ROWS = 3;
const DEFAULT_BACKGROUND = '';

let folders = $state<DomainFolder[]>([]);
let selectedFolderId = $state<string | null>(null);
let isLoading = $state(false);
let loadError = $state<string | null>(null);
let navHistory = $state<Array<{ folderId: string; profileId: string | null }>>([]);
let contextMenu = $state<FolderContextMenuState>({
  isOpen: false,
  folderId: null,
  x: 0,
  y: 0,
});

let loadedProfileId: string | null = null;
let activeFolderLoad: FolderLoad | null = null;
let lastReportedFolderId: string | null = null;
let pendingNavigation: { folderId: string; token: string } | null = null;

let started = false;
let unsubscribes: Array<() => void> = [];

function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function generateId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function mapIpcFolder(ipc: IpcFolder): DomainFolder {
  return folderFromWire(ipc);
}

export function mapIpcWidget(ipc: IpcWidget, folderId: string): GridWidget {
  return widgetFromWire(ipc, folderId);
}

function resolveInherited<T>(
  folder: DomainFolder | undefined,
  pick: (f: DomainFolder) => T | null | undefined,
  pickProfile: (p: Profile) => T | null | undefined,
): T | null {
  const visited = new Set<string>();
  let current = folder;
  while (current && !visited.has(current.id)) {
    const value = pick(current);
    if (value !== null && value !== undefined) return value;
    visited.add(current.id);
    current = current.parentId !== null
      ? folders.find(f => f.id === current!.parentId)
      : undefined;
  }
  const profile = profileStore.selectedProfile;
  if (!profile) return null;
  const profileVal = pickProfile(profile);
  return profileVal ?? null;
}

export function findStartFolderId(foldersList: readonly DomainFolder[]): string | null {
  const roots = foldersList
    .filter(folder => folder.parentId === null)
    .slice()
    .sort((left, right) => left.order - right.order || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  return roots.find(folder => folder.isDefault)?.id ?? roots[0]?.id ?? null;
}

export const folderStore = {
  get folders(): readonly DomainFolder[] {
    return folders;
  },
  get selectedFolderId(): string | null {
    return selectedFolderId;
  },
  get selectedFolder(): DomainFolder | undefined {
    return folders.find(f => f.id === selectedFolderId);
  },
  get currentFolderName(): string {
    return this.selectedFolder?.name ?? 'Deck';
  },
  get currentCols(): number {
    return resolveInherited(this.selectedFolder, f => f.cols, p => p.defaultColumns) ?? DEFAULT_COLS;
  },
  get currentRows(): number {
    return resolveInherited(this.selectedFolder, f => f.rows, p => p.defaultRows) ?? DEFAULT_ROWS;
  },
  get currentBackground(): string {
    return this.selectedFolder?.background || profileStore.selectedProfile?.defaultBackground || DEFAULT_BACKGROUND;
  },
  get currentBackgroundSource(): string {
    const folder = this.selectedFolder;
    const profile = profileStore.selectedProfile;
    return folder?.backgroundSource || folder?.background
      || profile?.defaultBackgroundSource || profile?.defaultBackground || DEFAULT_BACKGROUND;
  },
  get currentWidgets(): readonly GridWidget[] {
    return collectDisplayedWidgets(folders, selectedFolderId);
  },
  get currentSpacing(): number {
    return resolveInherited(this.selectedFolder, f => f.spacing, p => p.defaultSpacing) ?? WIDGET_REFERENCE_GAP;
  },
  get currentBorderRadius(): number | null {
    return resolveInherited(this.selectedFolder, f => f.borderRadius, p => p.defaultBorderRadius);
  },
  get currentEmptyCellStyle(): EmptyCellStyle {
    return resolveInherited(this.selectedFolder, f => f.emptyCellStyle ?? null, p => p.defaultEmptyCellStyle ?? null)
      ?? DEFAULT_EMPTY_CELL_STYLE;
  },
  get currentInheritedEmptyCellStyle(): EmptyCellStyle {
    const parentId = this.selectedFolder?.parentId ?? null;
    const parent = parentId !== null ? folders.find(f => f.id === parentId) : undefined;
    return resolveInherited(parent, f => f.emptyCellStyle ?? null, p => p.defaultEmptyCellStyle ?? null)
      ?? DEFAULT_EMPTY_CELL_STYLE;
  },
  get currentShadows(): boolean {
    return profileStore.selectedProfile?.defaultShadows !== false;
  },
  get currentViewId(): string {
    return this.selectedFolder?.viewId ?? WIDGET_GRID_VIEW_ID;
  },
  get currentIsWidgetGrid(): boolean {
    return isWidgetGridView(this.currentViewId);
  },
  get minCols(): number {
    const widgets = this.currentWidgets;
    const widgetMin = widgets.length === 0 ? 1 : Math.max(...widgets.map(w => w.x + w.w));
    return Math.max(widgetMin, profileStore.selectedProfile?.layout.constraint?.minColumns ?? 1);
  },
  get minRows(): number {
    const widgets = this.currentWidgets;
    const widgetMin = widgets.length === 0 ? 1 : Math.max(...widgets.map(w => w.y + w.h));
    return Math.max(widgetMin, profileStore.selectedProfile?.layout.constraint?.minRows ?? 1);
  },
  get maxCols(): number {
    return profileStore.selectedProfile?.layout.constraint?.maxColumns ?? 16;
  },
  get maxRows(): number {
    return profileStore.selectedProfile?.layout.constraint?.maxRows ?? 16;
  },
  get colsLocked(): boolean {
    return profileStore.selectedProfile?.layout.constraint?.columnsLocked ?? false;
  },
  get rowsLocked(): boolean {
    return profileStore.selectedProfile?.layout.constraint?.rowsLocked ?? false;
  },
  get spacingHonoured(): boolean {
    return profileStore.selectedProfile?.layout.constraint?.widgetSpacingHonoured ?? true;
  },
  get cornerRadiusHonoured(): boolean {
    return profileStore.selectedProfile?.layout.constraint?.cornerRadiusHonoured ?? true;
  },
  get customFolderViewsSupported(): boolean {
    return profileStore.selectedProfile?.layout.constraint?.customFolderViewsSupported ?? true;
  },
  get canGoBack(): boolean {
    return navHistory.length > 0 || !!this.selectedFolder?.parentId;
  },
  get navDepth(): number {
    return navHistory.length;
  },
  get rootFolders(): readonly DomainFolder[] {
    return folders
      .filter(f => f.parentId === null)
      .slice()
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  },
  get startFolderId(): string | null {
    return findStartFolderId(folders);
  },
  get contextMenu(): FolderContextMenuState {
    return contextMenu;
  },
  get isLoading(): boolean {
    return isLoading;
  },
  get loadError(): string | null {
    return loadError;
  },
};

export function getEffectiveSpacing(folder: DomainFolder): number {
  return resolveInherited(folder, f => f.spacing, p => p.defaultSpacing) ?? WIDGET_REFERENCE_GAP;
}

export function getEffectiveCols(folder: DomainFolder): number {
  return resolveInherited(folder, f => f.cols, p => p.defaultColumns) ?? DEFAULT_COLS;
}

export function getEffectiveRows(folder: DomainFolder): number {
  return resolveInherited(folder, f => f.rows, p => p.defaultRows) ?? DEFAULT_ROWS;
}

export function getFolderById(id: string): DomainFolder | undefined {
  return folders.find(f => f.id === id);
}

export function getChildFolders(parentId: string): DomainFolder[] {
  return folders
    .filter(f => f.parentId === parentId)
    .slice()
    .sort((a, b) => a.order - b.order);
}

export function findWidget(widgetId: string): GridWidget | undefined {
  for (const folder of folders) {
    const widget = folder.widgets.find(w => w.id === widgetId);
    if (widget) return widget;
  }
  return undefined;
}

function resolveFolderId(widgetId: string): string | null {
  return findWidget(widgetId)?.folderId ?? selectedFolderId;
}

function getAllDescendantIds(folderId: string): string[] {
  const children = getChildFolders(folderId);
  let ids: string[] = [];
  for (const child of children) {
    ids.push(child.id);
    ids = ids.concat(getAllDescendantIds(child.id));
  }
  return ids;
}

export function canDeleteFolder(id: string): boolean {
  if (folders.length <= 1) return false;
  const idsToDelete = getAllDescendantIds(id);
  idsToDelete.push(id);
  const remaining = folders.filter(f => !idsToDelete.includes(f.id));
  return remaining.length > 0;
}

export function deletionScope(folderId: string): {
  name: string;
  subfolderCount: number;
  widgetCount: number;
  pinnedCount: number;
} | null {
  const folder = getFolderById(folderId);
  if (!folder) return null;

  const descendantIds = getAllDescendantIds(folderId);
  const subtreeIds = new Set([folderId, ...descendantIds]);
  const subtreeWidgets = folders
    .filter(f => subtreeIds.has(f.id))
    .flatMap(f => f.widgets);

  return {
    name: folder.name,
    subfolderCount: descendantIds.length,
    widgetCount: subtreeWidgets.length,
    pinnedCount: subtreeWidgets.filter(w => w.isPinned).length,
  };
}

function reportFolderChanged(folderId: string, navigationToken?: string, isResync?: boolean): void {
  void invoke('ReportFolderChanged', {
    folderId,
    clientId: api.clientId,
    navigationToken,
    isResync,
  });
}

function pushNavHistory(): void {
  if (selectedFolderId) {
    navHistory = [...navHistory, { folderId: selectedFolderId, profileId: profileStore.selectedProfileId }];
    if (navHistory.length > 50) {
      navHistory = navHistory.slice(1);
    }
  }
}

function navigateTo(folderId: string, profileId: string | null): void {
  if (profileId && profileId !== profileStore.selectedProfileId) {
    selectProfile(profileId);
  }
  selectedFolderId = folderId;
  notifyFolderChange(folderId);
}

function notifyFolderChange(folderId: string): void {
  if (folderId === lastReportedFolderId) return;
  lastReportedFolderId = folderId;
  const token = pendingNavigation?.folderId === folderId ? pendingNavigation.token : undefined;
  pendingNavigation = null;
  reportFolderChanged(folderId, token);
}

function handleNavigation(event: FolderNavigationEvent): void {
  switch (event.command) {
    case 'changeTo':
      if (event.folderId) {
        if (event.navigationToken) {
          pendingNavigation = { folderId: event.folderId, token: event.navigationToken };
        }
        pushNavHistory();
        navigateTo(event.folderId, event.profileId ?? null);
      }
      break;
    case 'parent': {
      const parentId = folderStore.selectedFolder?.parentId;
      if (parentId) {
        pushNavHistory();
        navigateTo(parentId, profileStore.selectedProfileId);
      }
      break;
    }
    case 'back': {
      if (navHistory.length === 0) break;
      const previous = navHistory[navHistory.length - 1];
      navHistory = navHistory.slice(0, -1);
      if (previous) {
        navigateTo(previous.folderId, previous.profileId);
      }
      break;
    }
  }
}

export function selectFolder(id: string): void {
  closeContextMenu();
  pushNavHistory();
  selectedFolderId = id;
  notifyFolderChange(id);
}

export function goBack(): void {
  handleNavigation({ command: navHistory.length > 0 ? 'back' : 'parent' });
}

export function toggleFolderExpanded(id: string): void {
  closeContextMenu();
  folders = folders.map(f => (f.id === id ? { ...f, isExpanded: !f.isExpanded } : f));
}

export function expandFolder(id: string): void {
  folders = folders.map(f => (f.id === id ? { ...f, isExpanded: true } : f));
}

export function openContextMenu(folderId: string, x: number, y: number): void {
  selectedFolderId = folderId;
  contextMenu = { isOpen: true, folderId, x, y };
}

export function closeContextMenu(): void {
  contextMenu = { isOpen: false, folderId: null, x: 0, y: 0 };
}

function isInActiveFolderScope(profileId: string | undefined): boolean {
  const scopedProfileId = activeFolderLoad?.profileId ?? loadedProfileId;
  return scopedProfileId === null || profileId === scopedProfileId;
}

function addCreatedFolder(folder: DomainFolder): void {
  if (folders.some(current => current.id === folder.id)) return;
  folders = [...folders, folder];
}

function selectKnownStartOrReload(foldersList: DomainFolder[]): void {
  const startFolder = foldersList.find(f => f.parentId === null && f.isDefault);
  if (startFolder) {
    selectedFolderId = startFolder.id;
    notifyFolderChange(startFolder.id);
    return;
  }
  selectedFolderId = null;
  void loadFolders();
}

function mergeFolderLoadResponse(loaded: DomainFolder[], load: FolderLoad): DomainFolder[] {
  const merged = new Map(loaded.map(folder => [folder.id, folder]));
  for (const folder of load.createdFolders.values()) {
    merged.set(folder.id, folder);
  }
  for (const updated of load.updatedFolders.values()) {
    const existing = merged.get(updated.id);
    if (existing) {
      merged.set(updated.id, { ...updated, isExpanded: existing.isExpanded });
    }
  }
  for (const id of load.deletedFolderIds) {
    merged.delete(id);
  }
  for (const placement of load.reorderedPlacements.values()) {
    const existing = merged.get(placement.id);
    if (existing) {
      merged.set(placement.id, {
        ...existing,
        parentId: placement.parentId,
        order: placement.order,
        isDefault: placement.isDefault,
      });
    }
  }
  return [...merged.values()];
}

function applyCanonicalPlacements(placements: IpcFolderPlacement[]): void {
  const byId = new Map(placements.map(p => [p.id, p]));
  folders = folders.map(f => {
    const placement = byId.get(f.id);
    return placement
      ? { ...f, parentId: placement.parentId, order: placement.order, isDefault: placement.isDefault }
      : f;
  });
}

export async function loadFolders(profileId?: string): Promise<void> {
  const targetProfileId = profileId ?? profileStore.selectedProfileId ?? null;
  if (activeFolderLoad?.profileId === targetProfileId) {
    return activeFolderLoad.promise;
  }

  let resolveLoad: (() => void) | undefined;
  const promise = new Promise<void>(resolve => {
    resolveLoad = resolve;
  });
  const load: FolderLoad = {
    profileId: targetProfileId,
    createdFolders: new Map(),
    updatedFolders: new Map(),
    deletedFolderIds: new Set(),
    reorderedPlacements: new Map(),
    promise,
  };
  activeFolderLoad = load;

  isLoading = true;
  loadError = null;

  try {
    const response = await folderEndpoints.list(targetProfileId ?? undefined);
    if (activeFolderLoad !== load) return;

    const mappedFolders = (response.folders ?? []).map(f => mapIpcFolder(f));
    const merged = mergeFolderLoadResponse(mappedFolders, load);
    loadedProfileId = load.profileId ?? response.folders?.[0]?.profileId ?? null;
    folders = merged;

    if (!selectedFolderId || !folders.some(f => f.id === selectedFolderId)) {
      const startId = findStartFolderId(folders);
      selectedFolderId = startId;
      if (startId) notifyFolderChange(startId);
    }
  } catch (error) {
    if (activeFolderLoad !== load) return;
    console.error('Failed to load folders:', error);
    loadError = error instanceof Error ? error.message : translateKey(AppStrings.Errors.Folder.LoadFailed);
  } finally {
    if (activeFolderLoad === load) {
      activeFolderLoad = null;
      isLoading = false;
      resolveLoad?.();
    }
  }
}

export async function setStartFolder(id: string): Promise<void> {
  const folder = getFolderById(id);
  if (!folder || folder.parentId !== null) {
    console.error('Only a root folder can become the start folder.');
    return;
  }

  const previousFolders = folders;
  folders = folders.map(f => ({ ...f, isDefault: f.id === id }));
  try {
    const response = await folderEndpoints.update({ id, isDefault: true });
    if (!response.success) {
      folders = previousFolders;
      console.error('Failed to set start folder:', response.error?.message);
    }
  } catch (error) {
    folders = previousFolders;
    console.error('Failed to set start folder:', error);
  }
}

export async function setGridDimensions(cols: number | null, rows: number | null): Promise<Result> {
  const folderId = selectedFolderId;
  if (!folderId) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: translateKey(AppStrings.Errors.Folder.NoFolderSelected) },
    };
  }

  const previous = getFolderById(folderId);
  const rollback = () => {
    if (!previous) return;
    folders = folders.map(f => (f.id === folderId ? { ...f, cols: previous.cols, rows: previous.rows } : f));
  };

  folders = folders.map(f => (f.id === folderId ? { ...f, cols, rows } : f));

  try {
    const response = await folderEndpoints.update({ id: folderId, columns: cols ?? -1, rows: rows ?? -1 });
    if (!response.success) {
      rollback();
      return { success: false, error: response.error };
    }
    return { success: true };
  } catch (error) {
    rollback();
    console.error(`Failed to persist grid dimensions for folder ${folderId}:`, error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : translateKey(AppStrings.Errors.Folder.ResizeGridFailed),
      },
    };
  }
}

export async function setBackground(background: string): Promise<void> {
  const folderId = selectedFolderId;
  if (!folderId) return;

  const isReference = isColorReference(background);
  folders = folders.map(f => {
    if (f.id !== folderId) return f;
    const { backgroundSource: _previous, ...rest } = f;
    return isReference ? { ...rest, backgroundSource: background } : { ...rest, background };
  });

  try {
    await folderEndpoints.update(
      isReference
        ? { id: folderId, backgroundColorSource: background }
        : { id: folderId, backgroundColor: background, backgroundColorSource: background },
    );
  } catch (error) {
    console.error(`Failed to persist background color for folder ${folderId}:`, error);
  }
}

export async function setWidgetSpacing(spacing: number | null): Promise<void> {
  const folderId = selectedFolderId;
  if (!folderId) return;

  folders = folders.map(f => (f.id === folderId ? { ...f, spacing } : f));

  try {
    await folderEndpoints.update({ id: folderId, widgetSpacing: spacing ?? -1 });
  } catch (error) {
    console.error(`Failed to persist widget spacing for folder ${folderId}:`, error);
  }
}

export async function setEmptyCellStyle(emptyCellStyle: EmptyCellStyle | null): Promise<void> {
  const folderId = selectedFolderId;
  if (!folderId) return;

  folders = folders.map(f => (f.id === folderId ? { ...f, emptyCellStyle } : f));

  try {
    await folderEndpoints.update({ id: folderId, emptyCellStyle: emptyCellStyle ?? '' });
  } catch (error) {
    console.error(`Failed to persist empty cell style for folder ${folderId}:`, error);
  }
}

export async function setWidgetBorderRadius(borderRadius: number | null): Promise<void> {
  const folderId = selectedFolderId;
  if (!folderId) return;

  folders = folders.map(f => (f.id === folderId ? { ...f, borderRadius } : f));

  try {
    await folderEndpoints.update({ id: folderId, widgetBorderRadius: borderRadius ?? -1 });
  } catch (error) {
    console.error(`Failed to persist widget border radius for folder ${folderId}:`, error);
  }
}

export async function setFolderView(
  folderId: string,
  folderViewId: string,
  folderViewConfiguration: string | null = null,
): Promise<Result<DomainFolder>> {
  try {
    const response = await folderEndpoints.update({
      id: folderId,
      folderViewId,
      folderViewConfiguration: folderViewConfiguration ?? undefined,
    });

    if (!response.success || !response.folder) {
      return { success: false, error: response.error };
    }

    const folder = mapIpcFolder(response.folder);
    folders = folders.map(f => (f.id === folder.id ? folder : f));

    return { success: true, data: folder };
  } catch (error) {
    console.error(`Failed to set folder view for folder ${folderId}:`, error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: translateKey(AppStrings.Errors.Folder.NoFolderReturned),
      },
    };
  }
}

export async function createFolder(
  name: string,
  parentId: string | null = null,
  folderViewId: string | null = null,
  folderViewConfiguration: string | null = null,
): Promise<Result<DomainFolder>> {
  const profileId = profileStore.selectedProfileId;
  if (!profileId) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: translateKey(AppStrings.Errors.Folder.NoProfileSelected) },
    };
  }

  try {
    const response = await folderEndpoints.create({
      profileId,
      name,
      parentId: parentId ?? undefined,
      folderViewId: folderViewId ?? undefined,
      folderViewConfiguration: folderViewConfiguration ?? undefined,
    });

    if (!response.success) {
      return { success: false, error: response.error };
    }

    if (!response.folder) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: translateKey(AppStrings.Errors.Folder.NoFolderReturned) },
      };
    }

    const folder = mapIpcFolder(response.folder);

    if (!folders.some(f => f.id === folder.id)) {
      folders = [...folders, folder];
    }

    if (parentId) {
      expandFolder(parentId);
    }

    selectedFolderId = folder.id;
    notifyFolderChange(folder.id);
    return { success: true, data: folder };
  } catch (error) {
    console.error('Failed to create folder:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : translateKey(AppStrings.Errors.Folder.CreateFailed),
      },
    };
  }
}

export async function renameFolder(id: string, newName: string): Promise<Result<DomainFolder>> {
  try {
    const response = await folderEndpoints.update({ id, name: newName });

    if (!response.success) {
      return { success: false, error: response.error };
    }

    folders = folders.map(f => (f.id === id ? { ...f, name: newName } : f));
    return { success: true, data: getFolderById(id) };
  } catch (error) {
    console.error('Failed to rename folder:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : translateKey(AppStrings.Errors.Folder.RenameFailed),
      },
    };
  }
}

export async function deleteFolder(id: string): Promise<Result> {
  if (!canDeleteFolder(id)) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: translateKey(AppStrings.Errors.Folder.CannotDeleteLastFolder) },
    };
  }

  try {
    const response = await folderEndpoints.delete(id);

    if (!response.success) {
      return { success: false, error: response.error };
    }

    const idsToDelete = getAllDescendantIds(id);
    idsToDelete.push(id);

    const currentSelectedId = selectedFolderId;
    if (currentSelectedId && idsToDelete.includes(currentSelectedId)) {
      const folder = getFolderById(id);
      if (folder?.parentId) {
        selectedFolderId = folder.parentId;
        notifyFolderChange(folder.parentId);
      } else {
        const remaining = folders.filter(f => !idsToDelete.includes(f.id));
        selectKnownStartOrReload(remaining);
      }
    }

    folders = folders.filter(f => !idsToDelete.includes(f.id));
    return { success: true };
  } catch (error) {
    console.error('Failed to delete folder:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : translateKey(AppStrings.Errors.Folder.DeleteFailed),
      },
    };
  }
}

export async function duplicateFolder(id: string): Promise<Result<DomainFolder>> {
  try {
    const response = await folderEndpoints.duplicate(id);

    if (!response.success) {
      return { success: false, error: response.error };
    }

    if (!response.folder) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: translateKey(AppStrings.Errors.Folder.NoFolderReturned) },
      };
    }

    const folder = mapIpcFolder(response.folder);
    if (!folders.some(f => f.id === folder.id)) {
      folders = [...folders, folder];
    }
    selectedFolderId = folder.id;
    notifyFolderChange(folder.id);

    return { success: true, data: folder };
  } catch (error) {
    console.error('Failed to duplicate folder:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : translateKey(AppStrings.Errors.Folder.DuplicateFailed),
      },
    };
  }
}

function applyLocalPlacement(
  foldersList: DomainFolder[],
  folder: DomainFolder,
  target: DomainFolder,
  position: FolderMoveRequest['position'],
): DomainFolder[] {
  const newParentId = position === 'inside' ? target.id : target.parentId;
  const oldParentId = folder.parentId;

  const destination = foldersList
    .filter(f => f.parentId === newParentId && f.id !== folder.id)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  let index: number;
  if (position === 'inside') {
    index = destination.length;
  } else {
    const targetIndex = destination.findIndex(f => f.id === target.id);
    const fallback = destination.length;
    index = targetIndex === -1 ? fallback : position === 'before' ? targetIndex : targetIndex + 1;
  }
  destination.splice(Math.max(0, Math.min(index, destination.length)), 0, folder);

  const orderById = new Map<string, number>();
  destination.forEach((f, i) => orderById.set(f.id, i));

  if (oldParentId !== newParentId) {
    const source = foldersList
      .filter(f => f.parentId === oldParentId && f.id !== folder.id)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    source.forEach((f, i) => orderById.set(f.id, i));
  }

  return foldersList.map(f => {
    if (f.id === folder.id) {
      return { ...f, parentId: newParentId, order: orderById.get(f.id) ?? f.order };
    }
    const order = orderById.get(f.id);
    return order !== undefined ? { ...f, order } : f;
  });
}

export function resolveMove(folderId: string, direction: FolderMoveDirection): FolderMoveRequest | null {
  const folder = getFolderById(folderId);
  if (!folder) return null;

  const siblings = folder.parentId === null ? [...folderStore.rootFolders] : getChildFolders(folder.parentId);
  const index = siblings.findIndex(f => f.id === folderId);
  if (index === -1) return null;

  switch (direction) {
    case 'up': {
      const previous = siblings[index - 1];
      return previous ? { folderId, targetId: previous.id, position: 'before' } : null;
    }
    case 'down': {
      const next = siblings[index + 1];
      return next ? { folderId, targetId: next.id, position: 'after' } : null;
    }
    case 'into': {
      const previous = siblings[index - 1];
      return previous ? { folderId, targetId: previous.id, position: 'inside' } : null;
    }
    case 'out':
      return folder.parentId !== null ? { folderId, targetId: folder.parentId, position: 'after' } : null;
  }
}

export async function moveFolder(request: FolderMoveRequest): Promise<Result<void>> {
  const folder = getFolderById(request.folderId);
  const target = getFolderById(request.targetId);
  if (!folder || !target) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: translateKey(AppStrings.Errors.Folder.NotFound) },
    };
  }
  if (request.targetId === request.folderId) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: translateKey(AppStrings.Errors.Folder.CannotMoveOntoItself) },
    };
  }

  const newParentId = request.position === 'inside' ? target.id : target.parentId;
  if (newParentId !== null) {
    const descendants = getAllDescendantIds(folder.id);
    if (newParentId === folder.id || descendants.includes(newParentId)) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: translateKey(AppStrings.Errors.Folder.CannotMoveIntoDescendant),
        },
      };
    }
  }

  const previousFolders = folders;
  const deferStartFolderMove = folder.isDefault && newParentId !== null;
  if (!deferStartFolderMove) {
    folders = applyLocalPlacement(previousFolders, folder, target, request.position);
  }
  if (request.position === 'inside') {
    expandFolder(target.id);
  }

  try {
    const response = await folderEndpoints.move({
      id: request.folderId,
      targetId: request.targetId,
      position: request.position,
    });
    if (!response.success) {
      folders = previousFolders;
      return { success: false, error: response.error };
    }

    if (response.folders?.length) {
      applyCanonicalPlacements(response.folders);
    }
    return { success: true };
  } catch (error) {
    folders = previousFolders;
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : translateKey(AppStrings.Errors.Folder.MoveFailed),
      },
    };
  }
}

export async function addWidgetAt(x: number, y: number, type: DomainWidgetType): Promise<GridWidget | null> {
  const folderId = selectedFolderId;
  if (!folderId) return null;
  const folder = folderStore.selectedFolder;
  if (!folder) return null;

  const isOccupied = folderStore.currentWidgets.some(
    w => x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h,
  );
  if (isOccupied) return null;

  const tempWidgetId = generateId();
  const initialData = defaultWidgetData(type);
  const newWidget: GridWidget = {
    id: tempWidgetId,
    folderId,
    x,
    y,
    w: 1,
    h: 1,
    type,
    data: initialData,
  };

  folders = folders.map(f => (f.id === folderId ? { ...f, widgets: [...f.widgets, newWidget] } : f));

  try {
    const response = await widgetEndpoints.create({
      folderId,
      type,
      positionX: x,
      positionY: y,
      width: 1,
      height: 1,
      data: serializeWidgetData(type, newWidget.data),
    });

    if (response.success && response.widget) {
      const createdWidget = mapIpcWidget(response.widget, folderId);
      folders = folders.map(f =>
        f.id === folderId
          ? {
              ...f,
              widgets: [...f.widgets.filter(w => w.id !== tempWidgetId && w.id !== createdWidget.id), createdWidget],
            }
          : f,
      );
      return createdWidget;
    }
  } catch (error) {
    console.error('Failed to create widget:', error);
  }

  // Rollback on failure
  folders = folders.map(f => (f.id === folderId ? { ...f, widgets: f.widgets.filter(w => w.id !== tempWidgetId) } : f));
  return null;
}

export function updateWidgetData(widgetId: string, dataUpdates: Partial<WidgetData>): void {
  const folderId = resolveFolderId(widgetId);
  if (!folderId) return;
  folders = folders.map(f =>
    f.id === folderId
      ? {
          ...f,
          widgets: f.widgets.map(w => (w.id === widgetId ? { ...w, data: { ...w.data, ...dataUpdates } } : w)),
        }
      : f,
  );
}

/**
 * Creates an application widget from a path dropped onto the deck: the host
 * reads the executable's icon and builds the widget, so the client sends one
 * request and adopts the widget it answers with.
 */
export async function addWidgetFromApplication(x: number, y: number, path: string): Promise<Result<GridWidget>> {
  const folderId = selectedFolderId;
  if (!folderId) {
    return {
      success: false,
      error: { code: 'NoFolder', message: translateKey(AppStrings.Errors.Folder.NoFolderOpen) },
    };
  }

  try {
    const response = await widgetEndpoints.createFromApplication({
      folderId,
      positionX: x,
      positionY: y,
      path,
    });

    if (!response.success || !response.widget) {
      return { success: false, error: response.error };
    }

    const createdWidget = mapIpcWidget(response.widget, folderId);
    folders = folders.map(f =>
      f.id === folderId
        ? { ...f, widgets: [...f.widgets.filter(w => w.id !== createdWidget.id), createdWidget] }
        : f,
    );

    return { success: true, data: createdWidget };
  } catch (error) {
    console.error('Failed to create widget from application:', error);
    return {
      success: false,
      error: {
        code: 'RequestFailed',
        message: error instanceof Error ? error.message : translateKey(AppStrings.Errors.Folder.AddApplicationFailed),
      },
    };
  }
}

export async function removeWidget(widgetId: string, targetFolderId?: string): Promise<void> {
  const folderId = targetFolderId ?? resolveFolderId(widgetId);
  if (!folderId) return;

  folders = folders.map(f => (f.id === folderId ? { ...f, widgets: f.widgets.filter(w => w.id !== widgetId) } : f));

  try {
    await widgetEndpoints.delete({ id: widgetId, folderId });
  } catch (error) {
    console.error('Failed to delete widget:', error);
  }
}

export async function removeWidgets(widgetIds: readonly string[], targetFolderId?: string): Promise<Result> {
  const folderId = targetFolderId ?? selectedFolderId;
  if (!folderId) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: translateKey(AppStrings.Errors.Folder.NoFolderSelected) },
    };
  }
  if (widgetIds.length === 0) return { success: true };

  const previousWidgets = getFolderById(folderId)?.widgets;
  const idSet = new Set(widgetIds);
  const rollback = () => {
    if (!previousWidgets) return;
    folders = folders.map(f => (f.id === folderId ? { ...f, widgets: previousWidgets } : f));
  };

  folders = folders.map(f => (f.id === folderId ? { ...f, widgets: f.widgets.filter(w => !idSet.has(w.id)) } : f));

  try {
    const response = await widgetEndpoints.deleteBatch({ folderId, ids: [...widgetIds] });
    if (!response.success) {
      rollback();
      return { success: false, error: response.error };
    }
    return { success: true };
  } catch (error) {
    rollback();
    console.error('Failed to delete widgets:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : translateKey(AppStrings.Errors.Folder.DeleteWidgetsFailed),
      },
    };
  }
}

export async function updateWidget(widgetId: string, updates: Partial<GridWidget>): Promise<boolean> {
  const folderId = resolveFolderId(widgetId);
  if (!folderId) return false;

  const existingWidget = findWidget(widgetId);
  if (!existingWidget) return false;

  folders = folders.map(f =>
    f.id === folderId
      ? {
          ...f,
          widgets: f.widgets.map(w => (w.id === widgetId ? { ...w, ...updates } : w)),
        }
      : f,
  );

  if (!isGuid(widgetId) || !isGuid(folderId)) {
    return false;
  }

  const rollback = () => {
    folders = folders.map(f =>
      f.id === folderId
        ? {
            ...f,
            widgets: f.widgets.map(w => (w.id === widgetId ? existingWidget : w)),
          }
        : f,
    );
  };

  const merged = { ...existingWidget, ...updates };
  try {
    const response = await widgetEndpoints.update({
      id: widgetId,
      folderId,
      type: merged.type,
      positionX: merged.x,
      positionY: merged.y,
      width: merged.w,
      height: merged.h,
      data: serializeWidgetData(merged.type, merged.data),
    });
    if (!response.success) {
      rollback();
      return false;
    }
    return true;
  } catch (error) {
    rollback();
    console.error('Failed to update widget:', error);
    return false;
  }
}

export async function commitWidgetLayout(changes: ReadonlyMap<string, GridRect>): Promise<Result> {
  const folderId = selectedFolderId;
  if (!folderId || changes.size === 0) return { success: true };
  if (!isGuid(folderId)) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: translateKey(AppStrings.Errors.Folder.InvalidFolderId) },
    };
  }

  const folder = getFolderById(folderId);
  if (!folder) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: translateKey(AppStrings.Errors.Folder.NotFound) },
    };
  }

  const previousRects = new Map<string, GridRect>();
  for (const widget of folder.widgets) {
    if (changes.has(widget.id)) {
      previousRects.set(widget.id, { x: widget.x, y: widget.y, w: widget.w, h: widget.h });
    }
  }

  const applyRects = (rects: ReadonlyMap<string, GridRect>) => {
    folders = folders.map(f =>
      f.id === folderId
        ? {
            ...f,
            widgets: f.widgets.map(w => {
              const rect = rects.get(w.id);
              return rect ? { ...w, x: rect.x, y: rect.y, w: rect.w, h: rect.h } : w;
            }),
          }
        : f,
    );
  };

  applyRects(changes);

  try {
    const response = await widgetEndpoints.updatePositions({
      folderId,
      positions: [...changes.entries()].map(([id, rect]) => ({
        id,
        positionX: rect.x,
        positionY: rect.y,
        width: rect.w,
        height: rect.h,
      })),
    });
    if (!response.success) {
      applyRects(previousRects);
      return { success: false, error: response.error };
    }
    return { success: true };
  } catch (error) {
    applyRects(previousRects);
    console.error('Failed to commit widget layout:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : translateKey(AppStrings.Errors.Folder.CommitLayoutFailed),
      },
    };
  }
}

export async function setWidgetPinned(widgetId: string, pinned: boolean, scope?: PinScope): Promise<Result> {
  const widget = findWidget(widgetId);
  if (!widget) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: translateKey(AppStrings.Errors.Folder.WidgetNotFound) },
    };
  }

  try {
    const request: SetWidgetPinnedRequest = { widgetId, folderId: widget.folderId, pinned };
    if (scope !== undefined) {
      request.scope = scope;
    }
    const response = await widgetEndpoints.setPinned(request);
    if (!response.success) {
      return { success: false, error: response.error };
    }

    const responseWidget = response.widget;
    folders = folders.map(f =>
      f.id === widget.folderId
        ? {
            ...f,
            widgets: f.widgets.map(w => {
              if (w.id !== widgetId) return w;
              if (responseWidget) {
                const mapped = mapIpcWidget(responseWidget, widget.folderId);
                return { ...mapped, data: responseWidget.data ? mapped.data : w.data };
              }
              return { ...w, isPinned: pinned, pinScope: pinned ? (scope ?? w.pinScope ?? 'Profile') : 'Profile' };
            }),
          }
        : f,
    );
    return { success: true };
  } catch (error) {
    console.error('Failed to change widget pin state:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : translateKey(AppStrings.Errors.Folder.ChangeWidgetPinFailed),
      },
    };
  }
}

export async function executeActionButtonTrigger(
  widget: GridWidget,
  triggerType: ActionButtonTriggerType,
): Promise<void> {
  const folderId = widget.folderId || selectedFolderId;
  if (!folderId) return;

  const claimsOwnGesture: readonly DomainWidgetType[] = [
    DomainWidgetType.ActionButton,
    DomainWidgetType.Slider,
    DomainWidgetType.Countdown,
    DomainWidgetType.Stopwatch,
  ];
  if (claimsOwnGesture.includes(widget.type)) return;

  const data = widget.data as { flows?: ActionFlow[] };
  const flows = data?.flows;
  if (Array.isArray(flows)) {
    const localNavigation = resolveLocalDeckNavigation(flows, triggerType);
    if (localNavigation) {
      if (localNavigation.command !== 'changeTo' || getFolderById(localNavigation.folderId)) {
        handleNavigation({
          command: localNavigation.command,
          folderId: localNavigation.command === 'changeTo' ? localNavigation.folderId : undefined,
        });
        return;
      }
    } else if (triggerType !== 'onShortPress') {
      const flow = findFlowForTrigger(flows, triggerType);
      if (!flow || flow.children.length === 0) return;
    }
  }

  if (!isGuid(widget.id) || !isGuid(folderId)) {
    return;
  }

  try {
    const response = await widgetEndpoints.executeTrigger({
      widgetId: widget.id,
      folderId,
      triggerType,
      clientId: api.clientId,
    });

    if (isFailureExecutionStatus(response.status) || !response.success) {
      const message = resolveLocalizedText(response.error?.message, localizationTranslator);
      showToast(message || translateKey(AppStrings.Errors.Folder.ActionRunFailed), { variant: 'error' });
    }
  } catch (error) {
    console.error('Failed to execute action-button trigger:', error);
    showToast(translateKey(AppStrings.Errors.Folder.ActionRunFailed), { variant: 'error' });
  }
}

export function startFolders(): void {
  if (started) return;
  started = true;

  unsubscribes = [
    onConnected(() => {
      if (selectedFolderId) {
        reportFolderChanged(selectedFolderId, undefined, true);
      }
    }),

    onNotificationOf<FolderCreatedEvent>('FolderCreatedEvent', event => {
      if (!event.folder) return;
      const folder = mapIpcFolder(event.folder);
      if (!isInActiveFolderScope(event.folder.profileId)) return;

      const activeLoad = activeFolderLoad;
      if (activeLoad && (activeLoad.profileId === null || activeLoad.profileId === event.folder.profileId)) {
        activeLoad.createdFolders.set(folder.id, folder);
        activeLoad.deletedFolderIds.delete(folder.id);
      }

      if (!activeLoad || activeLoad.profileId === loadedProfileId) {
        addCreatedFolder(folder);
      }
    }),

    onNotificationOf<FolderUpdatedEvent>('FolderUpdatedEvent', event => {
      if (!event.folder) return;
      const updated = mapIpcFolder(event.folder);
      if (!isInActiveFolderScope(event.folder.profileId)) return;

      const activeLoad = activeFolderLoad;
      if (activeLoad && (activeLoad.profileId === null || activeLoad.profileId === event.folder.profileId)) {
        activeLoad.updatedFolders.set(updated.id, updated);
      }

      if (activeLoad && activeLoad.profileId !== loadedProfileId) return;
      folders = folders.map(f => (f.id === updated.id ? { ...updated, isExpanded: f.isExpanded } : f));
      if (updated.isDefault && updated.parentId === null && selectedFolderId === null) {
        selectedFolderId = updated.id;
        notifyFolderChange(updated.id);
      }
    }),

    onNotificationOf<FolderDeletedEvent>('FolderDeletedEvent', event => {
      if (!event.folderId) return;
      const activeLoad = activeFolderLoad;
      if (activeLoad) {
        activeLoad.deletedFolderIds.add(event.folderId);
        activeLoad.createdFolders.delete(event.folderId);
        activeLoad.updatedFolders.delete(event.folderId);
      }

      if (activeLoad && activeLoad.profileId !== loadedProfileId) return;

      navHistory = navHistory.filter(entry => entry.folderId !== event.folderId);

      const remaining = folders.filter(folder => folder.id !== event.folderId);
      folders = remaining;
      if (selectedFolderId === event.folderId) {
        selectKnownStartOrReload(remaining);
      }
    }),

    onNotificationOf<FoldersReorderedEvent>('FoldersReorderedEvent', event => {
      if (!event.folders?.length || !isInActiveFolderScope(event.profileId)) return;

      const activeLoad = activeFolderLoad;
      if (activeLoad && (activeLoad.profileId === null || activeLoad.profileId === event.profileId)) {
        for (const placement of event.folders) {
          activeLoad.reorderedPlacements.set(placement.id, placement);
        }
      }

      if (activeLoad && activeLoad.profileId !== loadedProfileId) return;
      applyCanonicalPlacements(event.folders);
    }),

    onNotificationOf<WidgetCreatedEvent>('WidgetCreatedEvent', event => {
      if (event.folderId && event.widget) {
        const widget = mapIpcWidget(event.widget, event.folderId);
        folders = folders.map(f =>
          f.id === event.folderId
            ? { ...f, widgets: f.widgets.some(w => w.id === widget.id) ? f.widgets : [...f.widgets, widget] }
            : f,
        );
      }
    }),

    onNotificationOf<WidgetUpdatedEvent>('WidgetUpdatedEvent', event => {
      if (event.folderId && event.widget) {
        const widget = mapIpcWidget(event.widget, event.folderId);
        folders = folders.map(f =>
          f.id === event.folderId
            ? {
                ...f,
                widgets: f.widgets.map(w =>
                  w.id === widget.id ? { ...widget, data: event.widget.data ? widget.data : w.data } : w,
                ),
              }
            : f,
        );
      }
    }),

    onNotificationOf<WidgetPositionsUpdatedEvent>('WidgetPositionsUpdatedEvent', event => {
      if (!event.folderId || !event.widgets?.length) return;
      const rectsById = new Map(
        event.widgets.map(w => [w.id, { x: w.positionX, y: w.positionY, w: w.width, h: w.height }]),
      );
      folders = folders.map(f =>
        f.id === event.folderId
          ? {
              ...f,
              widgets: f.widgets.map(w => {
                const rect = rectsById.get(w.id);
                return rect ? { ...w, ...rect } : w;
              }),
            }
          : f,
      );
    }),

    onNotificationOf<WidgetDeletedEvent>('WidgetDeletedEvent', event => {
      if (event.folderId && event.widgetId) {
        folders = folders.map(f =>
          f.id === event.folderId ? { ...f, widgets: f.widgets.filter(w => w.id !== event.widgetId) } : f,
        );
      }
    }),

    onNotificationOf<WidgetsCreatedEvent>('WidgetsCreatedEvent', event => {
      if (!event.folderId || !event.widgets?.length) return;
      const created = event.widgets.map(w => mapIpcWidget(w, event.folderId));
      folders = folders.map(f =>
        f.id === event.folderId
          ? {
              ...f,
              widgets: [...f.widgets, ...created.filter(w => !f.widgets.some(existing => existing.id === w.id))],
            }
          : f,
      );
    }),

    onNotificationOf<WidgetsUpdatedEvent>('WidgetsUpdatedEvent', event => {
      if (!event.folderId || !event.widgets?.length) return;
      const updatedById = new Map(event.widgets.map(w => [w.id, w]));
      folders = folders.map(f =>
        f.id === event.folderId
          ? {
              ...f,
              widgets: f.widgets.map(w => {
                const updated = updatedById.get(w.id);
                if (!updated) return w;
                const mapped = mapIpcWidget(updated, event.folderId);
                return { ...mapped, data: updated.data ? mapped.data : w.data };
              }),
            }
          : f,
      );
    }),

    onNotificationOf<WidgetsDeletedEvent>('WidgetsDeletedEvent', event => {
      if (!event.folderId || !event.widgetIds?.length) return;
      const deletedIds = new Set(event.widgetIds);
      folders = folders.map(f =>
        f.id === event.folderId ? { ...f, widgets: f.widgets.filter(w => !deletedIds.has(w.id)) } : f,
      );
    }),

    onNotificationOf<FolderNavigationEvent>('FolderNavigationEvent', event => {
      handleNavigation(event);
    }),
  ];
}

export function stopFolders(): void {
  for (const unsubscribe of unsubscribes) unsubscribe();
  unsubscribes = [];
  started = false;
}

export function resetFolders(): void {
  stopFolders();
  folders = [];
  selectedFolderId = null;
  isLoading = false;
  loadError = null;
  navHistory = [];
  contextMenu = { isOpen: false, folderId: null, x: 0, y: 0 };
  loadedProfileId = null;
  activeFolderLoad = null;
  lastReportedFolderId = null;
  pendingNavigation = null;
}
