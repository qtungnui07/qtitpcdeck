import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcFolder, IpcProfile, IpcWidget } from '@macro-deck/runtime';
import { AppStrings } from '@macro-deck/runtime';
import { folderEndpoints, profileEndpoints } from '$lib/endpoints';


/*
 * Live tiles open a widget UI session per tile; jsdom has no host behind the
 * socket, and the open would hold every render until it fails. The session
 * layer is mocked to a closed handle so the grid renders its fallback labels
 * and the page's own behaviour is what the tests exercise.
 */
vi.mock('$lib/ui-session.svelte', () => ({
  openUiSession: vi.fn(() => ({
    root: null,
    revision: 0,
    rejection: null,
    fault: null,
    generation: 0,
    reopenReason: null,
    send: vi.fn(),
    close: vi.fn(),
  })),
}));
import {
  folderStore,
  loadFolders,
  resetFolders,
  selectFolder,
} from '$lib/folders.svelte';
import {
  loadProfiles,
  profileStore,
  resetProfiles,
} from '$lib/profiles.svelte';
import { startLocalization, stopLocalization, translateKey } from '$lib/localization.svelte';
import DeckPage from './DeckPage.svelte';

const SAMPLE_PROFILE: IpcProfile = {
  id: 'profile-1',
  name: 'Default Profile',
  order: 0,
  layoutType: 'Grid',
  layout: {
    rows: 3,
    columns: 5,
    rowsLocked: false,
    columnsLocked: false,
  },
  defaultRows: 3,
  defaultColumns: 5,
  defaultWidgetSpacing: 10,
  defaultWidgetBorderRadius: 8,
  defaultEmptyCellStyle: 'visible',
  isVirtual: false,
};

const SAMPLE_PROFILE_2: IpcProfile = {
  id: 'profile-2',
  name: 'Streaming Profile',
  order: 1,
  layoutType: 'Grid',
  layout: {
    rows: 4,
    columns: 6,
    rowsLocked: false,
    columnsLocked: false,
  },
  defaultRows: 4,
  defaultColumns: 6,
  isVirtual: false,
};

const SAMPLE_WIDGET: IpcWidget = {
  id: '00000000-0000-0000-0000-000000000001',
  type: 'ActionButton',
  positionX: 0,
  positionY: 0,
  width: 1,
  height: 1,
  data: JSON.stringify({ label: 'Mute Mic' }),
  isPinned: false,
  pinScope: 'Profile',
};

const SAMPLE_ROOT_FOLDER: IpcFolder = {
  id: '00000000-0000-0000-0000-000000000010',
  name: 'Main Deck',
  profileId: 'profile-1',
  order: 0,
  isDefault: true,
  columns: 5,
  rows: 3,
  widgetSpacing: 10,
  widgetBorderRadius: 8,
  emptyCellStyle: 'visible',
  backgroundColor: '#1e1e1e',
  backgroundColorSource: '#1e1e1e',
  viewId: 'macrodeck:widget-grid-view',
  widgets: [SAMPLE_WIDGET],
};

const SAMPLE_SUB_FOLDER: IpcFolder = {
  id: '00000000-0000-0000-0000-000000000020',
  name: 'Sub Folder',
  profileId: 'profile-1',
  parentId: '00000000-0000-0000-0000-000000000010',
  order: 1,
  isDefault: false,
  columns: 4,
  rows: 2,
  viewId: 'macrodeck:widget-grid-view',
  widgets: [],
};

describe('DeckPage', () => {
  beforeEach(() => {
    startLocalization();
    resetProfiles();
    resetFolders();
  });

  afterEach(() => {
    resetFolders();
    resetProfiles();
    stopLocalization();
    vi.restoreAllMocks();
  });

  it('renders empty state when no folder is selected', () => {
    const { getByText } = render(DeckPage);
    expect(getByText(translateKey(AppStrings.Deck.NoFoldersAvailable))).toBeDefined();
  });

  it('renders header, title, and widget grid when folder is loaded', async () => {
    vi.spyOn(profileEndpoints, 'list').mockResolvedValue({
      profiles: [SAMPLE_PROFILE],
    });
    vi.spyOn(folderEndpoints, 'list').mockResolvedValue({
      folders: [SAMPLE_ROOT_FOLDER],
    });

    await loadProfiles();
    await loadFolders('profile-1');

    const { getByText, container } = render(DeckPage);

    expect(container.querySelector('.deck-title')?.textContent).toBe('Main Deck');
    expect(getByText('Mute Mic')).toBeDefined();
    expect(container.querySelector('[data-testid="deck-grid"]')).not.toBeNull();
  });

  it('toggles edit mode when clicking unlock/lock button', async () => {
    vi.spyOn(profileEndpoints, 'list').mockResolvedValue({
      profiles: [SAMPLE_PROFILE],
    });
    vi.spyOn(folderEndpoints, 'list').mockResolvedValue({
      folders: [SAMPLE_ROOT_FOLDER],
    });

    await loadProfiles();
    await loadFolders('profile-1');

    const { getByText, container } = render(DeckPage);

    // Initial state: unlock button is shown (not in edit mode)
    const unlockBtn = getByText(translateKey(AppStrings.Deck.Unlock));
    expect(unlockBtn).toBeDefined();

    await fireEvent.click(unlockBtn);

    // Now in edit mode: lock button is shown
    expect(getByText(translateKey(AppStrings.Deck.Lock))).toBeDefined();
    expect(container.querySelector('.grid-container.edit-mode')).not.toBeNull();

    // In edit mode, settings button should be visible
    expect(getByText(translateKey(AppStrings.Widgets.Grid.SettingsTitle))).toBeDefined();
  });

  it('shows back button when navigation history allows going back', async () => {
    vi.spyOn(profileEndpoints, 'list').mockResolvedValue({
      profiles: [SAMPLE_PROFILE],
    });
    vi.spyOn(folderEndpoints, 'list').mockResolvedValue({
      folders: [SAMPLE_ROOT_FOLDER, SAMPLE_SUB_FOLDER],
    });

    await loadProfiles();
    await loadFolders('profile-1');

    selectFolder(SAMPLE_SUB_FOLDER.id);
    expect(folderStore.canGoBack).toBe(true);

    const { getByTitle, container } = render(DeckPage);
    expect(container.querySelector('.deck-title')?.textContent).toBe('Sub Folder');

    const backBtn = getByTitle('Go back');
    expect(backBtn).toBeDefined();

    await fireEvent.click(backBtn);
    expect(folderStore.selectedFolderId).toBe(SAMPLE_ROOT_FOLDER.id);
  });

  it('opens add widget modal when clicking empty cell in edit mode', async () => {
    vi.spyOn(profileEndpoints, 'list').mockResolvedValue({
      profiles: [SAMPLE_PROFILE],
    });
    vi.spyOn(folderEndpoints, 'list').mockResolvedValue({
      folders: [SAMPLE_ROOT_FOLDER],
    });

    await loadProfiles();
    await loadFolders('profile-1');

    const { getByText, getByLabelText, container } = render(DeckPage);

    // Enter edit mode
    await fireEvent.click(getByText(translateKey(AppStrings.Deck.Unlock)));

    // Click an unoccupied cell (SAMPLE_WIDGET is at 0,0, cell 1 is at 1,0)
    const emptyCells = container.querySelectorAll('.empty-cell');
    await fireEvent.click(emptyCells[1]);

    // Modal should open with the type picker, not a bare select of ids.
    expect(getByText(translateKey(AppStrings.Widgets.TypeSelector.Heading))).toBeDefined();
    expect(getByLabelText(translateKey(AppStrings.Widgets.TypeSelector.SearchAriaLabel))).toBeDefined();
    expect(getByText(translateKey(AppStrings.Widgets.TypeSelector.GroupBuiltIn))).toBeDefined();
  });

  it('opens grid settings modal in edit mode', async () => {
    vi.spyOn(profileEndpoints, 'list').mockResolvedValue({
      profiles: [SAMPLE_PROFILE],
    });
    vi.spyOn(folderEndpoints, 'list').mockResolvedValue({
      folders: [SAMPLE_ROOT_FOLDER],
    });

    await loadProfiles();
    await loadFolders('profile-1');

    const { getByText, getByLabelText } = render(DeckPage);

    // Enter edit mode
    await fireEvent.click(getByText(translateKey(AppStrings.Deck.Unlock)));

    // Click grid settings button
    const settingsBtn = getByLabelText(translateKey(AppStrings.Widgets.Grid.SettingsTitle));
    await fireEvent.click(settingsBtn);

    // Modal should be visible with columns setting
    expect(getByText(translateKey(AppStrings.Widgets.GridSettings.Columns))).toBeDefined();
  });

  it('allows switching profiles when multiple profiles exist', async () => {
    vi.spyOn(profileEndpoints, 'list').mockResolvedValue({
      profiles: [SAMPLE_PROFILE, SAMPLE_PROFILE_2],
    });
    vi.spyOn(folderEndpoints, 'list').mockResolvedValue({
      folders: [SAMPLE_ROOT_FOLDER],
    });

    await loadProfiles();
    await loadFolders('profile-1');

    const { getByLabelText } = render(DeckPage);

    const selectEl = getByLabelText('Profile selector') as HTMLSelectElement;
    expect(selectEl).toBeDefined();
    expect(selectEl.value).toBe('profile-1');

    await fireEvent.change(selectEl, { target: { value: 'profile-2' } });
    expect(profileStore.selectedProfileId).toBe('profile-2');
  });
});
