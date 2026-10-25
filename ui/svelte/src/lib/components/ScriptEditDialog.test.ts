import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Script } from '@macro-deck/runtime';
import { AppStrings } from '@macro-deck/runtime';
import ScriptEditDialog from '$lib/components/ScriptEditDialog.svelte';
import { startLocalization, stopLocalization, translateKey } from '$lib/localization.svelte';

const SAMPLE_SCRIPT: Script = {
  id: 'script-1',
  name: 'Test Script',
  description: 'A test script',
  flows: [],
  inputs: [],
  runsOnWidget: false,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

describe('ScriptEditDialog', () => {
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
    const { getByText, getByPlaceholderText } = render(ScriptEditDialog, {
      mode: 'create',
      onsave,
      oncancel,
    });

    expect(getByText(translateKey(AppStrings.Scripts.NewScriptHeading))).toBeDefined();
    const nameInput = getByPlaceholderText(
      translateKey(AppStrings.Scripts.NameFieldPlaceholder),
    ) as HTMLInputElement;
    expect(nameInput.value).toBe('');
  });

  it('renders edit mode with prefilled values', () => {
    const onsave = vi.fn();
    const oncancel = vi.fn();
    const { getByText, getByPlaceholderText } = render(ScriptEditDialog, {
      mode: 'edit',
      script: SAMPLE_SCRIPT,
      onsave,
      oncancel,
    });

    expect(getByText(translateKey(AppStrings.Scripts.RenameScriptHeading))).toBeDefined();
    const nameInput = getByPlaceholderText(
      translateKey(AppStrings.Scripts.NameFieldPlaceholder),
    ) as HTMLInputElement;
    expect(nameInput.value).toBe('Test Script');
  });

  it('calls onsave when submitted with valid name', async () => {
    const onsave = vi.fn();
    const oncancel = vi.fn();
    const { getByPlaceholderText, getByRole } = render(ScriptEditDialog, {
      mode: 'create',
      onsave,
      oncancel,
    });

    const nameInput = getByPlaceholderText(translateKey(AppStrings.Scripts.NameFieldPlaceholder));
    await fireEvent.input(nameInput, { target: { value: 'My New Script' } });

    const submitBtn = getByRole('button', {
      name: translateKey(AppStrings.Scripts.CreateScriptAction),
    });
    await fireEvent.click(submitBtn);

    expect(onsave).toHaveBeenCalledWith({
      name: 'My New Script',
      description: '',
    });
  });

  it('calls oncancel when cancelled', async () => {
    const onsave = vi.fn();
    const oncancel = vi.fn();
    const { getByText } = render(ScriptEditDialog, {
      mode: 'create',
      onsave,
      oncancel,
    });

    const cancelBtn = getByText(translateKey('macrodeck:Common.Cancel'));
    await fireEvent.click(cancelBtn);

    expect(oncancel).toHaveBeenCalled();
  });
});
