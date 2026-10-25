/*
 * The UiRenderHost the widget preview renders against, ported from the
 * Angular UiWidgetRenderHostFactory with the desktop-specific services it
 * binds (server clock, font loader, video streams, icon appearance) reduced
 * to the pieces that exist on this side so far.
 *
 * `resourceUrl` is the load-bearing one: it resolves an icon/artwork resource
 * id into a fetchable URL against the connected host, which is what makes a
 * preview show the same images the deck shows.
 */

import {
  type UiNode,
  type UiRenderHost,
  uiResourceUrl,
} from '@macro-deck/runtime';
import { api } from '../api.svelte';
import { localization, localizationTranslator } from '../localization.svelte';
import type { UiNodeEventBus } from '../ui-node-event-bus';

/** See {@link UiRenderHost.fontFamily}: internal faces get a stable family name of their own. */
export function internalFontFamily(faceId: string): string {
  return faceId ? `MacroDeckFont_${faceId}` : '';
}

export function bindWidgetRenderHost(bus: UiNodeEventBus, ownsRootWidgetBorder: () => boolean = () => false): UiRenderHost {
  return {
    localization: localizationTranslator,

    resourceUrl: resource => {
      // The host may not have handed its base URL over yet; the admin is served
      // BY the host, so the page origin is the host origin to fall back to.
      const base = api.baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
      if (!base || !resource) return null;
      return uiResourceUrl(base, resource);
    },

    // The host's clock is what the looping animations phase-lock to; until a
    // server-clock port exists the device's is the best available estimate.
    now: () => Date.now(),

    // The host's language, not the browser's: a widget's dates are written in
    // the language the deck is configured for.
    culture: () => localization.culture,
    hourCycle: () => localization.hourCycle,
    hourPadded: () => localization.hourPadded,

    simpleRendering: () => false,

    fontFamily: faceId => `${internalFontFamily(faceId)}, var(--font-sans)`,
    fontReady: () => true,

    uiFontKey: () => '',

    videoStreams: () => null,

    emit: (node: UiNode, name: string, data?: unknown) => bus.emit(node, name, data),
    setPressed: (node: UiNode, pressed: boolean) => bus.setPressed(node, pressed),
    flashPressed: (node: UiNode) => bus.flashPressed(node),
    ownsRootWidgetBorder,
  };
}
