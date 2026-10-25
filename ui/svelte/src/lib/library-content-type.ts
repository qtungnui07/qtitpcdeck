/*
 * The library content types and subpage metadata.
 *
 * The Library page has a tab per content type (currently Icon Packs and Fonts).
 * These definitions provide the routing and localization keys used by the
 * switcher.
 */

import { AppStrings } from '@macro-deck/runtime';

export interface LibraryContentType {
  readonly id: string;
  readonly route: string;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly icon: string;
}

export const ICON_PACKS_CONTENT_TYPE = 'icon-packs';

export const FONTS_CONTENT_TYPE = 'fonts';

export const LIBRARY_CONTENT_TYPES: readonly LibraryContentType[] = [
  {
    id: ICON_PACKS_CONTENT_TYPE,
    route: '/library/icon-packs',
    labelKey: AppStrings.Nav.IconPacks,
    descriptionKey: AppStrings.Library.Page.IconPacksDescription,
    icon: 'image',
  },
  {
    id: FONTS_CONTENT_TYPE,
    route: '/library/fonts',
    labelKey: AppStrings.Nav.Fonts,
    descriptionKey: AppStrings.Library.Page.FontsDescription,
    icon: 'type',
  },
];
