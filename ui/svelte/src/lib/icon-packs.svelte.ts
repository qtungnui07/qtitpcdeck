/*
 * The icon pack library store.
 *
 * Keeps the collection of icon packs installed or built-in to the deck.
 * Listens for socket push events (created, updated, deleted) so the pack list
 * updates live when packs are imported, edited, or removed.
 */

import type {
  CreateIconPackRequest,
  IconDeletedEvent,
  IconPackCreatedEvent,
  IconPackDeletedEvent,
  IconPackUpdatedEvent,
  IconsAddedEvent,
  IconUpdatedEvent,
  ImportIconPacksResponse,
  ImportIconsResponse,
  IpcIcon,
  IpcIconPack,
  UpdateIconPackRequest,
} from '@macro-deck/runtime';
import { onNotificationOf } from './api.svelte';
import { iconPackEndpoints } from './endpoints';
import { shellBridge } from './shell-bridge';

export function comparePacks(a: IpcIconPack, b: IpcIconPack): number {
  if (a.isDefault !== b.isDefault) {
    return a.isDefault ? -1 : 1;
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

let packs = $state<IpcIconPack[]>([]);
let iconsByPack = $state<Record<string, IpcIcon[]>>({});
let isLoading = $state(false);
let loadError = $state<string | null>(null);

let fetchSequence = 0;
const loadedPacks = new Set<string>();
const loadingPacks = new Set<string>();

let unsubscribeCreated: (() => void) | null = null;
let unsubscribeUpdated: (() => void) | null = null;
let unsubscribeDeleted: (() => void) | null = null;
let unsubscribeIconsAdded: (() => void) | null = null;
let unsubscribeIconUpdated: (() => void) | null = null;
let unsubscribeIconDeleted: (() => void) | null = null;

export const iconPackStore = {
  get packs(): readonly IpcIconPack[] {
    return packs;
  },
  get isLoading(): boolean {
    return isLoading;
  },
  get loadError(): string | null {
    return loadError;
  },
  get packCount(): number {
    return packs.length;
  },
  iconsFor(packId: string): readonly IpcIcon[] {
    return iconsByPack[packId] ?? [];
  },
  isPackLoaded(packId: string): boolean {
    return loadedPacks.has(packId);
  },
};

export async function loadIconPacks(): Promise<void> {
  const seq = ++fetchSequence;
  isLoading = true;
  loadError = null;

  try {
    const response = await iconPackEndpoints.list();
    if (seq !== fetchSequence) return;
    packs = (response.packs ?? []).slice().sort(comparePacks);
  } catch (error) {
    if (seq !== fetchSequence) return;
    console.error('Failed to load icon packs:', error);
    loadError = error instanceof Error ? error.message : String(error);
  } finally {
    if (seq === fetchSequence) {
      isLoading = false;
    }
  }
}

export async function loadIcons(packId: string, force = false): Promise<void> {
  if (loadingPacks.has(packId) || (!force && loadedPacks.has(packId))) {
    return;
  }

  loadingPacks.add(packId);
  try {
    const response = await iconPackEndpoints.icons(packId);
    iconsByPack[packId] = response.icons ?? [];
    loadedPacks.add(packId);
  } catch (error) {
    console.error(`Failed to load icons for pack ${packId}:`, error);
  } finally {
    loadingPacks.delete(packId);
  }
}

export async function createPack(request: CreateIconPackRequest): Promise<IpcIconPack | null> {
  try {
    const response = await iconPackEndpoints.create(request);
    if (!response.success || !response.pack) {
      return null;
    }
    const pack = response.pack;
    const next = packs.filter(p => p.id !== pack.id);
    next.push(pack);
    packs = next.sort(comparePacks);
    return pack;
  } catch (error) {
    console.error('Failed to create icon pack:', error);
    return null;
  }
}

export async function updatePack(
  packId: string,
  request: UpdateIconPackRequest,
): Promise<boolean> {
  try {
    const response = await iconPackEndpoints.update(packId, request);
    if (!response.success) {
      return false;
    }
    if (response.pack) {
      const updated = response.pack;
      packs = packs
        .map(p => (p.id === updated.id ? updated : p))
        .sort(comparePacks);
    }
    return true;
  } catch (error) {
    console.error(`Failed to update icon pack ${packId}:`, error);
    return false;
  }
}

export async function deletePack(packId: string): Promise<boolean> {
  const previous = packs;
  packs = packs.filter(p => p.id !== packId);
  delete iconsByPack[packId];
  loadedPacks.delete(packId);

  try {
    const response = await iconPackEndpoints.remove(packId);
    if (!response.success) {
      packs = previous;
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Failed to delete icon pack ${packId}:`, error);
    packs = previous;
    return false;
  }
}

export async function renameIcon(iconId: string, name: string): Promise<boolean> {
  try {
    const response = await iconPackEndpoints.renameIcon(iconId, { name });
    if (!response.success || !response.icon) {
      return false;
    }
    const updated = response.icon;
    const packIcons = iconsByPack[updated.packId];
    if (packIcons) {
      iconsByPack[updated.packId] = packIcons.map(i =>
        i.id === updated.id ? updated : i,
      );
    }
    return true;
  } catch (error) {
    console.error(`Failed to rename icon ${iconId}:`, error);
    return false;
  }
}

export async function deleteIcon(iconId: string, packId: string): Promise<boolean> {
  const previous = iconsByPack[packId] ?? [];
  iconsByPack[packId] = previous.filter(i => i.id !== iconId);

  try {
    const response = await iconPackEndpoints.deleteIcon(iconId);
    if (!response.success) {
      iconsByPack[packId] = previous;
      return false;
    }
    updatePackIconCount(packId, iconsByPack[packId].length);
    return true;
  } catch (error) {
    console.error(`Failed to delete icon ${iconId}:`, error);
    iconsByPack[packId] = previous;
    return false;
  }
}

export async function deleteIcons(ids: string[], packId: string): Promise<boolean> {
  const idSet = new Set(ids);
  const previous = iconsByPack[packId] ?? [];
  iconsByPack[packId] = previous.filter(i => !idSet.has(i.id));

  try {
    const response = await iconPackEndpoints.deleteIcons({ ids });
    if (!response.success) {
      iconsByPack[packId] = previous;
      return false;
    }
    updatePackIconCount(packId, iconsByPack[packId].length);
    return true;
  } catch (error) {
    console.error(`Failed to delete icons from pack ${packId}:`, error);
    iconsByPack[packId] = previous;
    return false;
  }
}

export async function uploadIcons(packId: string, files: File[]): Promise<ImportIconsResponse> {
  const form = new FormData();
  for (const file of files) {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    form.append('files', file, relativePath || file.name);
  }
  return iconPackEndpoints.uploadIcons(packId, form);
}

export async function importIconPacks(files: File[]): Promise<ImportIconPacksResponse> {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file, file.name);
  }
  return iconPackEndpoints.importIconPacks(form);
}

export async function exportPack(
  packId: string,
): Promise<{ ok: boolean; fileName?: string; canceled?: boolean; error?: string }> {
  try {
    const { blob, fileName } = await iconPackEndpoints.exportPack(packId);
    const finalName = fileName || 'icon-pack.macroDeckIconPack';
    const shell = shellBridge();
    if (shell?.saveFile) {
      const data = await blob.arrayBuffer();
      const dot = finalName.lastIndexOf('.');
      const ext = dot > 0 ? [finalName.slice(dot + 1)] : ['macroDeckIconPack'];
      const result = await shell.saveFile({ fileName: finalName, extensions: ext, data });
      if (result.canceled) {
        return { ok: true, canceled: true };
      }
      if (!result.saved) {
        return { ok: false, error: result.error ?? 'Save failed' };
      }
      return { ok: true, fileName: result.path ?? finalName };
    }

    if (typeof document !== 'undefined') {
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = finalName;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    return { ok: true, fileName: finalName };
  } catch (error) {
    console.error(`Failed to export icon pack ${packId}:`, error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function importFromPath(packId: string, paths: string[]): Promise<boolean> {
  try {
    const response = await iconPackEndpoints.importFromPath(packId, { paths });
    return response.success ?? false;
  } catch (error) {
    console.error(`Failed to import icons from path into pack ${packId}:`, error);
    return false;
  }
}

export async function restoreFromPath(path: string): Promise<string | null> {
  try {
    const response = await iconPackEndpoints.restoreFromPath(path);
    if (!response.success) {
      return null;
    }
    const restored = response.packs ?? [];
    if (restored.length > 0) {
      const idSet = new Set(restored.map(p => p.id));
      packs = [...packs.filter(p => !idSet.has(p.id)), ...restored].sort(comparePacks);
    }
    return restored[0]?.name ?? null;
  } catch (error) {
    console.error('Failed to restore icon pack from path:', error);
    return null;
  }
}

export function iconImageUrl(iconId: string, version?: string | null, size?: number): string {
  return iconPackEndpoints.iconImageUrl(iconId, version, size);
}

function updatePackIconCount(packId: string, count: number): void {
  packs = packs.map(p => (p.id === packId ? { ...p, iconCount: count } : p));
}

export function applyIconPackBatch(incoming: IpcIconPack[]): void {
  packs = [...incoming].sort(comparePacks);
}

export function applyIconsBatch(packId: string, incoming: IpcIcon[]): void {
  iconsByPack[packId] = [...incoming];
  loadedPacks.add(packId);
}

export function startIconPacks(): void {
  stopIconPacks();

  unsubscribeCreated = onNotificationOf<IconPackCreatedEvent>(
    'IconPackCreatedEvent',
    event => {
      if (!event.pack) return;
      const index = packs.findIndex(p => p.id === event.pack.id);
      if (index >= 0) {
        packs = [...packs.slice(0, index), event.pack, ...packs.slice(index + 1)].sort(comparePacks);
      } else {
        packs = [...packs, event.pack].sort(comparePacks);
      }
    },
  );

  unsubscribeUpdated = onNotificationOf<IconPackUpdatedEvent>(
    'IconPackUpdatedEvent',
    event => {
      if (!event.pack) return;
      const index = packs.findIndex(p => p.id === event.pack.id);
      if (index >= 0) {
        packs = [...packs.slice(0, index), event.pack, ...packs.slice(index + 1)].sort(comparePacks);
      }
    },
  );

  unsubscribeDeleted = onNotificationOf<IconPackDeletedEvent>(
    'IconPackDeletedEvent',
    event => {
      packs = packs.filter(p => p.id !== event.packId);
      delete iconsByPack[event.packId];
      loadedPacks.delete(event.packId);
    },
  );

  unsubscribeIconsAdded = onNotificationOf<IconsAddedEvent>(
    'IconsAddedEvent',
    event => {
      if (!event.packId || !event.icons) return;
      const current = iconsByPack[event.packId] ?? [];
      const newMap = new Map(current.map(i => [i.id, i]));
      for (const icon of event.icons) {
        newMap.set(icon.id, icon);
      }
      iconsByPack[event.packId] = Array.from(newMap.values());
      updatePackIconCount(event.packId, iconsByPack[event.packId].length);
    },
  );

  unsubscribeIconUpdated = onNotificationOf<IconUpdatedEvent>(
    'IconUpdatedEvent',
    event => {
      if (!event.icon) return;
      const packId = event.icon.packId;
      const current = iconsByPack[packId];
      if (current) {
        iconsByPack[packId] = current.map(i => (i.id === event.icon.id ? event.icon : i));
      }
    },
  );

  unsubscribeIconDeleted = onNotificationOf<IconDeletedEvent>(
    'IconDeletedEvent',
    event => {
      for (const packId of Object.keys(iconsByPack)) {
        const current = iconsByPack[packId];
        if (current.some(i => i.id === event.iconId)) {
          iconsByPack[packId] = current.filter(i => i.id !== event.iconId);
          updatePackIconCount(packId, iconsByPack[packId].length);
          break;
        }
      }
    },
  );
}

export function stopIconPacks(): void {
  unsubscribeCreated?.();
  unsubscribeCreated = null;
  unsubscribeUpdated?.();
  unsubscribeUpdated = null;
  unsubscribeDeleted?.();
  unsubscribeDeleted = null;
  unsubscribeIconsAdded?.();
  unsubscribeIconsAdded = null;
  unsubscribeIconUpdated?.();
  unsubscribeIconUpdated = null;
  unsubscribeIconDeleted?.();
  unsubscribeIconDeleted = null;
}

export function resetIconPacks(): void {
  stopIconPacks();
  packs = [];
  iconsByPack = {};
  loadedPacks.clear();
  loadingPacks.clear();
  isLoading = false;
  loadError = null;
  fetchSequence = 0;
}
