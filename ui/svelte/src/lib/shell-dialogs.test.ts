/*
 * Tests for the two shell dialog stores.
 *
 * They are separate stores rather than one "which dialog is open" enum because an update can be
 * offered while settings is already open, and the two must not fight over a single flag.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  closeSettings,
  openSettings,
  resetSettingsModal,
  setSettingsCategory,
  settingsModal,
} from './settings-modal.svelte';
import { closeUpdateModal, openUpdateModal, resetUpdateModal, updateModal } from './update-modal.svelte';

afterEach(() => {
  resetSettingsModal();
  resetUpdateModal();
});

describe('settings modal', () => {
  it('starts closed on appearance', () => {
    expect(settingsModal.isOpen).toBe(false);
    expect(settingsModal.activeCategory).toBe('appearance');
  });

  it('opens on the default category', () => {
    openSettings();
    expect(settingsModal.isOpen).toBe(true);
    expect(settingsModal.activeCategory).toBe('appearance');
  });

  it('opens on a requested category', () => {
    openSettings('network');
    expect(settingsModal.activeCategory).toBe('network');
  });

  it('changes category while open', () => {
    openSettings('network');
    setSettingsCategory('about');

    expect(settingsModal.activeCategory).toBe('about');
    expect(settingsModal.isOpen).toBe(true);
  });

  it('closes without forgetting the category', () => {
    openSettings('network');
    closeSettings();

    expect(settingsModal.isOpen).toBe(false);
    expect(settingsModal.activeCategory).toBe('network');
  });

  it('resets to closed on appearance', () => {
    openSettings('network');
    resetSettingsModal();

    expect(settingsModal.isOpen).toBe(false);
    expect(settingsModal.activeCategory).toBe('appearance');
  });
});

describe('update modal', () => {
  it('starts closed', () => {
    expect(updateModal.isOpen).toBe(false);
  });

  it('opens', () => {
    openUpdateModal();
    expect(updateModal.isOpen).toBe(true);
  });

  it('closes', () => {
    openUpdateModal();
    closeUpdateModal();
    expect(updateModal.isOpen).toBe(false);
  });

  it('does not disturb the settings dialog', () => {
    openSettings('about');
    openUpdateModal();

    expect(settingsModal.isOpen).toBe(true);
    expect(updateModal.isOpen).toBe(true);
  });
});
