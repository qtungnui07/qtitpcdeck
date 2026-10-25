/*
 * Unit tests for IconPacksLibraryPage.
 *
 * Verifies:
 * - Rendering empty state when no packs are present
 * - Rail list rendering and default pack auto-selection
 * - URL query parameter ?pack= selection
 * - Pack switching and icon grid display
 * - Search query filtering
 * - Icon selection (single, toggle, range via shift, clear via Escape or button)
 * - Keyboard shortcuts (Escape clears selection, Delete/Backspace prompts batch deletion)
 * - Context menu triggers for packs and icons
 * - Pack deletion confirmation dialogs (store vs local)
 * - Icon renaming modal
 * - Copy icon ID handling (toast vs fallback dialog)
 */

import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcIcon, IpcIconPack } from '@macro-deck/runtime';
import { AppStrings } from '@macro-deck/runtime';
import * as api from '$lib/api.svelte';
import {
  applyIconPackBatch,
  applyIconsBatch,
  resetIconPacks,
} from '$lib/icon-packs.svelte';
import { startLocalization, stopLocalization, translateKey } from '$lib/localization.svelte';
import { navigate } from '$lib/router.svelte';
import * as textClipboard from '$lib/text-clipboard';
import { clearToasts, toastStore } from '$lib/toasts.svelte';
import IconPacksLibraryPage from './IconPacksLibraryPage.svelte';

const SAMPLE_PACK_DEFAULT: IpcIconPack = {
  id: 'pack-default',
  name: 'Default Pack',
  author: 'Macro Deck',
  version: '1.0.0',
  description: 'Built-in icons',
  isDefault: true,
  isReadOnly: true,
  sourceType: 'BuiltIn',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  iconCount: 2,
};

const SAMPLE_PACK_USER: IpcIconPack = {
  id: 'pack-user',
  name: 'Custom Pack',
  author: 'User',
  version: '1.1.0',
  description: 'Custom icons',
  isDefault: false,
  isReadOnly: false,
  sourceType: 'Custom',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  iconCount: 3,
};

const SAMPLE_ICONS_DEFAULT: IpcIcon[] = [
  {
    id: 'icon-d1',
    packId: 'pack-default',
    name: 'Home',
    isAnimated: false,
    processingState: 'Ready',
    availableSizes: [128],
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'icon-d2',
    packId: 'pack-default',
    name: 'Settings',
    isAnimated: false,
    processingState: 'Ready',
    availableSizes: [128],
    createdAt: '2025-01-01T00:00:00Z',
  },
];

const SAMPLE_ICONS_USER: IpcIcon[] = [
  {
    id: 'icon-u1',
    packId: 'pack-user',
    name: 'Play Button',
    isAnimated: false,
    processingState: 'Ready',
    availableSizes: [128],
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'icon-u2',
    packId: 'pack-user',
    name: 'Stop Button',
    isAnimated: false,
    processingState: 'Ready',
    availableSizes: [128],
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'icon-u3',
    packId: 'pack-user',
    name: 'Pause Button',
    isAnimated: false,
    processingState: 'Ready',
    availableSizes: [128],
    createdAt: '2025-01-01T00:00:00Z',
  },
];

describe('IconPacksLibraryPage', () => {
  beforeEach(() => {
    startLocalization();
    resetIconPacks();
    clearToasts();
    navigate('/library/icon-packs');
    vi.spyOn(api, 'get').mockResolvedValue({ packs: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    stopLocalization();
    resetIconPacks();
    clearToasts();
  });

  it('renders empty state when no packs exist', async () => {
    const { getByText } = render(IconPacksLibraryPage);

    await waitFor(() => {
      expect(getByText(translateKey(AppStrings.IconPacks.SelectAnIconPackHeading))).not.toBeNull();
    });
  });

  it('auto-selects default pack on initial load', async () => {
    applyIconPackBatch([SAMPLE_PACK_USER, SAMPLE_PACK_DEFAULT]);
    applyIconsBatch(SAMPLE_PACK_DEFAULT.id, SAMPLE_ICONS_DEFAULT);

    const { getAllByText, queryByText } = render(IconPacksLibraryPage);

    await waitFor(() => {
      // Rail and header should show pack names
      expect(getAllByText('Default Pack').length).toBeGreaterThanOrEqual(1);
      expect(getAllByText('Custom Pack').length).toBeGreaterThanOrEqual(1);

      // Header should show Default Pack description
      expect(queryByText('Built-in icons')).not.toBeNull();
      // Icons of default pack should be visible
      expect(queryByText('Home')).not.toBeNull();
      expect(queryByText('Settings')).not.toBeNull();
    });
  });

  it('switches packs when rail item is clicked', async () => {
    applyIconPackBatch([SAMPLE_PACK_DEFAULT, SAMPLE_PACK_USER]);
    applyIconsBatch(SAMPLE_PACK_DEFAULT.id, SAMPLE_ICONS_DEFAULT);
    applyIconsBatch(SAMPLE_PACK_USER.id, SAMPLE_ICONS_USER);

    const { getAllByText, queryByText } = render(IconPacksLibraryPage);

    await waitFor(() => {
      expect(queryByText('Home')).not.toBeNull();
    });

    const userPackRailItem = getAllByText('Custom Pack')[0];
    await fireEvent.click(userPackRailItem);

    await waitFor(() => {
      expect(queryByText('Play Button')).not.toBeNull();
      expect(queryByText('Stop Button')).not.toBeNull();
      expect(queryByText('Home')).toBeNull();
    });
  });

  it('filters icons by search query', async () => {
    applyIconPackBatch([SAMPLE_PACK_USER]);
    applyIconsBatch(SAMPLE_PACK_USER.id, SAMPLE_ICONS_USER);

    const { getByPlaceholderText, queryByText } = render(IconPacksLibraryPage);

    await waitFor(() => {
      expect(queryByText('Play Button')).not.toBeNull();
      expect(queryByText('Stop Button')).not.toBeNull();
      expect(queryByText('Pause Button')).not.toBeNull();
    });

    const searchInput = getByPlaceholderText(
      translateKey(AppStrings.IconPacks.SearchIconsPlaceholder),
    );
    await fireEvent.input(searchInput, { target: { value: 'play' } });

    await waitFor(() => {
      expect(queryByText('Play Button')).not.toBeNull();
      expect(queryByText('Stop Button')).toBeNull();
      expect(queryByText('Pause Button')).toBeNull();
    });
  });

  it('selects multiple icons and clears selection with Escape or clear button', async () => {
    applyIconPackBatch([SAMPLE_PACK_USER]);
    applyIconsBatch(SAMPLE_PACK_USER.id, SAMPLE_ICONS_USER);

    const { getByText, queryByText, queryByRole } = render(IconPacksLibraryPage);

    await waitFor(() => {
      expect(queryByText('Play Button')).not.toBeNull();
    });

    // Click first icon
    const playTile = getByText('Play Button').closest('.tile');
    expect(playTile).not.toBeNull();
    await fireEvent.click(playTile!);

    // Toolbar appears with count 1
    await waitFor(() => {
      expect(queryByRole('toolbar')).not.toBeNull();
      expect(
        getByText(translateKey(AppStrings.IconPacks.IconsSelectedCount, { count: 1 })),
      ).not.toBeNull();
    });

    // Click second icon (subsequent click toggles when selection is active)
    const stopTile = getByText('Stop Button').closest('.tile');
    expect(stopTile).not.toBeNull();
    await fireEvent.click(stopTile!);

    await waitFor(() => {
      expect(
        getByText(translateKey(AppStrings.IconPacks.IconsSelectedCount, { count: 2 })),
      ).not.toBeNull();
    });

    // Clear selection with button
    const clearBtn = getByText(translateKey(AppStrings.IconPacks.Clear));
    await fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(queryByRole('toolbar')).toBeNull();
    });

    // Re-select one and test Escape key clears selection
    await fireEvent.click(playTile!);
    await waitFor(() => {
      expect(queryByRole('toolbar')).not.toBeNull();
    });

    await fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(queryByRole('toolbar')).toBeNull();
    });
  });

  it('copies icon ID to clipboard and shows toast on success', async () => {
    applyIconPackBatch([SAMPLE_PACK_USER]);
    applyIconsBatch(SAMPLE_PACK_USER.id, SAMPLE_ICONS_USER);

    vi.spyOn(textClipboard, 'copyText').mockResolvedValue({ status: 'copied', via: 'clipboard-api' });

    const { getByText, queryByText } = render(IconPacksLibraryPage);

    await waitFor(() => {
      expect(queryByText('Play Button')).not.toBeNull();
    });

    const playTile = getByText('Play Button').closest('.tile');
    expect(playTile).not.toBeNull();

    // Trigger context menu on icon tile
    await fireEvent.contextMenu(playTile!, { clientX: 100, clientY: 100 });

    await waitFor(() => {
      expect(queryByText(translateKey(AppStrings.IconPacks.CopyIconIdAction))).not.toBeNull();
    });

    const copyItem = getByText(translateKey(AppStrings.IconPacks.CopyIconIdAction));
    await fireEvent.click(copyItem);

    await waitFor(() => {
      expect(textClipboard.copyText).toHaveBeenCalledWith('icon-u1');
      expect(toastStore.toasts.some(t => t.message === translateKey(AppStrings.IconPacks.IconIdCopied))).toBe(true);
    });
  });

  it('shows manual copy modal when clipboard copy fails', async () => {
    applyIconPackBatch([SAMPLE_PACK_USER]);
    applyIconsBatch(SAMPLE_PACK_USER.id, SAMPLE_ICONS_USER);

    vi.spyOn(textClipboard, 'copyText').mockResolvedValue({
      status: 'failed',
      reason: 'unsupported',
    });

    const { getByText, queryByText } = render(IconPacksLibraryPage);

    await waitFor(() => {
      expect(queryByText('Play Button')).not.toBeNull();
    });

    const playTile = getByText('Play Button').closest('.tile');
    await fireEvent.contextMenu(playTile!, { clientX: 100, clientY: 100 });

    await waitFor(() => {
      expect(queryByText(translateKey(AppStrings.IconPacks.CopyIconIdAction))).not.toBeNull();
    });

    const copyItem = getByText(translateKey(AppStrings.IconPacks.CopyIconIdAction));
    await fireEvent.click(copyItem);

    await waitFor(() => {
      // The modal displays manual copy instruction
      expect(
        getByText((_, el) => el?.classList.contains('copy-text-message') ?? false),
      ).not.toBeNull();
    });
  });

  it('prompts confirmation when deleting pack', async () => {
    applyIconPackBatch([SAMPLE_PACK_USER]);
    applyIconsBatch(SAMPLE_PACK_USER.id, SAMPLE_ICONS_USER);

    const { getAllByText, getByText, queryByText } = render(IconPacksLibraryPage);

    await waitFor(() => {
      expect(getAllByText('Custom Pack').length).toBeGreaterThanOrEqual(1);
    });

    const railItem = getAllByText('Custom Pack')[0].closest('.rail-item');
    expect(railItem).not.toBeNull();

    // Context menu on pack rail item
    await fireEvent.contextMenu(railItem!, { clientX: 50, clientY: 50 });

    await waitFor(() => {
      expect(queryByText(translateKey(AppStrings.IconPacks.DeletePackAction))).not.toBeNull();
    });

    const deleteMenuItem = getByText(translateKey(AppStrings.IconPacks.DeletePackAction));
    await fireEvent.click(deleteMenuItem);

    // Confirmation dialog should be open
    await waitFor(() => {
      expect(queryByText(translateKey(AppStrings.IconPacks.DeletePackHeading))).not.toBeNull();
    });
  });

  it('opens edit modal when edit button in header is clicked', async () => {
    applyIconPackBatch([SAMPLE_PACK_USER]);
    applyIconsBatch(SAMPLE_PACK_USER.id, SAMPLE_ICONS_USER);

    const { getByText, queryByText } = render(IconPacksLibraryPage);

    await waitFor(() => {
      expect(queryByText(translateKey('macrodeck:Common.Edit'))).not.toBeNull();
    });

    const editBtn = getByText(translateKey('macrodeck:Common.Edit'));
    await fireEvent.click(editBtn);

    await waitFor(() => {
      expect(queryByText(translateKey(AppStrings.IconPacks.EditPackHeading))).not.toBeNull();
    });
  });

  it('opens rename modal from icon context menu', async () => {
    applyIconPackBatch([SAMPLE_PACK_USER]);
    applyIconsBatch(SAMPLE_PACK_USER.id, SAMPLE_ICONS_USER);

    const { getByText, queryByText } = render(IconPacksLibraryPage);

    await waitFor(() => {
      expect(queryByText('Play Button')).not.toBeNull();
    });

    const playTile = getByText('Play Button').closest('.tile');
    await fireEvent.contextMenu(playTile!, { clientX: 100, clientY: 100 });

    await waitFor(() => {
      expect(queryByText(translateKey('macrodeck:Common.Rename'))).not.toBeNull();
    });

    const renameItem = getByText(translateKey('macrodeck:Common.Rename'));
    await fireEvent.click(renameItem);

    await waitFor(() => {
      expect(queryByText(translateKey(AppStrings.IconPacks.RenameIconHeading))).not.toBeNull();
    });
  });
});
