/*
 * Translations, ported from the Angular LocalizationService.
 *
 * The same eight localStorage keys, the same bundled defaults, the same
 * plural-and-fallback lookup, so a user who switches between the two builds
 * keeps their language. What changed is the container: Angular signals became
 * runes, and the RxJS notification subscriptions became plain callbacks.
 *
 * `translate` is a plain function rather than a method on an object, because
 * that is what a Svelte template wants: `{translateKey(Strings.Common.Close)}` reads
 * the rune inside the call, so the compiler sees the dependency.
 */

import {
  AppStringsDefaults,
  asLocalizedRef,
  effectiveCulture,
  formatTemplate,
  pluralForm,
  StringsDefaults,
  textDirection,
  type GetLocalizationResponse,
  type LocalizationCatalogChangedEvent,
  type LocalizationCultureChangedEvent,
  type LocalizationHourCycle,
  type LocalizationTimeFormat,
  type UpdateLocalizationSettingsRequest,
} from '@macro-deck/runtime';
import { onNotificationOf, resolveBaseUrl } from './api.svelte';
import { localizationEndpoints } from './endpoints';

const STORAGE_KEY_CULTURE = 'md.localization.culture';
const STORAGE_KEY_FALLBACK_CULTURE = 'md.localization.fallbackCulture';
const STORAGE_KEY_TRANSLATIONS = 'md.localization.translations';
const STORAGE_KEY_AVAILABLE_CULTURES = 'md.localization.availableCultures';
const STORAGE_KEY_FOLLOW_SYSTEM = 'md.localization.followSystem';
const STORAGE_KEY_TIME_FORMAT = 'md.localization.timeFormat';
const STORAGE_KEY_HOUR_CYCLE = 'md.localization.hourCycle';
const STORAGE_KEY_HOUR_PADDED = 'md.localization.hourPadded';

export const DEFAULT_CULTURE = 'en';

const MAX_ARGUMENT_DEPTH = 4;

export interface TimeLocale {
  locale: string;
  hourCycle?: LocalizationHourCycle;
}

const BUNDLED_DEFAULTS: Readonly<Record<string, string>> = { ...StringsDefaults, ...AppStringsDefaults };

/*
 * State is held in plain `$state` primitives, not in a wrapper object behind
 * getters. Svelte 5 tracks reads statically, so a getter that reads a rune is
 * not a dependency the compiler can see.
 */
let culture = $state(DEFAULT_CULTURE);
let fallbackCulture = $state(DEFAULT_CULTURE);
let availableCultures = $state<string[]>([]);
let followsSystem = $state(false);
let timeFormat = $state<LocalizationTimeFormat>('system');
let hourCycle = $state<LocalizationHourCycle | undefined>(undefined);
let hourPadded = $state<boolean | undefined>(undefined);
let translations = $state<Record<string, string>>({ ...BUNDLED_DEFAULTS });
let catalogVersion = $state(0);

let started = false;
let unsubscribes: Array<() => void> = [];

export const localization = {
  get culture(): string {
    return culture;
  },
  get fallbackCulture(): string {
    return fallbackCulture;
  },
  get availableCultures(): readonly string[] {
    return availableCultures;
  },
  get followsSystem(): boolean {
    return followsSystem;
  },
  get timeFormat(): LocalizationTimeFormat {
    return timeFormat;
  },
  get hourCycle(): LocalizationHourCycle | undefined {
    return hourCycle;
  },
  get hourPadded(): boolean | undefined {
    return hourPadded;
  },
  get catalogVersion(): number {
    return catalogVersion;
  },
};

/**
 * Restores the cached catalogue and starts following the host.
 *
 * Idempotent: the app calls it once at startup, and a second call is a no-op
 * rather than a second set of listeners.
 */
export function startLocalization(): void {
  if (started) return;
  started = true;

  restoreFromCache();

  unsubscribes = [
    onNotificationOf<LocalizationCultureChangedEvent>('LocalizationCultureChangedEvent', () => {
      void loadFromHost();
    }),
    onNotificationOf<LocalizationCatalogChangedEvent>('LocalizationCatalogChangedEvent', () => {
      void loadFromHost();
    }),
  ];

  void loadFromHost();
}

/**
 * Undoes startLocalization: drops the host listeners and forgets the cached
 * catalogue, so the next startLocalization re-reads storage from scratch.
 *
 * The app never calls this - it exists so a test can exercise startup more than
 * once in a single module instance, which the `started` guard would otherwise
 * make impossible.
 */
export function stopLocalization(): void {
  for (const unsubscribe of unsubscribes) unsubscribe();
  unsubscribes = [];
  started = false;

  culture = DEFAULT_CULTURE;
  fallbackCulture = DEFAULT_CULTURE;
  availableCultures = [];
  followsSystem = false;
  timeFormat = 'system';
  hourCycle = undefined;
  hourPadded = undefined;
  translations = { ...BUNDLED_DEFAULTS };
  catalogVersion = 0;
}

export async function loadFromHost(): Promise<void> {
  try {
    if ((await resolveBaseUrl()) === null) return;
    applyCatalog(await localizationEndpoints.catalog());
  } catch {
  }
}

export async function setCulture(next: string): Promise<void> {
  await applyLocalizationSettings({ culture: next });
}

export async function followSystemCulture(): Promise<void> {
  await applyLocalizationSettings({ followSystem: true });
}

export async function setTimeFormat(next: LocalizationTimeFormat): Promise<void> {
  await applyLocalizationSettings({ timeFormat: next });
}

export function timeLocale(): TimeLocale {
  return { locale: culture, hourCycle };
}

async function applyLocalizationSettings(request: UpdateLocalizationSettingsRequest): Promise<void> {
  try {
    const response = await localizationEndpoints.updateSettings(request);
    if (!response.success) return;
  } catch {
    return;
  }
  await loadFromHost();
}

/**
 * Translates a scoped key.
 *
 * An unknown key renders as `[[scope:key]]` rather than an empty string, so a
 * missing translation is visible instead of silently blank.
 */
export function translate(scope: string, key: string, args?: Record<string, unknown>): string {
  const qualified = `${scope}:${key}`;
  const template = templateFor(qualified, args);
  return template === undefined
    ? `[[${qualified}]]`
    : formatTemplate(template, resolveArguments(args));
}

/** Translates a key that already carries its scope, e.g. `Common:Close`. */
export function translateKey(qualifiedKey: string, args?: Record<string, unknown>): string {
  const separator = qualifiedKey.indexOf(':');
  if (separator < 0) return `[[${qualifiedKey}]]`;
  return translate(qualifiedKey.slice(0, separator), qualifiedKey.slice(separator + 1), args);
}

/*
 * The shape the runtime's `resolveLocalizedText` expects. It takes an object rather than a bare
 * function so a caller can pass a stub, and so the runtime never has to know about runes.
 */
export const localizationTranslator = {
  translate,
};

function resolveArguments(
  args: Record<string, unknown> | undefined,
  depth = 0,
): Record<string, unknown> | undefined {
  if (!args || depth >= MAX_ARGUMENT_DEPTH) return args;

  let resolved: Record<string, unknown> | undefined;

  for (const [name, value] of Object.entries(args)) {
    const ref = asLocalizedRef(value);
    if (!ref) continue;

    resolved ??= { ...args };
    resolved[name] = translate(ref.scope, ref.key, resolveArguments(ref.arguments, depth + 1));
  }

  return resolved ?? args;
}

function templateFor(qualified: string, args?: Record<string, unknown>): string | undefined {
  const exact = translations[qualified];
  if (exact !== undefined) return exact;

  const count = args?.['count'];
  if (count === undefined) return undefined;

  return translations[`${qualified}.${pluralForm(count)}`] ?? translations[`${qualified}.Other`];
}

function applyCatalog(response: GetLocalizationResponse): void {
  culture = response.culture || DEFAULT_CULTURE;
  fallbackCulture = response.fallbackCulture || DEFAULT_CULTURE;
  merge(response.translations ?? {});
  availableCultures = response.availableCultures ?? [];
  followsSystem = response.followSystem ?? false;
  timeFormat = isTimeFormat(response.timeFormat) ? response.timeFormat : 'system';
  hourCycle = isHourCycle(response.hourCycle) ? response.hourCycle : undefined;
  hourPadded = typeof response.hourPadded === 'boolean' ? response.hourPadded : undefined;
  catalogVersion++;
  syncDocument();
  persist();
}

function syncDocument(): void {
  const served = effectiveCulture(culture, availableCultures);
  const root = document.documentElement;
  root.lang = served;
  root.dir = textDirection(served);
}

function merge(next: Record<string, string>): void {
  translations = { ...BUNDLED_DEFAULTS, ...next };
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY_CULTURE, culture);
    localStorage.setItem(STORAGE_KEY_FALLBACK_CULTURE, fallbackCulture);
    localStorage.setItem(STORAGE_KEY_TRANSLATIONS, JSON.stringify(translations));
    localStorage.setItem(STORAGE_KEY_AVAILABLE_CULTURES, JSON.stringify(availableCultures));
    localStorage.setItem(STORAGE_KEY_FOLLOW_SYSTEM, String(followsSystem));
    localStorage.setItem(STORAGE_KEY_TIME_FORMAT, timeFormat);
    if (hourCycle) localStorage.setItem(STORAGE_KEY_HOUR_CYCLE, hourCycle);
    else localStorage.removeItem(STORAGE_KEY_HOUR_CYCLE);
    if (hourPadded === undefined) localStorage.removeItem(STORAGE_KEY_HOUR_PADDED);
    else localStorage.setItem(STORAGE_KEY_HOUR_PADDED, String(hourPadded));
  } catch {
  }
}

function restoreFromCache(): void {
  try {
    const cachedCulture = localStorage.getItem(STORAGE_KEY_CULTURE);
    const cachedFallback = localStorage.getItem(STORAGE_KEY_FALLBACK_CULTURE);
    const rawTranslations = localStorage.getItem(STORAGE_KEY_TRANSLATIONS);
    const rawAvailableCultures = localStorage.getItem(STORAGE_KEY_AVAILABLE_CULTURES);
    const cachedFollowSystem = localStorage.getItem(STORAGE_KEY_FOLLOW_SYSTEM);

    if (cachedCulture) culture = cachedCulture;
    if (cachedFallback) fallbackCulture = cachedFallback;
    if (cachedFollowSystem) followsSystem = cachedFollowSystem === 'true';

    const cachedTimeFormat = localStorage.getItem(STORAGE_KEY_TIME_FORMAT);
    if (isTimeFormat(cachedTimeFormat)) timeFormat = cachedTimeFormat;

    const cachedHourCycle = localStorage.getItem(STORAGE_KEY_HOUR_CYCLE);
    if (isHourCycle(cachedHourCycle)) hourCycle = cachedHourCycle;

    const cachedHourPadded = localStorage.getItem(STORAGE_KEY_HOUR_PADDED);
    if (cachedHourPadded === 'true' || cachedHourPadded === 'false') {
      hourPadded = cachedHourPadded === 'true';
    }

    if (rawTranslations) {
      const parsed: unknown = JSON.parse(rawTranslations);
      if (isTranslationMap(parsed)) merge(parsed);
    }

    if (rawAvailableCultures) {
      const parsed: unknown = JSON.parse(rawAvailableCultures);
      if (isStringArray(parsed)) availableCultures = parsed;
    }
  } catch {
  }
  syncDocument();
}

function isTimeFormat(value: unknown): value is LocalizationTimeFormat {
  return value === 'system' || value === '12h' || value === '24h';
}

function isHourCycle(value: unknown): value is LocalizationHourCycle {
  return value === 'h12' || value === 'h23';
}

function isTranslationMap(value: unknown): value is Record<string, string> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.values(value).every(entry => typeof entry === 'string');
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'string');
}
