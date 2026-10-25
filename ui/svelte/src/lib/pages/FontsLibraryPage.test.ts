import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStrings, Strings, type UserFont } from '@macro-deck/runtime';
import * as api from '$lib/api.svelte';
import { clearToasts } from '$lib/toasts.svelte';
import {
  applyUserFontBatch,
  resetUserFonts,
} from '$lib/user-fonts.svelte';
import { startLocalization, stopLocalization, translateKey } from '$lib/localization.svelte';
import FontsLibraryPage from './FontsLibraryPage.svelte';

const SAMPLE_FONT: UserFont = {
  fontId: 'font-1',
  faceId: 'face-1',
  family: 'Roboto',
  styleName: 'Regular',
  weight: 400,
  width: 100,
  slant: 'upright',
  format: 'ttf',
  sizeBytes: 10240,
};

describe('FontsLibraryPage', () => {
  beforeEach(() => {
    startLocalization();
    resetUserFonts();
    clearToasts();
    vi.spyOn(api, 'get').mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    stopLocalization();
    resetUserFonts();
    clearToasts();
  });

  it('renders empty state when no fonts installed', async () => {
    const { getByText } = render(FontsLibraryPage);

    await waitFor(() => {
      expect(getByText(translateKey(AppStrings.Library.Fonts.EmptyTitle))).not.toBeNull();
      expect(getByText(translateKey(AppStrings.Library.Fonts.EmptyDescription))).not.toBeNull();
    });
  });

  it('renders font family groups and face styles', () => {
    applyUserFontBatch([
      SAMPLE_FONT,
      {
        fontId: 'font-2',
        faceId: 'face-2',
        family: 'Roboto',
        styleName: 'Bold',
        weight: 700,
        width: 100,
        slant: 'upright' as const,
        format: 'otf' as const,
        sizeBytes: 20480,
      },
    ]);

    const { getByText } = render(FontsLibraryPage);

    expect(getByText('Roboto')).not.toBeNull();
    expect(getByText('Regular')).not.toBeNull();
    expect(getByText('Bold')).not.toBeNull();
    expect(getByText('TTF')).not.toBeNull();
    expect(getByText('OTF')).not.toBeNull();
  });

  it('shows confirmation dialog on remove click and cancels', async () => {
    applyUserFontBatch([SAMPLE_FONT]);

    const { container, getByText, queryByText } = render(FontsLibraryPage);

    const removeBtn = container.querySelector('button[title*="Roboto"]') as HTMLButtonElement;
    expect(removeBtn).not.toBeNull();

    await fireEvent.click(removeBtn);

    expect(getByText(translateKey(AppStrings.Library.Fonts.RemoveConfirmHeading))).not.toBeNull();

    const cancelBtn = getByText(translateKey(Strings.Common.Cancel));
    await fireEvent.click(cancelBtn);

    expect(queryByText(translateKey(AppStrings.Library.Fonts.RemoveConfirmHeading))).toBeNull();
  });

  it('deletes font when removal is confirmed', async () => {
    applyUserFontBatch([SAMPLE_FONT]);
    const delSpy = vi.spyOn(api, 'del').mockResolvedValue({ success: true } as never);

    const { container, getByText } = render(FontsLibraryPage);

    const removeBtn = container.querySelector('button[title*="Roboto"]') as HTMLButtonElement;
    await fireEvent.click(removeBtn);

    const confirmBtn = getByText(translateKey(AppStrings.Library.Fonts.RemoveConfirmAction));
    await fireEvent.click(confirmBtn);

    expect(delSpy).toHaveBeenCalledWith('/api/fonts/font-1');
  });

  it('toggles drag over state on dragover and dragleave', async () => {
    const { container } = render(FontsLibraryPage);
    const region = container.querySelector('.fonts-page')!;

    await fireEvent.dragOver(region);
    expect(region.classList.contains('file-drag-over')).toBe(true);

    await fireEvent.dragLeave(region);
    expect(region.classList.contains('file-drag-over')).toBe(false);
  });
});
