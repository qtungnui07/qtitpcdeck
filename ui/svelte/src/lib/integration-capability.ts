/*
 * Capability kinds and icon mappings for integrations.
 *
 * Actions and variables are counted in their own distinct badges on the card,
 * while other capabilities are listed individually with their own glyphs.
 */

export const COUNTED_CAPABILITY_KINDS: readonly string[] = ['actions', 'variables'];

const CAPABILITY_ICONS: Record<string, string> = {
  actions: 'zap',
  'action-states': 'zap',
  'action-icons': 'image',
  events: 'bell',
  variables: 'sliders',
  'music-player': 'music-player-type',
  weather: 'weather-type',
  calendar: 'clock-type',
  'email-inbox': 'mail',
  'virtual-profiles': 'layers',
  'battery-provider': 'battery',
};

export function integrationCapabilityIcon(kind: string): string {
  return CAPABILITY_ICONS[kind] ?? 'puzzle';
}
