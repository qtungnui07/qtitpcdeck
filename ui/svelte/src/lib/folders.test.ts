import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcFolder, IpcWidget } from '@macro-deck/runtime';
import { folderEndpoints, widgetEndpoints } from './endpoints';
import {
  addWidgetAt,
  canDeleteFolder,
  commitWidgetLayout,
  createFolder,
  deleteFolder,
  deletionScope,
  duplicateFolder,
  folderStore,
  getFolderById,
  goBack,
  loadFolders,
  moveFolder,
  removeWidget,
  removeWidgets,
  renameFolder,
  resetFolders,
  selectFolder,
  setGridDimensions,
  startFolders,
  stopFolders,
  updateWidget,
} from './folders.svelte';
import { resetProfiles, selectProfile } from './profiles.svelte';
import * as api from './api.svelte';

const SAMPLE_IPC_WIDGET: IpcWidget = {
  id: '00000000-0000-0000-0000-000000000001',
  type: 'ActionButton',
  positionX: 0,
  positionY: 0,
  width: 1,
  height: 1,
  data: '{}',
  isPinned: false,
  pinScope: 'Profile',
};

const SAMPLE_IPC_FOLDER: IpcFolder = {
  id: '00000000-0000-0000-0000-000000000010',
  name: 'Root Folder',
  profileId: 'profile-1',
  order: 0,
  isDefault: true,
  columns: 5,
  rows: 3,
  widgetSpacing: 10,
  widgetBorderRadius: 8,
  emptyCellStyle: 'visible',
  backgroundColor: '#111111',
  backgroundColorSource: '#111111',
  viewId: 'macrodeck:widget-grid-view',
  widgets: [SAMPLE_IPC_WIDGET],
};

const SAMPLE_IPC_FOLDER_2: IpcFolder = {
  id: '00000000-0000-0000-0000-000000000020',
  name: 'Child Folder',
  profileId: 'profile-1',
  parentId: '00000000-0000-0000-0000-000000000010',
  order: 1,
  isDefault: false,
  columns: 4,
  rows: 2,
  viewId: 'macrodeck:widget-grid-view',
  widgets: [],
};

describe('folderStore', () => {
  beforeEach(() => {
    resetProfiles();
    resetFolders();
  });

  afterEach(() => {
    resetFolders();
    resetProfiles();
    vi.restoreAllMocks();
  });

  it('initializes with empty state', () => {
    expect(folderStore.folders).toEqual([]);
    expect(folderStore.selectedFolderId).toBeNull();
    expect(folderStore.selectedFolder).toBeUndefined();
    expect(folderStore.isLoading).toBe(false);
    expect(folderStore.loadError).toBeNull();
    expect(folderStore.canGoBack).toBe(false);
  });

  it('loads folders from endpoint and auto-selects start folder', async () => {
    vi.spyOn(folderEndpoints, 'list').mockResolvedValue({
      folders: [SAMPLE_IPC_FOLDER, SAMPLE_IPC_FOLDER_2],
    });

    await loadFolders('profile-1');

    expect(folderStore.folders).toHaveLength(2);
    expect(folderStore.selectedFolderId).toBe(SAMPLE_IPC_FOLDER.id);
    expect(folderStore.currentFolderName).toBe('Root Folder');
    expect(folderStore.currentCols).toBe(5);
    expect(folderStore.currentRows).toBe(3);
    expect(folderStore.currentWidgets).toHaveLength(1);
  });

  it('supports selecting a folder and navigating back', async () => {
    vi.spyOn(folderEndpoints, 'list').mockResolvedValue({
      folders: [SAMPLE_IPC_FOLDER, SAMPLE_IPC_FOLDER_2],
    });
    await loadFolders('profile-1');

    selectFolder(SAMPLE_IPC_FOLDER_2.id);
    expect(folderStore.selectedFolderId).toBe(SAMPLE_IPC_FOLDER_2.id);
    expect(folderStore.canGoBack).toBe(true);

    goBack();
    expect(folderStore.selectedFolderId).toBe(SAMPLE_IPC_FOLDER.id);
  });

  it('computes canDeleteFolder and deletionScope correctly', async () => {
    vi.spyOn(folderEndpoints, 'list').mockResolvedValue({
      folders: [SAMPLE_IPC_FOLDER, SAMPLE_IPC_FOLDER_2],
    });
    await loadFolders('profile-1');

    // Deleting root would delete child too, leaving 0 folders -> false
    expect(canDeleteFolder(SAMPLE_IPC_FOLDER.id)).toBe(false);
    // Deleting child leaves root -> true
    expect(canDeleteFolder(SAMPLE_IPC_FOLDER_2.id)).toBe(true);

    const scope = deletionScope(SAMPLE_IPC_FOLDER.id);
    expect(scope).toBeDefined();
    expect(scope?.subfolderCount).toBe(1);
    expect(scope?.widgetCount).toBe(1);
  });

  it('sets grid dimensions and rolls back on failure', async () => {
    vi.spyOn(folderEndpoints, 'list').mockResolvedValue({
      folders: [SAMPLE_IPC_FOLDER],
    });
    await loadFolders('profile-1');

    vi.spyOn(folderEndpoints, 'update').mockResolvedValue({
      success: false,
      error: { code: 'FAIL', message: 'Failed to resize' },
    });

    const result = await setGridDimensions(8, 6);
    expect(result.success).toBe(false);
    expect(folderStore.currentCols).toBe(5);
    expect(folderStore.currentRows).toBe(3);
  });

  it('adds widget at valid unoccupied cell', async () => {
    vi.spyOn(folderEndpoints, 'list').mockResolvedValue({
      folders: [SAMPLE_IPC_FOLDER],
    });
    await loadFolders('profile-1');

    const createdIpcWidget: IpcWidget = {
      id: '00000000-0000-0000-0000-000000000099',
      type: 'ActionButton',
      positionX: 1,
      positionY: 1,
      width: 1,
      height: 1,
      data: '{}',
      isPinned: false,
      pinScope: 'Profile',
    };

    vi.spyOn(widgetEndpoints, 'create').mockResolvedValue({
      success: true,
      widget: createdIpcWidget,
    });

    const created = await addWidgetAt(1, 1, 'ActionButton' as any);
    expect(created).toBeDefined();
    expect(created?.id).toBe(createdIpcWidget.id);
    expect(folderStore.currentWidgets).toHaveLength(2);
  });

  it('updates a widget', async () => {
    vi.spyOn(folderEndpoints, 'list').mockResolvedValue({
      folders: [SAMPLE_IPC_FOLDER],
    });
    await loadFolders('profile-1');

    vi.spyOn(widgetEndpoints, 'update').mockResolvedValue({
      success: true,
      widget: {
        ...SAMPLE_IPC_WIDGET,
        positionX: 2,
        positionY: 2,
      },
    });

    const success = await updateWidget(SAMPLE_IPC_WIDGET.id, { x: 2, y: 2 });
    expect(success).toBe(true);
    expect(folderStore.currentWidgets[0].x).toBe(2);
    expect(folderStore.currentWidgets[0].y).toBe(2);
  });

  it('removes widget from folder', async () => {
    vi.spyOn(folderEndpoints, 'list').mockResolvedValue({
      folders: [SAMPLE_IPC_FOLDER],
    });
    await loadFolders('profile-1');

    vi.spyOn(widgetEndpoints, 'delete').mockResolvedValue({
      success: true,
    });

    await removeWidget(SAMPLE_IPC_WIDGET.id);
    expect(folderStore.currentWidgets).toHaveLength(0);
  });

  it('commits widget layout changes', async () => {
    vi.spyOn(folderEndpoints, 'list').mockResolvedValue({
      folders: [SAMPLE_IPC_FOLDER],
    });
    await loadFolders('profile-1');

    vi.spyOn(widgetEndpoints, 'updatePositions').mockResolvedValue({
      success: true,
    });

    const changes = new Map([[SAMPLE_IPC_WIDGET.id, { x: 3, y: 1, w: 1, h: 1 }]]);
    const result = await commitWidgetLayout(changes);

    expect(result.success).toBe(true);
    expect(folderStore.currentWidgets[0].x).toBe(3);
    expect(folderStore.currentWidgets[0].y).toBe(1);
  });

  it('reacts to live WebSocket notifications', () => {
    const listeners: Record<string, (event: any) => void> = {};
    vi.spyOn(api, 'onNotificationOf').mockImplementation((event: string, handler: any) => {
      listeners[event] = handler;
      return () => {
        delete listeners[event];
      };
    });

    startFolders();

    expect(listeners['FolderCreatedEvent']).toBeDefined();
    listeners['FolderCreatedEvent']({ folder: SAMPLE_IPC_FOLDER });
    expect(folderStore.folders).toHaveLength(1);

    listeners['WidgetCreatedEvent']({
      folderId: SAMPLE_IPC_FOLDER.id,
      widget: {
        id: '00000000-0000-0000-0000-000000000088',
        type: 'ActionButton',
        positionX: 2,
        positionY: 0,
        width: 1,
        height: 1,
        data: '{}',
        isPinned: false,
        pinScope: 'Profile',
      },
    });
    expect(getFolderById(SAMPLE_IPC_FOLDER.id)?.widgets).toHaveLength(2);

    listeners['WidgetDeletedEvent']({
      folderId: SAMPLE_IPC_FOLDER.id,
      widgetId: '00000000-0000-0000-0000-000000000088',
    });
    expect(getFolderById(SAMPLE_IPC_FOLDER.id)?.widgets).toHaveLength(1);

    stopFolders();
  });

  it('creates, renames, duplicates, and deletes a folder', async () => {
    selectProfile('profile-1');
    vi.spyOn(folderEndpoints, 'list').mockResolvedValue({
      folders: [SAMPLE_IPC_FOLDER, SAMPLE_IPC_FOLDER_2],
    });
    await loadFolders('profile-1');

    const createdIpc: IpcFolder = {
      id: '00000000-0000-0000-0000-000000000030',
      name: 'New Folder',
      profileId: 'profile-1',
      order: 2,
      columns: 5,
      rows: 3,
      widgets: [],
    };
    vi.spyOn(folderEndpoints, 'create').mockResolvedValue({
      success: true,
      folder: createdIpc,
    });

    const createResult = await createFolder('New Folder');
    expect(createResult.success).toBe(true);
    expect(folderStore.selectedFolderId).toBe(createdIpc.id);

    vi.spyOn(folderEndpoints, 'update').mockResolvedValue({ success: true });
    const renameResult = await renameFolder(createdIpc.id, 'Renamed Folder');
    expect(renameResult.success).toBe(true);
    expect(folderStore.currentFolderName).toBe('Renamed Folder');

    const duplicatedIpc: IpcFolder = {
      ...createdIpc,
      id: '00000000-0000-0000-0000-000000000040',
      name: 'Renamed Folder (Copy)',
    };
    vi.spyOn(folderEndpoints, 'duplicate').mockResolvedValue({
      success: true,
      folder: duplicatedIpc,
    });
    const dupResult = await duplicateFolder(createdIpc.id);
    expect(dupResult.success).toBe(true);
    expect(folderStore.selectedFolderId).toBe(duplicatedIpc.id);

    vi.spyOn(folderEndpoints, 'delete').mockResolvedValue({ success: true });
    const delResult = await deleteFolder(duplicatedIpc.id);
    expect(delResult.success).toBe(true);
  });

  it('moves folder and batch deletes widgets', async () => {
    vi.spyOn(folderEndpoints, 'list').mockResolvedValue({
      folders: [SAMPLE_IPC_FOLDER, SAMPLE_IPC_FOLDER_2],
    });
    await loadFolders('profile-1');

    vi.spyOn(folderEndpoints, 'move').mockResolvedValue({ success: true, folders: [] });
    const moveResult = await moveFolder({
      folderId: SAMPLE_IPC_FOLDER_2.id,
      targetId: SAMPLE_IPC_FOLDER.id,
      position: 'inside',
    });
    expect(moveResult.success).toBe(true);

    vi.spyOn(widgetEndpoints, 'deleteBatch').mockResolvedValue({ success: true });
    const delWidgetsResult = await removeWidgets([SAMPLE_IPC_WIDGET.id], SAMPLE_IPC_FOLDER.id);
    expect(delWidgetsResult.success).toBe(true);
  });
});
