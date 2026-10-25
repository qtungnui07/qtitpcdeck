/*
 * The user-installed font library store.
 *
 * Font loading fetches the user-installed TrueType/OpenType fonts from the host.
 * Changes to installed fonts happen on demand through import and delete actions.
 */

import type { UserFont, UserFontImportResult } from '@macro-deck/runtime';
import { fontEndpoints } from './endpoints';

export interface FontFamilyGroup {
  family: string;
  faces: UserFont[];
}

export interface UserFontImportOutcome {
  success: boolean;
  results: UserFontImportResult[];
}

const SLANT_ORDER: Record<UserFont['slant'], number> = { upright: 0, italic: 1, oblique: 2 };

let fonts = $state<UserFont[]>([]);
let isLoading = $state(false);
let loadError = $state<string | null>(null);

let fetchSequence = 0;

export function groupFontFamilies(fontList: readonly UserFont[]): FontFamilyGroup[] {
  const byFamily = new Map<string, UserFont[]>();
  for (const font of fontList) {
    const list = byFamily.get(font.family);
    if (list) {
      list.push(font);
    } else {
      byFamily.set(font.family, [font]);
    }
  }
  return [...byFamily.entries()]
    .map(([family, faces]) => ({
      family,
      faces: faces
        .slice()
        .sort((a, b) => a.weight - b.weight || SLANT_ORDER[a.slant] - SLANT_ORDER[b.slant]),
    }))
    .sort((a, b) => a.family.localeCompare(b.family));
}

export function internalFontFamily(faceId: string): string {
  return `MacroDeckFont_${faceId}`;
}

export function sampleFontFamily(font: UserFont): string {
  return `"${internalFontFamily(font.faceId)}", var(--font-sans)`;
}

export function ensureFontFace(faceId: string): void {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !('fonts' in document)) {
    return;
  }
  if (!faceId) return;
  const family = internalFontFamily(faceId);
  for (const fontFace of document.fonts) {
    if (fontFace.family === family) return;
  }
  const match = /-(\d+)-\d+-(upright|italic|oblique)(?:-\d+)?$/.exec(faceId);
  const descriptors: FontFaceDescriptors = match
    ? { weight: match[1], style: match[2] === 'upright' ? 'normal' : match[2] }
    : {};
  const source = `url(${fontEndpoints.fontFileUrl(faceId)})`;
  try {
    const face = new FontFace(family, source, descriptors);
    face
      .load()
      .then(loaded => {
        document.fonts.add(loaded);
      })
      .catch(() => {});
  } catch {
    // FontFace constructor unavailable or unsupported in environment
  }
}

export function evictFontFace(faceId: string): void {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !('fonts' in document)) {
    return;
  }
  const family = internalFontFamily(faceId);
  for (const fontFace of Array.from(document.fonts)) {
    if (fontFace.family === family) {
      document.fonts.delete(fontFace);
    }
  }
}

export const userFontStore = {
  get fonts(): readonly UserFont[] {
    return fonts;
  },
  get groups(): readonly FontFamilyGroup[] {
    return groupFontFamilies(fonts);
  },
  get isLoading(): boolean {
    return isLoading;
  },
  get loadError(): string | null {
    return loadError;
  },
  get fontCount(): number {
    return fonts.length;
  },
};

export async function loadUserFonts(): Promise<void> {
  const seq = ++fetchSequence;
  isLoading = true;
  loadError = null;

  try {
    const response = await fontEndpoints.userFonts();
    if (seq !== fetchSequence) return;
    fonts = response.fonts ?? [];
  } catch (error) {
    if (seq !== fetchSequence) return;
    console.error('Failed to load user fonts:', error);
    loadError = error instanceof Error ? error.message : String(error);
  } finally {
    if (seq === fetchSequence) {
      isLoading = false;
    }
  }
}

export async function importUserFonts(files: File[]): Promise<UserFontImportOutcome> {
  if (files.length === 0) {
    return { success: true, results: [] };
  }

  const form = new FormData();
  for (const file of files) {
    form.append('files', file, file.name);
  }

  try {
    const response = await fontEndpoints.importFonts(form);
    const results = response.results ?? [];
    if (!response.success) {
      return { success: false, results };
    }

    const imported = results.filter(r => r.status === 'Imported' && r.font);
    for (const r of imported) {
      if (r.font) {
        evictFontFace(r.font.faceId);
      }
    }
    await loadUserFonts();
    return { success: true, results };
  } catch (error) {
    console.error('Failed to import user fonts:', error);
    return { success: false, results: [] };
  }
}

export async function removeUserFont(fontId: string): Promise<boolean> {
  const font = fonts.find(f => f.fontId === fontId);
  try {
    const response = await fontEndpoints.deleteFont(fontId);
    if (!response.success) {
      return false;
    }
  } catch (error) {
    console.error('Failed to remove user font:', error);
    return false;
  }

  fonts = fonts.filter(f => f.fontId !== fontId);
  if (font) {
    evictFontFace(font.faceId);
  }
  return true;
}

export function userFontFileUrl(faceId: string): string {
  return fontEndpoints.fontFileUrl(faceId);
}

export function applyUserFontBatch(incoming: UserFont[]): void {
  fonts = [...incoming];
}

export function resetUserFonts(): void {
  fonts = [];
  isLoading = false;
  loadError = null;
  fetchSequence = 0;
}
