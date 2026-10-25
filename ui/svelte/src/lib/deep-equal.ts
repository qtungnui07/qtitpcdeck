/*
 * Structural equality, ported verbatim from the Angular util of the same
 * name. The widget editor's dirty check and draft reconciliation both ride
 * on it, so the semantics - NaN equals NaN, undefined keys are absent, dates
 * compare by time - are the ones the rest of the port was written against.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (!isObject(a) || !isObject(b)) {
    return typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b);
  }

  const keys = definedKeys(a);
  if (keys.length !== definedKeys(b).length) {
    return false;
  }
  return keys.every(key => deepEqual(a[key], b[key]));
}

function definedKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).filter(key => value[key] !== undefined);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
