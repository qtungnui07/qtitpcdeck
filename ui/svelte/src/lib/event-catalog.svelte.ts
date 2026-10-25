/*
 * The event catalogue, ported from the Angular EventCatalogService: the
 * definitions every provider exposes, localized once at load, grouped by
 * provider for the trigger editor's two selects.
 */

import {
  type EventDefinition,
  type EventDefinitionDto,
  type EventProviderGroup,
  groupEventsByProvider,
  resolveLocalizedText,
} from '@macro-deck/runtime';
import { eventEndpoints } from './endpoints';
import { localizationTranslator } from './localization.svelte';
import { mapActionParameterDef } from './action-parameter-mapping';

let events = $state<EventDefinition[]>([]);
let loading = $state(false);
let loadError = $state<string | null>(null);
let loaded = false;
let inFlight: Promise<void> | null = null;

export const eventCatalog = {
  get events(): readonly EventDefinition[] {
    return events;
  },
  get loading(): boolean {
    return loading;
  },
  get error(): string | null {
    return loadError;
  },
};

export function loadEventCatalog(): Promise<void> {
  if (loaded) return Promise.resolve();
  return (inFlight ??= fetchEvents());
}

export function reloadEventCatalog(): Promise<void> {
  loaded = false;
  inFlight = null;
  return loadEventCatalog();
}

export function resetEventCatalog(): void {
  events = [];
  loading = false;
  loadError = null;
  loaded = false;
  inFlight = null;
}

export function findEventDefinition(qualifiedId: string | undefined): EventDefinition | undefined {
  if (!qualifiedId) return undefined;
  return events.find(event => event.id === qualifiedId);
}

export function eventProviderGroups(): EventProviderGroup[] {
  return groupEventsByProvider(events);
}

function mapEvent(event: EventDefinitionDto): EventDefinition {
  return {
    ...event,
    providerName: resolveLocalizedText(event.providerName, localizationTranslator),
    name: resolveLocalizedText(event.name, localizationTranslator),
    description: resolveLocalizedText(event.description, localizationTranslator) || undefined,
    category: resolveLocalizedText(event.category, localizationTranslator) || undefined,
    configurationParameters: (event.configurationParameters ?? []).map(p =>
      mapActionParameterDef(p, localizationTranslator),
    ),
    payloadParameters: (event.payloadParameters ?? []).map(p => mapActionParameterDef(p, localizationTranslator)),
  };
}

async function fetchEvents(): Promise<void> {
  loading = true;
  loadError = null;
  try {
    const response = await eventEndpoints.list();
    events = (response.events ?? []).map(mapEvent);
    loaded = true;
  } catch {
    loadError = 'Failed to load the event catalogue.';
    events = [];
  } finally {
    loading = false;
    inFlight = null;
  }
}
