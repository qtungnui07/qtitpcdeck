import { render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcIntegration } from '@macro-deck/runtime';
import { AppStrings, Strings } from '@macro-deck/runtime';
import {
  applyIntegrationBatch,
  resetIntegrations,
} from '$lib/integrations.svelte';
import { startLocalization, stopLocalization, translateKey } from '$lib/localization.svelte';
import { route, startRouter, stopRouter } from '$lib/router.svelte';
import IntegrationsPage from './IntegrationsPage.svelte';

function makeIntegration(overrides: Partial<IpcIntegration> = {}): IpcIntegration {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.2.0',
    enabled: true,
    isInternal: false,
    actionCount: 4,
    variableCount: 2,
    supportsConfigFlow: false,
    allowsMultipleConfigurations: false,
    requiresConfiguration: false,
    configuredEntryCount: 0,
    hasIcon: false,
    iconVersion: null,
    issueCount: 0,
    issueSeverity: null,
    isInitialized: true,
    variablesDependOnConfiguration: false,
    providedCapabilities: [],
    ...overrides,
  };
}

describe('IntegrationsPage', () => {
  beforeEach(() => {
    startLocalization();
    startRouter();
  });

  afterEach(() => {
    resetIntegrations();
    stopRouter();
    stopLocalization();
    vi.restoreAllMocks();
  });

  it('renders empty state when there are no integrations', () => {
    const { getByText } = render(IntegrationsPage);
    expect(
      getByText(translateKey(AppStrings.Integrations.Page.NoIntegrationsAvailableHeading)),
    ).toBeDefined();
    expect(
      getByText(translateKey(AppStrings.Integrations.Page.NoIntegrationsAvailableMessage)),
    ).toBeDefined();
  });

  it('renders integration cards when populated', () => {
    applyIntegrationBatch([
      makeIntegration({ id: 'p1', name: 'Alpha Plugin', enabled: true, isInternal: false }),
      makeIntegration({ id: 'p2', name: 'Beta Internal', enabled: false, isInternal: true }),
    ]);

    const { getByText } = render(IntegrationsPage);
    expect(getByText('Alpha Plugin')).toBeDefined();
    expect(getByText('Beta Internal')).toBeDefined();

    const subtitle = translateKey(AppStrings.Integrations.Page.EnabledSubtitle, {
      enabled: 1,
      total: 2,
    });
    expect(getByText(subtitle)).toBeDefined();
  });

  it('filters integrations by search input', async () => {
    applyIntegrationBatch([
      makeIntegration({ id: 'spotify', name: 'Spotify Controller' }),
      makeIntegration({ id: 'obs', name: 'OBS Studio' }),
    ]);

    const { getByPlaceholderText, getByText, queryByText } = render(IntegrationsPage);
    const searchInput = getByPlaceholderText(
      translateKey(AppStrings.Integrations.Page.SearchPlaceholder),
    ) as HTMLInputElement;

    searchInput.value = 'spot';
    searchInput.dispatchEvent(new Event('input'));

    await waitFor(() => {
      expect(getByText('Spotify Controller')).toBeDefined();
      expect(queryByText('OBS Studio')).toBeNull();
    });
  });

  it('filters integrations by enabled status', async () => {
    applyIntegrationBatch([
      makeIntegration({ id: 'i1', name: 'Enabled Integration', enabled: true }),
      makeIntegration({ id: 'i2', name: 'Disabled Integration', enabled: false }),
    ]);

    const { container, getByText, queryByText } = render(IntegrationsPage);
    const select = container.querySelector('#filter-status') as HTMLSelectElement;

    select.value = 'disabled';
    select.dispatchEvent(new Event('change'));

    await waitFor(() => {
      expect(queryByText('Enabled Integration')).toBeNull();
      expect(getByText('Disabled Integration')).toBeDefined();
    });
  });

  it('filters integrations by internal or plugin type', async () => {
    applyIntegrationBatch([
      makeIntegration({ id: 'i1', name: 'Internal Tool', isInternal: true }),
      makeIntegration({ id: 'i2', name: 'External Plugin', isInternal: false }),
    ]);

    const { container, getByText, queryByText } = render(IntegrationsPage);
    const select = container.querySelector('#filter-type') as HTMLSelectElement;

    select.value = 'internal';
    select.dispatchEvent(new Event('change'));

    await waitFor(() => {
      expect(getByText('Internal Tool')).toBeDefined();
      expect(queryByText('External Plugin')).toBeNull();
    });
  });

  it('filters integrations by health issues', async () => {
    applyIntegrationBatch([
      makeIntegration({ id: 'healthy', name: 'Healthy One', issueCount: 0 }),
      makeIntegration({ id: 'broken', name: 'Broken One', issueCount: 3, issueSeverity: 'error' }),
    ]);

    const { container, getByText, queryByText } = render(IntegrationsPage);
    const select = container.querySelector('#filter-issues') as HTMLSelectElement;

    select.value = 'has';
    select.dispatchEvent(new Event('change'));

    await waitFor(() => {
      expect(queryByText('Healthy One')).toBeNull();
      expect(getByText('Broken One')).toBeDefined();
    });
  });

  it('renders empty filtered state and resets with clear filters button', async () => {
    applyIntegrationBatch([
      makeIntegration({ id: 'p1', name: 'Existing One' }),
    ]);

    const { getByPlaceholderText, getByText, queryByText } = render(IntegrationsPage);
    const searchInput = getByPlaceholderText(
      translateKey(AppStrings.Integrations.Page.SearchPlaceholder),
    ) as HTMLInputElement;

    searchInput.value = 'non-matching query';
    searchInput.dispatchEvent(new Event('input'));

    await waitFor(() => {
      expect(
        getByText(translateKey(AppStrings.Integrations.Page.NoMatchingIntegrationsHeading)),
      ).toBeDefined();
      expect(queryByText('Existing One')).toBeNull();
    });

    const clearButton = getByText(
      translateKey(AppStrings.Integrations.Page.ClearFiltersAction),
    );
    clearButton.click();

    await waitFor(() => {
      expect(getByText('Existing One')).toBeDefined();
    });
  });

  it('prompts confirm dialog when attempting to disable an active integration', async () => {
    applyIntegrationBatch([
      makeIntegration({ id: 'active', name: 'Active Plugin', enabled: true }),
    ]);

    const { container, getByText, getByRole } = render(IntegrationsPage);
    const checkbox = getByRole('checkbox');
    checkbox.click();

    await waitFor(() => {
      expect(
        getByText(translateKey(AppStrings.Integrations.Page.DisableHeading)),
      ).toBeDefined();
      expect(
        getByText(
          translateKey(AppStrings.Integrations.Page.DisableMessage, { name: 'Active Plugin' }),
        ),
      ).toBeDefined();
    });

    // Cancel dialog
    const cancelBtn = getByText(translateKey(Strings.Common.Cancel));
    cancelBtn.click();

    await waitFor(() => {
      expect(container.querySelector('.confirm-dialog')).toBeNull();
    });
  });

  it('navigates to integration detail on card select', () => {
    applyIntegrationBatch([
      makeIntegration({ id: 'my-plugin', name: 'My Plugin' }),
    ]);

    const { container } = render(IntegrationsPage);
    const card = container.querySelector('.integration-card') as HTMLElement;
    card.click();

    expect(route.path).toBe('/integrations/my-plugin');
  });

  it('navigates to store on Browse Store button click', () => {
    const { getByText } = render(IntegrationsPage);
    const browseBtn = getByText(
      translateKey(AppStrings.Integrations.Page.BrowseStoreAction),
    );
    browseBtn.click();

    expect(route.path).toBe('/store');
  });
});
