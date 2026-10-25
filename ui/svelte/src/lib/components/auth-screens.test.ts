import { render, fireEvent } from '@testing-library/svelte';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const setupMock = vi.fn().mockResolvedValue({ ok: true });
const loginMock = vi.fn().mockResolvedValue({ ok: true });

vi.mock('$lib/auth.svelte', () => ({
  setup: (...args: unknown[]) => setupMock(...args),
  login: (...args: unknown[]) => loginMock(...args),
}));

import SetupScreen from './SetupScreen.svelte';
import LoginScreen from './LoginScreen.svelte';

function input(container: HTMLElement, name: string): HTMLInputElement {
  return container.querySelector(`input[name="${name}"]`) as HTMLInputElement;
}

beforeEach(() => {
  setupMock.mockClear();
  loginMock.mockClear();
});

describe('SetupScreen', () => {
  it('renders the username, password and confirm fields', () => {
    const { container } = render(SetupScreen);
    expect(input(container, 'username')).toBeDefined();
    expect(input(container, 'password')).toBeDefined();
    expect(input(container, 'passwordConfirm')).toBeDefined();
  });

  it('keeps submit disabled while the password is short or mismatched', async () => {
    const { container, getByRole } = render(SetupScreen);

    await fireEvent.input(input(container, 'username'), { target: { value: 'qtitpc' } });
    await fireEvent.input(input(container, 'password'), { target: { value: 'short' } });
    await fireEvent.input(input(container, 'passwordConfirm'), { target: { value: 'short' } });

    const submit = getByRole('button') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(setupMock).not.toHaveBeenCalled();
  });

  it('submits the trimmed username and password once they are valid', async () => {
    const { container, getByRole } = render(SetupScreen);

    await fireEvent.input(input(container, 'username'), { target: { value: '  qtitpc  ' } });
    await fireEvent.input(input(container, 'password'), { target: { value: 'long-enough-1' } });
    await fireEvent.input(input(container, 'passwordConfirm'), { target: { value: 'long-enough-1' } });

    await fireEvent.click(getByRole('button'));
    expect(setupMock).toHaveBeenCalledWith('qtitpc', 'long-enough-1');
  });
});

describe('LoginScreen', () => {
  it('renders the username and password fields', () => {
    const { container } = render(LoginScreen);
    expect(input(container, 'username')).toBeDefined();
    expect(input(container, 'password')).toBeDefined();
  });

  it('keeps submit disabled until both fields are filled', async () => {
    const { container, getByRole } = render(LoginScreen);

    await fireEvent.input(input(container, 'username'), { target: { value: 'qtitpc' } });
    expect((getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    expect(loginMock).not.toHaveBeenCalled();

    await fireEvent.input(input(container, 'password'), { target: { value: 'secret' } });
    await fireEvent.click(getByRole('button'));
    expect(loginMock).toHaveBeenCalledWith('qtitpc', 'secret', 'admin');
  });
});
