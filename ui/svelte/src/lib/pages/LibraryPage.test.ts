import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppStrings } from '@macro-deck/runtime';
import { resetIconPacks } from '$lib/icon-packs.svelte';
import { resetUserFonts } from '$lib/user-fonts.svelte';
import { startLocalization, stopLocalization, translateKey } from '$lib/localization.svelte';
import { navigate, route, startRouter, stopRouter } from '$lib/router.svelte';
import LibraryPage from './LibraryPage.svelte';

describe('LibraryPage', () => {
  beforeEach(() => {
    startLocalization();
    startRouter();
    resetIconPacks();
    resetUserFonts();
  });

  afterEach(() => {
    stopRouter();
    stopLocalization();
    resetIconPacks();
    resetUserFonts();
  });

  it('renders the two content type tabs', () => {
    navigate('/library/icon-packs');
    const { getByRole, getAllByRole } = render(LibraryPage);

    const tablist = getByRole('tablist');
    expect(tablist).not.toBeNull();

    const tabs = getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].textContent).toContain(translateKey(AppStrings.Nav.IconPacks));
    expect(tabs[1].textContent).toContain(translateKey(AppStrings.Nav.Fonts));
  });

  it('navigates when clicking tabs in switcher', async () => {
    navigate('/library');
    const { getAllByRole } = render(LibraryPage);

    const tabs = getAllByRole('tab');
    await fireEvent.click(tabs[0]);
    expect(route.path).toBe('/library/icon-packs');

    await fireEvent.click(tabs[1]);
    expect(route.path).toBe('/library/fonts');
  });

  it('renders icon packs library subpage when on /library/icon-packs', () => {
    navigate('/library/icon-packs');
    const { container, getByRole } = render(LibraryPage);

    const tabs = getByRole('tablist').querySelectorAll('[role="tab"]');
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    const content = container.querySelector('.library-content')!;
    expect(content.textContent).toContain(translateKey(AppStrings.Nav.IconPacks));
    expect(content.querySelector('.rail')).not.toBeNull();
  });

  it('renders fonts library subpage when on /library/fonts', () => {
    navigate('/library/fonts');
    const { container, getByRole } = render(LibraryPage);

    const tabs = getByRole('tablist').querySelectorAll('[role="tab"]');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    const content = container.querySelector('.library-content')!;
    expect(content.querySelector('.fonts-page')).not.toBeNull();
  });
});
