import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Automation } from '$lib/automation';
import { AppStrings } from '@macro-deck/runtime';
import AutomationEditDialog from '$lib/components/AutomationEditDialog.svelte';
import { startLocalization, stopLocalization, translateKey } from '$lib/localization.svelte';

const SAMPLE_AUTOMATION: Automation = {
  id: 'auto-1',
  name: 'Test Automation',
  description: 'An automation',
  enabled: true,
  flows: [],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

describe('AutomationEditDialog', () => {
  beforeEach(() => {
    startLocalization();
  });

  afterEach(() => {
    stopLocalization();
    vi.restoreAllMocks();
  });

  it('renders create mode with empty fields', () => {
    const onsave = vi.fn();
    const oncancel = vi.fn();
    const { getByText, getByPlaceholderText } = render(AutomationEditDialog, {
      mode: 'create',
      onsave,
      oncancel,
    });

    expect(getByText(translateKey(AppStrings.Automations.NewAutomationHeading))).toBeDefined();
    const nameInput = getByPlaceholderText(
      translateKey(AppStrings.Automations.NameFieldPlaceholder),
    ) as HTMLInputElement;
    expect(nameInput.value).toBe('');
  });

  it('renders edit mode with prefilled values', () => {
    const onsave = vi.fn();
    const oncancel = vi.fn();
    const { getByText, getByPlaceholderText } = render(AutomationEditDialog, {
      mode: 'edit',
      automation: SAMPLE_AUTOMATION,
      onsave,
      oncancel,
    });

    expect(getByText(translateKey(AppStrings.Automations.RenameAutomationHeading))).toBeDefined();
    const nameInput = getByPlaceholderText(
      translateKey(AppStrings.Automations.NameFieldPlaceholder),
    ) as HTMLInputElement;
    expect(nameInput.value).toBe('Test Automation');
  });

  it('calls onsave when submitted with valid name', async () => {
    const onsave = vi.fn();
    const oncancel = vi.fn();
    const { getByPlaceholderText, getByRole } = render(AutomationEditDialog, {
      mode: 'create',
      onsave,
      oncancel,
    });

    const nameInput = getByPlaceholderText(
      translateKey(AppStrings.Automations.NameFieldPlaceholder),
    );
    await fireEvent.input(nameInput, { target: { value: 'Night Mode Toggle' } });

    const submitBtn = getByRole('button', {
      name: translateKey(AppStrings.Automations.CreateAutomationAction),
    });
    await fireEvent.click(submitBtn);

    expect(onsave).toHaveBeenCalledWith({
      name: 'Night Mode Toggle',
      description: '',
    });
  });

  it('calls oncancel when cancelled', async () => {
    const onsave = vi.fn();
    const oncancel = vi.fn();
    const { getByText } = render(AutomationEditDialog, {
      mode: 'create',
      onsave,
      oncancel,
    });

    const cancelBtn = getByText(translateKey('macrodeck:Common.Cancel'));
    await fireEvent.click(cancelBtn);

    expect(oncancel).toHaveBeenCalled();
  });
});
