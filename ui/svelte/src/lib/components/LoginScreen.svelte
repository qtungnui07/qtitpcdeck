<script lang="ts">
  /*
   * The admin sign-in screen, ported from the Angular LoginFormComponent in
   * its desktop role (scope admin): what a non-loopback window sees when it
   * has no session to refresh.
   */
  import { AppStrings } from '@macro-deck/runtime';
  import { login } from '$lib/auth.svelte';
  import { translateKey } from '$lib/localization.svelte';
  import Button from './Button.svelte';

  let username = $state('');
  let password = $state('');
  let submitting = $state(false);
  let error = $state<string | null>(null);

  const canSubmit = $derived(username.trim().length > 0 && password.length > 0 && !submitting);

  async function onSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!canSubmit) return;

    submitting = true;
    error = null;
    try {
      const result = await login(username.trim(), password, 'admin');
      if (!result.ok) {
        error = result.message ?? translateKey(AppStrings.Auth.SignInFailed);
      }
    } finally {
      submitting = false;
    }
  }
</script>

<div class="auth-backdrop">
  <form class="auth-card" onsubmit={onSubmit}>
    <div class="auth-brand" aria-hidden="true"></div>
    <h1 class="auth-title">qtitpcdeck</h1>
    <p class="auth-subtitle">{translateKey(AppStrings.Auth.SignInSubtitle)}</p>

    {#if error}
      <p class="auth-error" role="alert">{error}</p>
    {/if}

    <label class="auth-field">
      <span class="auth-label">{translateKey(AppStrings.Auth.Username)}</span>
      <input
        class="auth-input"
        type="text"
        name="username"
        autocomplete="username"
        placeholder={translateKey(AppStrings.Auth.Username)}
        disabled={submitting}
        bind:value={username}
      />
    </label>

    <label class="auth-field">
      <span class="auth-label">{translateKey(AppStrings.Auth.Password)}</span>
      <input
        class="auth-input"
        type="password"
        name="password"
        autocomplete="current-password"
        placeholder={translateKey(AppStrings.Auth.Password)}
        disabled={submitting}
        bind:value={password}
      />
    </label>

    <Button variant="primary" type="submit" disabled={!canSubmit}>
      {translateKey(AppStrings.Auth.SignIn)}
    </Button>

    <p class="auth-hint">{translateKey(AppStrings.Auth.ForgotPasswordHint)}</p>
  </form>
</div>

<style>
  .auth-backdrop {
    min-height: 100vh;
    display: grid;
    place-items: center;
    background: var(--color-bg-primary);
    padding: var(--space-4, 1rem);
  }

  .auth-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
    width: min(24rem, 100%);
    padding: var(--space-6, 1.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg, 10px);
    background: var(--color-bg-secondary);
  }

  .auth-brand {
    width: 4rem;
    height: 4rem;
    border-radius: var(--radius-lg, 10px);
    background: linear-gradient(135deg, var(--color-accent), var(--color-accent-hover, var(--color-accent)));
    align-self: center;
  }

  .auth-title {
    margin: 0;
    text-align: center;
    font-size: var(--text-xl, 1.25rem);
    font-weight: var(--font-semibold, 600);
    color: var(--color-text-primary);
  }

  .auth-subtitle {
    margin: 0;
    text-align: center;
    color: var(--color-text-secondary);
    font-size: var(--text-sm, 0.875rem);
  }

  .auth-error {
    margin: 0;
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border-radius: var(--radius-md, 6px);
    background: var(--color-danger-muted, rgba(191, 97, 106, 0.15));
    color: var(--color-danger, #bf616a);
    font-size: var(--text-sm, 0.875rem);
  }

  .auth-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .auth-label {
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary);
  }

  .auth-input {
    padding: 0.5rem var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm, 0.875rem);
  }

  .auth-input:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -1px;
  }

  .auth-hint {
    margin: 0;
    text-align: center;
    color: var(--color-text-muted);
    font-size: var(--text-xs, 0.75rem);
  }
</style>
