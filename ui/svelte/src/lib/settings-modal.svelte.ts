/*
 * Which settings category the settings dialog should open on.
 *
 * The dialog itself is a later port; this store exists now because the sidebar and the statusbar
 * both need to open it, and a shared store is what stops them each inventing their own flag.
 */

export type SettingsCategory =
  | 'account'
  | 'appearance'
  | 'startup'
  | 'language'
  | 'security'
  | 'network'
  | 'devices'
  | 'license'
  | 'extensions'
  | 'adb'
  | 'usb'
  | 'backups'
  | 'migration'
  | 'http'
  | 'logging'
  | 'developer'
  | 'experiments'
  | 'about';

const DEFAULT_CATEGORY: SettingsCategory = 'appearance';

let isOpen = $state(false);
let activeCategory = $state<SettingsCategory>(DEFAULT_CATEGORY);

export const settingsModal = {
  get isOpen() {
    return isOpen;
  },
  get activeCategory() {
    return activeCategory;
  },
};

export function openSettings(category: SettingsCategory = DEFAULT_CATEGORY): void {
  activeCategory = category;
  isOpen = true;
}

export function closeSettings(): void {
  isOpen = false;
}

export function setSettingsCategory(category: SettingsCategory): void {
  activeCategory = category;
}

export function resetSettingsModal(): void {
  isOpen = false;
  activeCategory = DEFAULT_CATEGORY;
}
