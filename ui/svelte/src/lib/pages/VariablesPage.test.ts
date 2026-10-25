import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import type { Variable } from '@macro-deck/runtime';
import VariablesPage from './VariablesPage.svelte';
import { applyVariableBatch, resetVariables } from '$lib/variables.svelte';
import { resetIntegrations } from '$lib/integrations.svelte';
import { resetVariableCatalog } from '$lib/variable-catalog.svelte';
import { navigate, startRouter, stopRouter } from '$lib/router.svelte';
import { startLocalization, stopLocalization, translateKey } from '$lib/localization.svelte';

/*
 * The page is a pure view over the stores: it loads nothing on mount, because the app
 * starts the stores once and the push channel keeps them current. That is what lets these
 * tests seed a store and render, with no transport, no socket and no fetch stub - if the
 * page ever grows a load of its own, these tests start hanging on a request that never
 * answers, which is the signal we want.
 *
 * Seeding goes through `applyVariableBatch`, the same entry point the push notification
 * uses, so the tests cannot seed a shape the host would never send.
 */

function variable(overrides: Partial<Variable> & { id: string }): Variable {
  return {
    name: overrides.id,
    scope: 'global',
    type: 'text',
    classification: 'user',
    value: '',
    ...overrides,
  } as Variable;
}

function seed(variables: Variable[]): void {
  applyVariableBatch(variables, []);
}

function atPath(path: string): void {
  window.history.replaceState(null, '', path);
  // The router only re-reads the location on popstate, so a test that changes the URL
  // after startRouter has to tell it. Without this the page keeps rendering the query
  // from the previous test and the source assertions pass or fail by ordering.
  navigate(path, { replace: true });
}

function railLabels(): string[] {
  return [...document.querySelectorAll('.source-list [role="option"]')].map(
    el => el.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  );
}

function groupHeadings(): string[] {
  return [...document.querySelectorAll('.vars-group-heading')].map(
    el => el.textContent?.trim() ?? '',
  );
}

function rowNames(): string[] {
  return [...document.querySelectorAll('.vr-primary')].map(el => el.textContent?.trim() ?? '');
}

describe('VariablesPage', () => {
  beforeEach(() => {
    resetVariables();
    resetIntegrations();
    resetVariableCatalog();
    startLocalization();
    atPath('/variables');
    startRouter();
  });

  afterEach(() => {
    cleanup();
    resetVariables();
    resetIntegrations();
    resetVariableCatalog();
    stopRouter();
    stopLocalization();
    vi.restoreAllMocks();
  });

  it('renders the rail with the all and user sources', () => {
    render(VariablesPage);

    const labels = railLabels();
    expect(labels[0]).toContain('All variables');
    expect(labels[1]).toContain('User');
  });

  it('counts every global variable under all and only user ones under user', () => {
    seed([
      variable({ id: 'a' }),
      variable({ id: 'b' }),
      variable({ id: 'c', classification: 'integration', ownerIntegrationId: 'plug' }),
    ]);

    render(VariablesPage);

    const labels = railLabels();
    expect(labels[0]).toContain('3');
    expect(labels[1]).toContain('2');
  });

  it('lists every global variable under the all source', () => {
    seed([variable({ id: 'alpha' }), variable({ id: 'beta' })]);

    render(VariablesPage);

    expect(rowNames()).toEqual(['alpha', 'beta']);
  });

  it('shows only user variables under the user source', () => {
    seed([
      variable({ id: 'mine' }),
      variable({ id: 'theirs', classification: 'integration', ownerIntegrationId: 'plug' }),
    ]);
    atPath('/variables?source=user');

    render(VariablesPage);

    expect(rowNames()).toEqual(['mine']);
  });

  it('shows only the selected integration under an integration source', () => {
    seed([
      variable({ id: 'mine' }),
      variable({ id: 'plugged', classification: 'integration', ownerIntegrationId: 'plug' }),
    ]);
    atPath('/variables?integrationId=plug');

    render(VariablesPage);

    expect(rowNames()).toEqual(['plugged']);
  });

  it('groups the list by where the variables came from', () => {
    seed([
      variable({ id: 'event', origin: 'event' }),
      variable({ id: 'mine' }),
      variable({ id: 'plugged', classification: 'integration', ownerIntegrationId: 'plug' }),
    ]);

    render(VariablesPage);

    expect(groupHeadings()).toEqual([
      translateKey('macrodeck.app:Variables.Source.ThisEvent'),
      translateKey('macrodeck.app:Variables.Source.User'),
      'plug',
    ]);
  });

  it('filters by name as the search box is typed into', async () => {
    seed([variable({ id: 'alpha' }), variable({ id: 'beta' })]);

    render(VariablesPage);
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'bet' } });

    expect(rowNames()).toEqual(['beta']);
  });

  it('filters by value as well as by name', async () => {
    seed([
      variable({ id: 'alpha', value: 'hello' }),
      variable({ id: 'beta', value: 'goodbye' }),
    ]);

    render(VariablesPage);
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'good' } });

    expect(rowNames()).toEqual(['beta']);
  });

  it('drops a group whose variables are all filtered out', async () => {
    seed([variable({ id: 'event', origin: 'event' }), variable({ id: 'mine' })]);

    render(VariablesPage);
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'mine' } });

    expect(groupHeadings()).toEqual([translateKey('macrodeck.app:Variables.Source.User')]);
  });

  it('shows the empty-filtered message when the search matches nothing', async () => {
    seed([variable({ id: 'alpha' })]);

    render(VariablesPage);
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'zzz' } });

    expect(
      screen.getByText(translateKey('macrodeck.app:Variables.Manager.EmptyFilteredHeading')),
    ).toBeTruthy();
  });

  it('shows the empty-none message when there are no variables at all', () => {
    render(VariablesPage);

    expect(
      screen.getByText(translateKey('macrodeck.app:Variables.Manager.EmptyNoneHeading')),
    ).toBeTruthy();
  });

  it('asks before deleting', async () => {
    seed([variable({ id: 'alpha' })]);

    render(VariablesPage);
    await fireEvent.click(
      screen.getByRole('button', { name: translateKey('macrodeck:Common.Delete') }),
    );

    expect(
      screen.getByText(translateKey('macrodeck.app:Variables.Manager.DeleteHeading')),
    ).toBeTruthy();
  });

  it('keeps the variable when the delete is cancelled', async () => {
    seed([variable({ id: 'alpha' })]);

    render(VariablesPage);
    await fireEvent.click(
      screen.getByRole('button', { name: translateKey('macrodeck:Common.Delete') }),
    );
    await fireEvent.click(
      screen.getByRole('button', { name: translateKey('macrodeck:Common.Cancel') }),
    );

    expect(
      screen.queryByText(translateKey('macrodeck.app:Variables.Manager.DeleteHeading')),
    ).toBeNull();
    expect(rowNames()).toEqual(['alpha']);
  });

  it('marks the selected source as active', () => {
    atPath('/variables?source=user');

    render(VariablesPage);

    const options = [...document.querySelectorAll('.source-list [role="option"]')];
    expect(options[0].getAttribute('aria-selected')).toBe('false');
    expect(options[1].getAttribute('aria-selected')).toBe('true');
  });

  it('does not fetch on mount, so navigating back cannot race the push channel', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(VariablesPage);
    await waitFor(() =>
      expect(document.querySelector('.vars-list, .manager-empty')).not.toBeNull(),
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
