import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startLocalization, translateKey } from '$lib/localization.svelte';
import { AppStrings } from '@macro-deck/runtime';

const state = vi.hoisted(() => ({
  widget: {
    id: 'w1',
    type: 'ActionButton',
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    isPinned: false,
    data: { label: 'CrystalDiskInfo', flows: '[]' },
  },
}));

vi.mock('$lib/folders.svelte', () => ({
  folderStore: { folders: [{ id: 'f1', widgets: [state.widget] }], selectedFolderId: 'f1' },
  findWidget: (id: string) => (id === 'w1' ? state.widget : undefined),
  loadFolders: vi.fn(async () => {}),
  selectFolder: vi.fn(),
  updateWidget: vi.fn(async () => ({ success: true })),
}));

vi.mock('$lib/router.svelte', () => ({
  route: { params: { widgetId: 'w1' } },
  navigate: vi.fn(async () => {}),
}));

import WidgetEditorPage from './WidgetEditorPage.svelte';

/*
 * The page used to render its "Loading editor…" state until the editor inside
 * it reported ready - but the editor was only mounted once ready, so it never
 * got the chance and every widget opened onto a spinner forever. The page must
 * mount the editor on its own and let it report readiness.
 */
describe('WidgetEditorPage', () => {
  beforeEach(() => {
    startLocalization();
  });

  it('mounts the editor for a known widget instead of waiting on its ready flag', async () => {
    const { container, queryByText } = render(WidgetEditorPage);
    await tick();
    await tick();

    expect(container.querySelector('.editor-pane')).not.toBeNull();
    expect(queryByText(translateKey(AppStrings.WidgetEditor.Page.LoadingEditor))).toBeNull();
  });
});
