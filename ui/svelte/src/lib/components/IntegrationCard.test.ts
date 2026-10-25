import { render } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStrings } from '@macro-deck/runtime';
import { startLocalization, translateKey } from '$lib/localization.svelte';
import type { Integration } from '$lib/integrations.svelte';
import IntegrationCard from './IntegrationCard.svelte';

const mockIntegration: Integration = {
  id: 'test-plugin',
  name: 'Test Plugin',
  version: '1.2.0',
  isInternal: false,
  enabled: true,
  actionCount: 5,
  variableCount: 3,
  supportsConfigFlow: false,
  allowsMultipleConfigurations: false,
  requiresConfiguration: false,
  configuredEntryCount: 0,
  hasIcon: false,
  iconVersion: null,
  issueCount: 2,
  issueSeverity: 'warning',
  isInitialized: true,
  variablesDependOnConfiguration: false,
  providedCapabilities: [],
};

describe('IntegrationCard', () => {
  beforeEach(() => {
    startLocalization();
  });

  it('renders integration name and version for plugins', () => {
    const { getByText } = render(IntegrationCard, { integration: mockIntegration });
    expect(getByText('Test Plugin')).toBeDefined();
    expect(getByText('v1.2.0')).toBeDefined();
    expect(getByText(translateKey(AppStrings.Store.KindLabel.Plugin))).toBeDefined();
  });

  it('renders action and variable counters', () => {
    const { getByText } = render(IntegrationCard, { integration: mockIntegration });
    const actionText = translateKey(AppStrings.Integrations.Page.ActionCount, { count: 5 });
    const variableText = translateKey(AppStrings.Integrations.Page.VariableCount, { count: 3 });
    expect(getByText(actionText)).toBeDefined();
    expect(getByText(variableText)).toBeDefined();
  });

  it('renders issue count when issues exist', () => {
    const { getByText } = render(IntegrationCard, { integration: mockIntegration });
    const issueText = translateKey(AppStrings.Integrations.Page.IssueCount, { count: 2 });
    expect(getByText(issueText)).toBeDefined();
  });

  it('calls onselect when clicked', () => {
    const onselect = vi.fn();
    const { container } = render(IntegrationCard, {
      integration: mockIntegration,
      onselect,
    });
    const card = container.querySelector('.integration-card') as HTMLElement;
    card.click();
    expect(onselect).toHaveBeenCalledWith(mockIntegration);
  });

  it('requests disable confirmation when toggling off an enabled integration', () => {
    const ondisablerequest = vi.fn();
    const { getByRole } = render(IntegrationCard, {
      integration: mockIntegration,
      ondisablerequest,
    });
    const toggle = getByRole('checkbox');
    toggle.click();
    expect(ondisablerequest).toHaveBeenCalledWith(mockIntegration);
  });
});
