import { describe, expect, it } from 'vitest';
import { applyWidgetDataPatch, diffWidgetData } from './widget-data-patch';

describe('diffWidgetData', () => {
  it('returns null for identical bags', () => {
    expect(diffWidgetData({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBeNull();
  });

  it('returns null when either side is not a bag', () => {
    expect(diffWidgetData(null, { a: 1 })).toBeNull();
    expect(diffWidgetData({ a: 1 }, 'nope')).toBeNull();
  });

  it('records changed, added and removed keys', () => {
    const patch = diffWidgetData({ a: 1, b: 2, c: 3 }, { a: 9, b: 2, d: 4 });
    expect(patch).toEqual({ a: 9, c: undefined, d: 4 });
  });

  it('diffs nested bags recursively', () => {
    const patch = diffWidgetData({ style: { color: '#fff', size: 2 } }, { style: { color: '#000', size: 2 } });
    expect(patch).toEqual({ style: { color: '#000' } });
  });
});

describe('applyWidgetDataPatch', () => {
  it('returns the draft untouched for a null patch', () => {
    const draft = { a: 1 };
    expect(applyWidgetDataPatch(draft, null)).toBe(draft);
  });

  it('overwrites only the patched keys', () => {
    const merged = applyWidgetDataPatch({ a: 1, b: 2 }, { a: 10 });
    expect(merged).toEqual({ a: 10, b: 2 });
  });

  it('merges nested bags instead of replacing them', () => {
    const merged = applyWidgetDataPatch(
      { style: { color: '#fff', size: 2 }, label: 'x' },
      { style: { color: '#000' } },
    );
    expect(merged).toEqual({ style: { color: '#000', size: 2 }, label: 'x' });
  });

  it('round-trips through the diff', () => {
    const before = { a: 1, style: { color: '#fff' } };
    const after = { a: 2, style: { color: '#fff' } };
    const dirty = { a: 99, style: { color: '#fff', extra: true } };
    const patch = diffWidgetData(before, after);
    expect(applyWidgetDataPatch(dirty, patch)).toEqual({ a: 2, style: { color: '#fff', extra: true } });
  });
});
