import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Automation } from '$lib/automation';
import { AppStrings } from '@macro-deck/runtime';
import {
  resetAutomations,
  setAutomationsForTesting,
} from '$lib/automations.svelte';
import { automationEndpoints } from '$lib/endpoints';
import { startLocalization, stopLocalization, translateKey } from '$lib/localization.svelte';
import AutomationsPage from '$lib/pages/AutomationsPage.svelte';

const SAMPLE_AUTOMATIONS: Automation[] = [
  {
    id: 'a-1',
    name: 'Auto Backup',
    description: 'Backs up database',
    enabled: true,
    flows: [
      {
        triggerId: 'f-1',
        triggerType: 'onEvent',
        children: [],
      },
    ],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'a-2',
    name: 'Night Light Off',
    description: 'Turn off lights at night',
    enabled: false,
    flows: [],
    createdAt: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
  },
];

describe('AutomationsPage', () => {
  beforeEach(() => {
    startLocalization();
    resetAutomations();
    vi.spyOn(automationEndpoints, 'list').mockResolvedValue({ automations: [] });
  });

  afterEach(() => {
    stopLocalization();
    resetAutomations();
    vi.restoreAllMocks();
  });

  it('renders empty placeholder when no automations exist', async () => {
    setAutomationsForTesting([]);
    const { findByText } = render(AutomationsPage);

    expect(await findByText(translateKey(AppStrings.Automations.NoAutomationsYetHeading))).toBeDefined();
    expect(await findByText(translateKey(AppStrings.Automations.NoAutomationsYetMessage))).toBeDefined();
  });

  it('renders list in rail and selects first automation by default', () => {
    setAutomationsForTesting(SAMPLE_AUTOMATIONS);
    const { getAllByText, getByText } = render(AutomationsPage);

    expect(getAllByText('Auto Backup').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Night Light Off')).toBeDefined();
    expect(getByText('Backs up database')).toBeDefined();
  });

  it('switches selected automation on rail click', async () => {
    setAutomationsForTesting(SAMPLE_AUTOMATIONS);
    const { getByText } = render(AutomationsPage);

    const secondItem = getByText('Night Light Off');
    await fireEvent.click(secondItem);

    expect(getByText('Turn off lights at night')).toBeDefined();
  });

  it('opens create modal when new automation button clicked', async () => {
    setAutomationsForTesting(SAMPLE_AUTOMATIONS);
    const { getByRole, getByText } = render(AutomationsPage);

    const newBtn = getByRole('button', {
      name: translateKey(AppStrings.Automations.NewAutomationHeading),
    });
    await fireEvent.click(newBtn);

    expect(getByText(translateKey(AppStrings.Automations.NewAutomationHeading))).toBeDefined();
  });
});
