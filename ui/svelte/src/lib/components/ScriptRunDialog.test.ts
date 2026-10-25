import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScriptInput } from '@macro-deck/runtime';
import { AppStrings } from '@macro-deck/runtime';
import ScriptRunDialog from '$lib/components/ScriptRunDialog.svelte';
import { startLocalization, stopLocalization, translateKey } from '$lib/localization.svelte';

const SAMPLE_INPUTS: ScriptInput[] = [
  {
    name: 'targetVolume',
    type: 'numeric',
    label: 'Target Volume',
    defaultValue: '50',
    required: true,
  },
  {
    name: 'muteFirst',
    type: 'boolean',
    label: 'Mute First',
    defaultValue: 'false',
  },
  {
    name: 'channelName',
    type: 'text',
    label: 'Channel Name',
    required: false,
  },
];

describe('ScriptRunDialog', () => {
  beforeEach(() => {
    startLocalization();
  });

  afterEach(() => {
    stopLocalization();
    vi.restoreAllMocks();
  });

  it('renders script name in heading and input controls', () => {
    const onrun = vi.fn();
    const oncancel = vi.fn();
    const { getByText, getByLabelText } = render(ScriptRunDialog, {
      scriptName: 'Set Volume',
      inputs: SAMPLE_INPUTS,
      onrun,
      oncancel,
    });

    expect(
      getByText(translateKey(AppStrings.Scripts.RunScriptHeading, { name: 'Set Volume' })),
    ).toBeDefined();
    expect(getByLabelText(/Target Volume/i)).toBeDefined();
    expect(getByText('Mute First')).toBeDefined();
  });

  it('submits typed values converted to wire format', async () => {
    const onrun = vi.fn();
    const oncancel = vi.fn();
    const { getByLabelText, getByRole } = render(ScriptRunDialog, {
      scriptName: 'Set Volume',
      inputs: SAMPLE_INPUTS,
      onrun,
      oncancel,
    });

    const targetInput = getByLabelText(/Target Volume/i);
    await fireEvent.input(targetInput, { target: { value: '75' } });

    const runBtn = getByRole('button', {
      name: translateKey(AppStrings.Scripts.RunAction),
    });
    await fireEvent.click(runBtn);

    expect(onrun).toHaveBeenCalledWith(
      expect.objectContaining({
        targetVolume: 75,
      }),
    );
  });

  it('calls oncancel when cancel clicked', async () => {
    const onrun = vi.fn();
    const oncancel = vi.fn();
    const { getByText } = render(ScriptRunDialog, {
      scriptName: 'Set Volume',
      inputs: SAMPLE_INPUTS,
      onrun,
      oncancel,
    });

    const cancelBtn = getByText(translateKey('macrodeck:Common.Cancel'));
    await fireEvent.click(cancelBtn);

    expect(oncancel).toHaveBeenCalled();
  });
});
