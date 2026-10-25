import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserFont } from '@macro-deck/runtime';
import { fontEndpoints } from './endpoints';
import {
  applyUserFontBatch,
  groupFontFamilies,
  importUserFonts,
  loadUserFonts,
  removeUserFont,
  resetUserFonts,
  userFontStore,
} from './user-fonts.svelte';

const SAMPLE_FONT: UserFont = {
  fontId: 'font-1',
  faceId: 'face-1',
  family: 'Roboto',
  styleName: 'Regular',
  weight: 400,
  width: 100,
  slant: 'upright',
  format: 'ttf',
  sizeBytes: 102400,
};

const SAMPLE_FONT_BOLD: UserFont = {
  fontId: 'font-2',
  faceId: 'face-2',
  family: 'Roboto',
  styleName: 'Bold',
  weight: 700,
  width: 100,
  slant: 'upright',
  format: 'ttf',
  sizeBytes: 105000,
};

const SAMPLE_FONT_OTHER: UserFont = {
  fontId: 'font-3',
  faceId: 'face-3',
  family: 'Arial',
  styleName: 'Regular',
  weight: 400,
  width: 100,
  slant: 'upright',
  format: 'otf',
  sizeBytes: 90000,
};

describe('userFontStore', () => {
  beforeEach(() => {
    resetUserFonts();
  });

  afterEach(() => {
    resetUserFonts();
    vi.restoreAllMocks();
  });

  it('initializes with empty state', () => {
    expect(userFontStore.fonts).toEqual([]);
    expect(userFontStore.fontCount).toBe(0);
    expect(userFontStore.isLoading).toBe(false);
    expect(userFontStore.loadError).toBeNull();
  });

  it('groups fonts by family and sorts by weight and slant', () => {
    const groups = groupFontFamilies([SAMPLE_FONT_BOLD, SAMPLE_FONT_OTHER, SAMPLE_FONT]);
    expect(groups).toHaveLength(2);
    expect(groups[0].family).toBe('Arial');
    expect(groups[1].family).toBe('Roboto');
    expect(groups[1].faces[0].styleName).toBe('Regular');
    expect(groups[1].faces[1].styleName).toBe('Bold');
  });

  it('updates state via applyUserFontBatch', () => {
    applyUserFontBatch([SAMPLE_FONT]);
    expect(userFontStore.fonts).toHaveLength(1);
    expect(userFontStore.fontCount).toBe(1);
    expect(userFontStore.fonts[0].family).toBe('Roboto');
  });

  it('loads fonts from endpoint', async () => {
    vi.spyOn(fontEndpoints, 'userFonts').mockResolvedValue({
      fonts: [SAMPLE_FONT],
    });

    await loadUserFonts();

    expect(userFontStore.fonts).toHaveLength(1);
    expect(userFontStore.fontCount).toBe(1);
    expect(userFontStore.isLoading).toBe(false);
    expect(userFontStore.loadError).toBeNull();
  });

  it('records error when loading fails', async () => {
    vi.spyOn(fontEndpoints, 'userFonts').mockRejectedValue(new Error('Network offline'));

    await loadUserFonts();

    expect(userFontStore.fonts).toEqual([]);
    expect(userFontStore.loadError).toBe('Network offline');
    expect(userFontStore.isLoading).toBe(false);
  });

  it('removes a font and updates state', async () => {
    applyUserFontBatch([SAMPLE_FONT, SAMPLE_FONT_OTHER]);
    vi.spyOn(fontEndpoints, 'deleteFont').mockResolvedValue({ success: true });

    const ok = await removeUserFont('font-1');
    expect(ok).toBe(true);
    expect(userFontStore.fonts).toHaveLength(1);
    expect(userFontStore.fonts[0].fontId).toBe('font-3');
  });

  it('imports fonts and reloads font list', async () => {
    vi.spyOn(fontEndpoints, 'importFonts').mockResolvedValue({
      success: true,
      results: [{ fileName: 'Roboto.ttf', status: 'Imported', font: SAMPLE_FONT }],
    });
    vi.spyOn(fontEndpoints, 'userFonts').mockResolvedValue({
      fonts: [SAMPLE_FONT],
    });

    const file = new File(['mock'], 'Roboto.ttf', { type: 'font/ttf' });
    const outcome = await importUserFonts([file]);

    expect(outcome.success).toBe(true);
    expect(outcome.results).toHaveLength(1);
    expect(userFontStore.fonts).toHaveLength(1);
  });
});
