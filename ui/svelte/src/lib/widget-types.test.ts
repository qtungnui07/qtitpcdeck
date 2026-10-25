import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WidgetTypeDto } from '@macro-deck/runtime';
import * as api from './api.svelte';
import { widgetTypeEndpoints } from './endpoints';
import {
  loadWidgetTypes,
  resetWidgetTypes,
  widgetTypeName,
  widgetTypeInfoFor,
  widgetTypeStore,
} from './widget-types.svelte';

const TYPES: WidgetTypeDto[] = [
  {
    id: 'ActionButton',
    providerId: 'macrodeck',
    isBuiltIn: true,
    // A LocalizedText is a plain string or a catalog {scope, key} ref - a
    // culture map is neither, and resolveLocalizedText answers '' for it.
    name: 'Action Button',
    defaultData: { label: '' },
    supportsConfigUi: true,
    configUiModelVersion: 2,
  },
  {
    id: 'plugin.clock',
    providerId: 'some.plugin',
    isBuiltIn: false,
    name: 'Clock',
    defaultData: {},
    supportsConfigUi: false,
    configUiModelVersion: 0,
  },
];

beforeEach(() => {
  vi.spyOn(widgetTypeEndpoints, 'list').mockResolvedValue({ success: true, types: TYPES });
  vi.spyOn(api, 'onConnected').mockReturnValue(() => undefined);
  vi.spyOn(api, 'onNotificationOf').mockReturnValue(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  resetWidgetTypes();
});

describe('widget type store', () => {
  it('loads the catalogue once and answers lookups from it', async () => {
    await loadWidgetTypes();
    await loadWidgetTypes();

    expect(widgetTypeEndpoints.list).toHaveBeenCalledTimes(1);
    expect(widgetTypeStore.types).toHaveLength(2);

    const info = await widgetTypeInfoFor('ActionButton');
    expect(info?.configUiModelVersion).toBe(2);
    expect(await widgetTypeInfoFor('missing.type')).toBeNull();
  });

  it('resolves a type display name from the catalogue', async () => {
    await loadWidgetTypes();
    expect(widgetTypeName('ActionButton')).toBe('Action Button');
    // Unknown types fall back to the raw id rather than an empty label.
    expect(widgetTypeName('missing.type')).toBe('missing.type');
  });

  it('answers no config UI for a type without one', async () => {
    await loadWidgetTypes();
    const info = await widgetTypeInfoFor('plugin.clock');
    expect(info?.supportsConfigUi).toBe(false);
  });
});
