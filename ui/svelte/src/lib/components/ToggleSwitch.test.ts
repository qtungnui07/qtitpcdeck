import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ToggleSwitch from './ToggleSwitch.svelte';

describe('ToggleSwitch', () => {
  it('renders unchecked by default', () => {
    const { getByRole } = render(ToggleSwitch, { ariaLabel: 'Test switch' });
    const checkbox = getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('renders checked when requested', () => {
    const { getByRole } = render(ToggleSwitch, { checked: true, ariaLabel: 'Test switch' });
    const checkbox = getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('emits onchange on click', async () => {
    const onchange = vi.fn();
    const { getByRole } = render(ToggleSwitch, { onchange, ariaLabel: 'Test switch' });
    const checkbox = getByRole('checkbox');

    checkbox.click();
    expect(onchange).toHaveBeenCalledWith(true);
  });

  it('does not toggle when disabled', () => {
    const onchange = vi.fn();
    const { getByRole } = render(ToggleSwitch, { disabled: true, onchange, ariaLabel: 'Test switch' });
    const checkbox = getByRole('checkbox');

    checkbox.click();
    expect(onchange).not.toHaveBeenCalled();
  });

  it('renders an optional text label', () => {
    const { getByText } = render(ToggleSwitch, { label: 'Enable integration' });
    expect(getByText('Enable integration')).toBeDefined();
  });
});
