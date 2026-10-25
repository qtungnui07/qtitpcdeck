import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcIconPack } from '@macro-deck/runtime';
import { iconPackEndpoints } from './endpoints';
import {
  applyIconPackBatch,
  applyIconsBatch,
  createPack,
  deleteIcon,
  deleteIcons,
  deletePack,
  iconPackStore,
  loadIconPacks,
  loadIcons,
  renameIcon,
  resetIconPacks,
  startIconPacks,
  stopIconPacks,
} from './icon-packs.svelte';
import * as api from './api.svelte';

const SAMPLE_PACK: IpcIconPack = {
  id: 'pack-1',
  name: 'Default Icons',
  description: 'Built-in icons',
  isDefault: true,
  isReadOnly: true,
  sourceType: 'System',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  iconCount: 50,
};

describe('iconPackStore', () => {
  beforeEach(() => {
    resetIconPacks();
  });

  afterEach(() => {
    resetIconPacks();
    vi.restoreAllMocks();
  });

  it('initializes with empty state', () => {
    expect(iconPackStore.packs).toEqual([]);
    expect(iconPackStore.packCount).toBe(0);
    expect(iconPackStore.isLoading).toBe(false);
    expect(iconPackStore.loadError).toBeNull();
  });

  it('updates state via applyIconPackBatch', () => {
    applyIconPackBatch([SAMPLE_PACK]);
    expect(iconPackStore.packs).toHaveLength(1);
    expect(iconPackStore.packCount).toBe(1);
    expect(iconPackStore.packs[0].name).toBe('Default Icons');
  });

  it('loads packs from endpoint', async () => {
    vi.spyOn(iconPackEndpoints, 'list').mockResolvedValue({
      packs: [SAMPLE_PACK],
    });

    await loadIconPacks();

    expect(iconPackStore.packs).toHaveLength(1);
    expect(iconPackStore.packCount).toBe(1);
    expect(iconPackStore.isLoading).toBe(false);
    expect(iconPackStore.loadError).toBeNull();
  });

  it('records error when loading fails', async () => {
    vi.spyOn(iconPackEndpoints, 'list').mockRejectedValue(new Error('Fetch failed'));

    await loadIconPacks();

    expect(iconPackStore.packs).toEqual([]);
    expect(iconPackStore.loadError).toBe('Fetch failed');
    expect(iconPackStore.isLoading).toBe(false);
  });

  it('handles socket push notifications for created, updated, and deleted packs', () => {
    type Handler = (payload: unknown) => void;
    const handlers = new Map<string, Handler>();
    vi.spyOn(api, 'onNotificationOf').mockImplementation((event, handler) => {
      handlers.set(event, handler as Handler);
      return () => handlers.delete(event);
    });

    startIconPacks();

    // Created event
    const createdHandler = handlers.get('IconPackCreatedEvent');
    expect(createdHandler).toBeDefined();
    createdHandler!({ pack: SAMPLE_PACK });
    expect(iconPackStore.packCount).toBe(1);

    // Updated event
    const updatedHandler = handlers.get('IconPackUpdatedEvent');
    expect(updatedHandler).toBeDefined();
    updatedHandler!({
      pack: { ...SAMPLE_PACK, name: 'Renamed Icons', iconCount: 60 },
    });
    expect(iconPackStore.packs[0].name).toBe('Renamed Icons');
    expect(iconPackStore.packs[0].iconCount).toBe(60);

    // Deleted event
    const deletedHandler = handlers.get('IconPackDeletedEvent');
    expect(deletedHandler).toBeDefined();
    deletedHandler!({ packId: 'pack-1' });
    expect(iconPackStore.packCount).toBe(0);

    // IconsAdded, Updated, Deleted events
    const sampleIcon = {
      id: 'icon-1',
      packId: 'pack-2',
      name: 'star',
      isAnimated: false,
      processingState: 'Ready' as const,
      availableSizes: [32],
      createdAt: '2026-01-01',
    };
    const iconsAddedHandler = handlers.get('IconsAddedEvent');
    expect(iconsAddedHandler).toBeDefined();
    iconsAddedHandler!({ packId: 'pack-2', icons: [sampleIcon] });
    expect(iconPackStore.iconsFor('pack-2')).toHaveLength(1);

    const iconUpdatedHandler = handlers.get('IconUpdatedEvent');
    expect(iconUpdatedHandler).toBeDefined();
    iconUpdatedHandler!({ icon: { ...sampleIcon, name: 'star-filled' } });
    expect(iconPackStore.iconsFor('pack-2')[0].name).toBe('star-filled');

    const iconDeletedHandler = handlers.get('IconDeletedEvent');
    expect(iconDeletedHandler).toBeDefined();
    iconDeletedHandler!({ iconId: 'icon-1' });
    expect(iconPackStore.iconsFor('pack-2')).toHaveLength(0);

    stopIconPacks();
  });

  it('manages icons per pack and handles CRUD operations', async () => {
    applyIconPackBatch([SAMPLE_PACK]);

    const sampleIcon = {
      id: 'icon-10',
      packId: 'pack-1',
      name: 'home',
      isAnimated: false,
      processingState: 'Ready' as const,
      availableSizes: [32],
      createdAt: '2026-01-01',
    };

    applyIconsBatch('pack-1', [sampleIcon]);
    expect(iconPackStore.iconsFor('pack-1')).toHaveLength(1);
    expect(iconPackStore.isPackLoaded('pack-1')).toBe(true);

    // loadIcons
    vi.spyOn(iconPackEndpoints, 'icons').mockResolvedValue({
      icons: [sampleIcon, { ...sampleIcon, id: 'icon-11', name: 'settings' }],
    });
    await loadIcons('pack-1', true);
    expect(iconPackStore.iconsFor('pack-1')).toHaveLength(2);

    // renameIcon
    vi.spyOn(iconPackEndpoints, 'renameIcon').mockResolvedValue({
      success: true,
      icon: { ...sampleIcon, name: 'home-alt' },
    });
    const renamed = await renameIcon('icon-10', 'home-alt');
    expect(renamed).toBe(true);
    expect(iconPackStore.iconsFor('pack-1')[0].name).toBe('home-alt');

    // deleteIcon
    vi.spyOn(iconPackEndpoints, 'deleteIcon').mockResolvedValue({ success: true });
    const deletedSingle = await deleteIcon('icon-11', 'pack-1');
    expect(deletedSingle).toBe(true);
    expect(iconPackStore.iconsFor('pack-1')).toHaveLength(1);

    // deleteIcons
    vi.spyOn(iconPackEndpoints, 'deleteIcons').mockResolvedValue({
      success: true,
      deletedCount: 1,
    });
    const deletedBatch = await deleteIcons(['icon-10'], 'pack-1');
    expect(deletedBatch).toBe(true);
    expect(iconPackStore.iconsFor('pack-1')).toHaveLength(0);

    // createPack
    const newPack = {
      ...SAMPLE_PACK,
      id: 'pack-custom',
      name: 'Custom Icons',
      isDefault: false,
      isReadOnly: false,
    };
    vi.spyOn(iconPackEndpoints, 'create').mockResolvedValue({
      success: true,
      pack: newPack,
    });
    const created = await createPack({ name: 'Custom Icons' });
    expect(created).not.toBeNull();
    expect(iconPackStore.packs.some(p => p.id === 'pack-custom')).toBe(true);

    // deletePack
    vi.spyOn(iconPackEndpoints, 'remove').mockResolvedValue({ success: true });
    const removed = await deletePack('pack-custom');
    expect(removed).toBe(true);
    expect(iconPackStore.packs.some(p => p.id === 'pack-custom')).toBe(false);
  });
});
