import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Script } from '@macro-deck/runtime';
import { AppStrings } from '@macro-deck/runtime';
import { scriptEndpoints } from '$lib/endpoints';
import { startLocalization, stopLocalization, translateKey } from '$lib/localization.svelte';
import ScriptsPage from '$lib/pages/ScriptsPage.svelte';
import { resetScripts, setScriptsForTesting } from '$lib/scripts.svelte';

const SAMPLE_SCRIPTS: Script[] = [
  {
    id: 's-1',
    name: 'Alpha Script',
    description: 'First script description',
    inputs: [
      { name: 'param1', type: 'text', label: 'Param 1', required: false },
    ],
    flows: [
      {
        triggerId: 'flow-1',
        triggerType: 'onRun',
        children: [],
      },
    ],
    runsOnWidget: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 's-2',
    name: 'Beta Script',
    description: 'Second script',
    inputs: [],
    flows: [],
    runsOnWidget: false,
    createdAt: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
  },
];

describe('ScriptsPage', () => {
  beforeEach(() => {
    startLocalization();
    resetScripts();
    vi.spyOn(scriptEndpoints, 'list').mockResolvedValue({ scripts: [] });
    vi.spyOn(scriptEndpoints, 'usages').mockResolvedValue({ usages: [] });
  });

  afterEach(() => {
    stopLocalization();
    resetScripts();
    vi.restoreAllMocks();
  });

  it('renders empty placeholder when no scripts exist', async () => {
    setScriptsForTesting([]);
    const { findByText } = render(ScriptsPage);

    expect(await findByText(translateKey(AppStrings.Scripts.NoScriptsYetHeading))).toBeDefined();
    expect(await findByText(translateKey(AppStrings.Scripts.NoScriptsYetMessage))).toBeDefined();
  });

  it('renders script items in rail list and selects first item by default', () => {
    setScriptsForTesting(SAMPLE_SCRIPTS);
    const { getAllByText, getByText } = render(ScriptsPage);

    expect(getAllByText('Alpha Script').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Beta Script')).toBeDefined();
    expect(getByText('First script description')).toBeDefined();
  });

  it('switches selected script when rail item is clicked', async () => {
    setScriptsForTesting(SAMPLE_SCRIPTS);
    const { getByText } = render(ScriptsPage);

    const betaItem = getByText('Beta Script');
    await fireEvent.click(betaItem);

    expect(getByText('Second script')).toBeDefined();
  });

  it('opens create modal when new script button clicked', async () => {
    setScriptsForTesting(SAMPLE_SCRIPTS);
    const { getByRole, getByText } = render(ScriptsPage);

    const newBtn = getByRole('button', {
      name: translateKey(AppStrings.Scripts.NewScriptHeading),
    });
    await fireEvent.click(newBtn);

    expect(getByText(translateKey(AppStrings.Scripts.NewScriptHeading))).toBeDefined();
  });
});
