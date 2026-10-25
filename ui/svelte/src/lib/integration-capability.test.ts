import { describe, expect, it } from 'vitest';
import {
  COUNTED_CAPABILITY_KINDS,
  integrationCapabilityIcon,
} from './integration-capability';

describe('integrationCapabilityIcon', () => {
  it('maps known capability kinds to their designated icons', () => {
    expect(integrationCapabilityIcon('actions')).toBe('zap');
    expect(integrationCapabilityIcon('events')).toBe('bell');
    expect(integrationCapabilityIcon('variables')).toBe('sliders');
    expect(integrationCapabilityIcon('weather')).toBe('weather-type');
  });

  it('falls back to puzzle for unknown capability kinds', () => {
    expect(integrationCapabilityIcon('unknown-kind')).toBe('puzzle');
  });

  it('identifies counted capabilities', () => {
    expect(COUNTED_CAPABILITY_KINDS).toContain('actions');
    expect(COUNTED_CAPABILITY_KINDS).toContain('variables');
    expect(COUNTED_CAPABILITY_KINDS).not.toContain('events');
  });
});
