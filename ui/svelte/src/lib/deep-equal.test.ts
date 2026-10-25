import { describe, expect, it } from 'vitest';
import { deepEqual } from './deep-equal';

describe('deepEqual', () => {
  it('equals primitives and identical references', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('a', 'a')).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
    const shared = { a: 1 };
    expect(deepEqual(shared, shared)).toBe(true);
  });

  it('treats NaN as equal to NaN', () => {
    expect(deepEqual(Number.NaN, Number.NaN)).toBe(true);
    expect(deepEqual(Number.NaN, 1)).toBe(false);
  });

  it('compares arrays element by element', () => {
    expect(deepEqual([1, { a: 2 }], [1, { a: 2 }])).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('compares objects structurally, ignoring keys that are undefined', () => {
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: { b: [1] } }, { a: { b: [1] } })).toBe(true);
  });

  it('compares dates by time', () => {
    expect(deepEqual(new Date(1000), new Date(1000))).toBe(true);
    expect(deepEqual(new Date(1000), new Date(2000))).toBe(false);
    expect(deepEqual(new Date(1000), 1000)).toBe(false);
  });
});
