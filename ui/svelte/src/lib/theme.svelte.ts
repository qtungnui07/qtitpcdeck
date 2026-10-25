/*
 * Theme state, ported from the Angular ThemeService.
 *
 * The behaviour is deliberately identical: the same three localStorage keys, the
 * same system-preference listener, the same DOM writes. Only the state container
 * changed - Angular signals became Svelte 5 runes - so a user who switches
 * between the two builds keeps their theme and accent.
 *
 * The accent is stored as a literal colour here. The Angular service also
 * supports a *reference* to a colour the host resolves (a variable or an event
 * payload), which needs the API client; that arrives with the transport layer and
 * is the one piece of this file that is not yet ported.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY_MODE = 'md.appearance.themeMode';
const STORAGE_KEY_ACCENT = 'md.appearance.accentColor';
const STORAGE_KEY_FONT = 'md.appearance.fontFamily';

/** Nord Frost nord8, matching AppPreferenceService.DefaultAccentColor on the host. */
export const DEFAULT_ACCENT_COLOR = '#88C0D0';
export const DEFAULT_THEME_MODE: ThemeMode = 'system';

/*
 * State is held in plain `$state` primitives rather than in a wrapper object
 * with getters. Svelte 5 tracks reads statically: a getter on a plain object
 * that reads a rune is not a dependency the compiler can see, so a template
 * binding through one updates only by luck. Exporting the runes directly, and
 * `$derived` for anything computed, gives every consumer a real dependency.
 */
let themeMode = $state<ThemeMode>(DEFAULT_THEME_MODE);
let accentColor = $state(DEFAULT_ACCENT_COLOR);
let fontFamily = $state('');
let systemPrefersDark = $state(true);

let started = false;
let mediaQuery: MediaQueryList | null = null;
let mediaListener: ((event: MediaQueryListEvent) => void) | null = null;

export const theme = {
  get mode(): ThemeMode {
    return themeMode;
  },
  get accent(): string {
    return accentColor;
  },
  get font(): string {
    return fontFamily;
  },
  get resolved(): ResolvedTheme {
    if (themeMode === 'system') {
      return systemPrefersDark ? 'dark' : 'light';
    }
    return themeMode;
  },
};

export function setThemeMode(mode: ThemeMode): void {
  themeMode = mode;
  localStorage.setItem(STORAGE_KEY_MODE, mode);
  applyToDom();
}

export function setAccentColor(color: string): void {
  accentColor = color;
  localStorage.setItem(STORAGE_KEY_ACCENT, color);
  applyToDom();
}

export function setFontFamily(family: string): void {
  fontFamily = family;
  localStorage.setItem(STORAGE_KEY_FONT, family);
}

/**
 * Reads the cached appearance and starts following the system preference.
 *
 * Idempotent: the app calls it once at startup, and a second call is a no-op
 * rather than a second listener.
 */
export function startTheme(): void {
  if (started) return;
  started = true;

  const cachedMode = localStorage.getItem(STORAGE_KEY_MODE);
  if (cachedMode === 'light' || cachedMode === 'dark' || cachedMode === 'system') {
    themeMode = cachedMode;
  }

  const cachedAccent = localStorage.getItem(STORAGE_KEY_ACCENT);
  if (cachedAccent !== null && cachedAccent !== '') {
    accentColor = cachedAccent;
  }

  fontFamily = localStorage.getItem(STORAGE_KEY_FONT) ?? '';

  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  systemPrefersDark = mediaQuery.matches;
  mediaListener = event => {
    systemPrefersDark = event.matches;
    applyToDom();
  };
  mediaQuery.addEventListener('change', mediaListener);

  applyToDom();
}

/**
 * Undoes startTheme: drops the system-preference listener and forgets the
 * cached appearance, so the next startTheme re-reads storage from scratch.
 *
 * The app never calls this - it exists so a test can exercise startup more than
 * once in a single module instance, which the `started` guard would otherwise
 * make impossible.
 */
export function stopTheme(): void {
  if (mediaQuery !== null && mediaListener !== null) {
    mediaQuery.removeEventListener('change', mediaListener);
  }
  mediaQuery = null;
  mediaListener = null;
  started = false;

  themeMode = DEFAULT_THEME_MODE;
  accentColor = DEFAULT_ACCENT_COLOR;
  fontFamily = '';
  systemPrefersDark = true;
}

function applyToDom(): void {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme.resolved);

  const accent = accentColor;
  root.style.setProperty('--color-accent', accent);
  root.style.setProperty('--color-accent-hover', darken(accent, 0.2));
  root.style.setProperty('--color-accent-muted', withAlpha(accent, 0.15));
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(hex: string): Rgb | null {
  const value = hex.trim().replace('#', '');
  if (value.length === 3) {
    return {
      r: parseInt(value[0] + value[0], 16),
      g: parseInt(value[1] + value[1], 16),
      b: parseInt(value[2] + value[2], 16),
    };
  }
  if (value.length === 6) {
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }
  return null;
}

function toHex(channel: number): string {
  return Math.max(0, Math.min(255, Math.round(channel)))
    .toString(16)
    .padStart(2, '0');
}

function darken(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (rgb === null) return hex;
  const factor = 1 - amount;
  return `#${toHex(rgb.r * factor)}${toHex(rgb.g * factor)}${toHex(rgb.b * factor)}`;
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (rgb === null) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}
