/*
 * The widget type catalogue, ported from the Angular WidgetTypeCatalogService.
 *
 * The host owns the list of widget types (built-ins plus every plugin's), so
 * this store is a cache of `GET /api/widgets/types` that reloads whenever the
 * socket reconnects or the host announces the catalogue changed. `infoFor` is
 * the lookup the widget editor uses to decide whether a type has a config UI
 * at all and which model version it speaks.
 */

import {
  resolveLocalizedText,
  type WidgetType,
  type WidgetTypeDto,
} from '@macro-deck/runtime';
import { onConnected, onNotificationOf } from './api.svelte';
import { localizationTranslator } from './localization.svelte';
import { widgetTypeEndpoints } from './endpoints';

let types = $state<readonly WidgetTypeDto[]>([]);
let loaded = false;
let inFlight: Promise<void> | null = null;

let started = false;
let unsubscribes: Array<() => void> = [];

function plainSnapshot(value: unknown): any {
  return ($state.snapshot as (source: unknown) => unknown)(value);
}

export const widgetTypeStore = {
  get types(): readonly WidgetTypeDto[] {
    return types;
  },
};

export function widgetTypeName(type: WidgetType | string): string {
  const entry = types.find(t => t.id === type);
  return (entry && resolveLocalizedText(entry.name, localizationTranslator)) || type;
}

export function defaultWidgetDataFor(type: WidgetType | string): Record<string, unknown> | undefined {
  const entry = types.find(t => t.id === type);
  return entry ? plainSnapshot(entry.defaultData) : undefined;
}

export async function loadWidgetTypes(): Promise<void> {
  if (loaded) return;

  inFlight ??= runLoad().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runLoad(): Promise<void> {
  try {
    const response = await widgetTypeEndpoints.list();
    if (response.success) {
      types = response.types ?? [];
      loaded = true;
    }
  } catch (error) {
    console.error('Failed to load widget types:', error);
  }
}

export async function reloadWidgetTypes(): Promise<void> {
  loaded = false;
  await loadWidgetTypes();
}

export async function widgetTypeInfoFor(type: WidgetType | string): Promise<WidgetTypeDto | null> {

  await loadWidgetTypes();
  return types.find(entry => entry.id === type) ?? null;
}

export function startWidgetTypes(): void {
  if (started) return;
  started = true;

  unsubscribes = [
    onConnected(() => {
      // The catalogue can change while the socket was down, and the load
      // guard would keep serving the stale copy forever.
      loaded = false;
      void loadWidgetTypes();
    }),

    onNotificationOf<{ types?: WidgetTypeDto[] }>('WidgetTypeCatalogChangedEvent', event => {
      types = event.types ?? [];
    }),
  ];
}

export function stopWidgetTypes(): void {
  for (const unsubscribe of unsubscribes) unsubscribe();
  unsubscribes = [];
  started = false;
}

export function resetWidgetTypes(): void {
  stopWidgetTypes();
  types = [];
  loaded = false;
  inFlight = null;
}
