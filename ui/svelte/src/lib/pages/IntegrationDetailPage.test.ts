import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ConfigEntryDto,
  GetIntegrationCapabilitiesResponse,
  IpcIntegration,
  IpcIntegrationIssue,
} from '@macro-deck/runtime';
import { AppStrings } from '@macro-deck/runtime';
import {
  applyIntegrationBatch,
  resetIntegrations,
} from '$lib/integrations.svelte';
import { startLocalization, stopLocalization, translateKey } from '$lib/localization.svelte';
import { navigate, startRouter, stopRouter } from '$lib/router.svelte';
import { applyVariableBatch, resetVariables } from '$lib/variables.svelte';
import IntegrationDetailPage from './IntegrationDetailPage.svelte';

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

const mockCapabilities: GetIntegrationCapabilitiesResponse = {
  found: true,
  enabled: true,
  isInitialized: true,
  supportsConfigFlow: false,
  requiresSetup: false,
  variablesDependOnConfiguration: false,
  configuredEntryCount: 0,
  actions: [
    {
      id: 'act1',
      name: 'Test Action',
      description: 'An action to test',
      availability: 'Ready',
      availabilityReason: 'Ready',
      parameterCount: 0,
      parameterSummary: [],
    },
    {
      id: 'act2',
      name: 'Muted Action',
      description: 'Another action',
      availability: 'Unavailable',
      availabilityReason: 'Missing config',
      parameterCount: 0,
      parameterSummary: [],
    },
  ],
  variables: [
    {
      name: 'speed',
      type: 'numeric',
      value: '42',
      valueAvailable: true,
      availability: 'Ready',
      availabilityReason: 'Ready',
      isTemplate: false,
    },
    {
      name: 'fan_<id>',
      type: 'boolean',
      value: null,
      valueAvailable: false,
      availability: 'SetupRequired',
      availabilityReason: 'Requires fan setup',
      isTemplate: true,
    },
  ],
};

const mockIssues: IpcIntegrationIssue[] = [
  {
    id: 'issue-1',
    severity: 'warning',
    title: 'Configuration missing',
    actionLabel: 'Configure',
  },
];

const mockConfigEntries: ConfigEntryDto[] = [
  {
    id: 'entry-1',
    title: 'Primary Account',
    status: 'Connected',
    usable: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('IntegrationDetailPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    startLocalization();
    startRouter();
  });

  afterEach(() => {
    resetIntegrations();
    resetVariables();
    stopRouter();
    stopLocalization();
    window.history.replaceState(null, '', '/');
    vi.restoreAllMocks();
  });

  it('renders integration not found when id does not match store', () => {
    const { getByText } = render(IntegrationDetailPage, {
      props: {
        integrationId: 'non-existent',
        initialCapabilities: null,
        initialIssues: [],
        initialConfigEntries: [],
      },
    });

    expect(
      getByText(translateKey(AppStrings.Integrations.Detail.IntegrationNotFound)),
    ).toBeDefined();
  });

  it('renders overview tab with general and capability information', () => {
    applyIntegrationBatch([
      makeIntegration({
        id: 'test-plugin',
        name: 'My Custom Plugin',
        version: '2.5.0',
        enabled: true,
      }),
    ]);

    const { getByText } = render(IntegrationDetailPage, {
      props: {
        integrationId: 'test-plugin',
        initialCapabilities: mockCapabilities,
        initialIssues: [],
        initialConfigEntries: [],
      },
    });

    expect(getByText('My Custom Plugin')).toBeDefined();
    expect(getByText('v2.5.0')).toBeDefined();
    expect(getByText(translateKey(AppStrings.Integrations.Detail.StatusReady))).toBeDefined();
    expect(getByText(translateKey(AppStrings.Integrations.Detail.GeneralSectionTitle))).toBeDefined();
    expect(getByText('test-plugin')).toBeDefined();
  });

  it('navigates to actions tab and displays action capabilities', async () => {
    applyIntegrationBatch([
      makeIntegration({
        id: 'test-plugin',
        name: 'My Custom Plugin',
      }),
    ]);

    const { getByText, getByRole } = render(IntegrationDetailPage, {
      props: {
        integrationId: 'test-plugin',
        initialCapabilities: mockCapabilities,
        initialIssues: [],
        initialConfigEntries: [],
      },
    });

    const actionsTab = getByRole('tab', {
      name: new RegExp(translateKey(AppStrings.Integrations.Detail.ActionsTab)),
    });
    await fireEvent.click(actionsTab);

    expect(getByText('Test Action')).toBeDefined();
    expect(getByText('An action to test')).toBeDefined();
    expect(getByText('Muted Action')).toBeDefined();
  });

  it('filters actions by search query', async () => {
    applyIntegrationBatch([
      makeIntegration({
        id: 'test-plugin',
      }),
    ]);

    const { getByPlaceholderText, getByText, queryByText } = render(IntegrationDetailPage, {
      props: {
        integrationId: 'test-plugin',
        initialCapabilities: mockCapabilities,
        initialIssues: [],
        initialConfigEntries: [],
      },
    });

    await navigate('/integrations/test-plugin?tab=actions');

    const searchInput = getByPlaceholderText(
      translateKey(AppStrings.Integrations.Detail.SearchActionsPlaceholder),
    );
    await fireEvent.input(searchInput, { target: { value: 'Muted' } });

    expect(getByText('Muted Action')).toBeDefined();
    expect(queryByText('Test Action')).toBeNull();
  });

  it('navigates to variables tab and displays declared and bound variables', async () => {
    applyIntegrationBatch([
      makeIntegration({
        id: 'test-plugin',
      }),
    ]);

    applyVariableBatch(
      [
        {
          id: 'var-1',
          name: 'dynamic_status',
          displayName: 'Current Status',
          type: 'text',
          classification: 'integration',
          value: 'Active',
          scope: 'global',
          ownerIntegrationId: 'test-plugin',
          dynamicResourceId: 'res-1',
          available: true,
        },
      ],
      [],
    );

    const { getByText, getByRole } = render(IntegrationDetailPage, {
      props: {
        integrationId: 'test-plugin',
        initialCapabilities: mockCapabilities,
        initialIssues: [],
        initialConfigEntries: [],
      },
    });

    const variablesTab = getByRole('tab', {
      name: new RegExp(translateKey(AppStrings.Integrations.Detail.VariablesTab)),
    });
    await fireEvent.click(variablesTab);

    expect(getByText('vars.speed')).toBeDefined();
    expect(getByText('42')).toBeDefined();
    expect(getByText('vars.fan_<id>')).toBeDefined();
    expect(getByText('vars.dynamic_status')).toBeDefined();
    expect(getByText('Active')).toBeDefined();
  });

  it('filters variables by search query', async () => {
    applyIntegrationBatch([
      makeIntegration({
        id: 'test-plugin',
      }),
    ]);

    const { getByPlaceholderText, getByText, queryByText } = render(IntegrationDetailPage, {
      props: {
        integrationId: 'test-plugin',
        initialCapabilities: mockCapabilities,
        initialIssues: [],
        initialConfigEntries: [],
      },
    });

    await navigate('/integrations/test-plugin?tab=variables');

    const searchInput = getByPlaceholderText(
      translateKey(AppStrings.Integrations.Detail.SearchVariablesPlaceholder),
    );
    await fireEvent.input(searchInput, { target: { value: 'speed' } });

    expect(getByText('vars.speed')).toBeDefined();
    expect(queryByText('vars.fan_<id>')).toBeNull();
  });

  it('renders configuration entries and opens rename dialog', async () => {
    applyIntegrationBatch([
      makeIntegration({
        id: 'test-plugin',
        supportsConfigFlow: true,
      }),
    ]);

    const { getByText, getByPlaceholderText } = render(IntegrationDetailPage, {
      props: {
        integrationId: 'test-plugin',
        initialCapabilities: mockCapabilities,
        initialIssues: [],
        initialConfigEntries: mockConfigEntries,
      },
    });

    expect(getByText('Primary Account')).toBeDefined();

    const renameButton = getByText(
      translateKey(AppStrings.Integrations.Detail.RenameConfigEntryAction),
    );
    await fireEvent.click(renameButton);

    expect(
      getByText(translateKey(AppStrings.Integrations.Detail.RenameConfigurationHeading)),
    ).toBeDefined();

    const input = getByPlaceholderText(
      translateKey(AppStrings.Integrations.Detail.ConfigurationNamePlaceholder),
    ) as HTMLInputElement;
    expect(input.value).toBe('Primary Account');
  });

  it('displays issues card when there are active issues', () => {
    applyIntegrationBatch([
      makeIntegration({
        id: 'test-plugin',
        enabled: true,
      }),
    ]);

    const { getByText } = render(IntegrationDetailPage, {
      props: {
        integrationId: 'test-plugin',
        initialCapabilities: mockCapabilities,
        initialIssues: mockIssues,
        initialConfigEntries: [],
      },
    });

    expect(getByText('Configuration missing')).toBeDefined();
  });

  it('shows disable confirmation dialog when toggle is clicked for enabled integration', async () => {
    applyIntegrationBatch([
      makeIntegration({
        id: 'test-plugin',
        name: 'Cool Integration',
        enabled: true,
      }),
    ]);

    const { getByRole, getByText } = render(IntegrationDetailPage, {
      props: {
        integrationId: 'test-plugin',
        initialCapabilities: mockCapabilities,
        initialIssues: [],
        initialConfigEntries: [],
      },
    });

    const toggle = getByRole('checkbox');
    await fireEvent.click(toggle);

    expect(getByText(translateKey(AppStrings.Integrations.Page.DisableHeading))).toBeDefined();
  });
});
