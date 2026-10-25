/*
 * Widget data diffing for adopting a live update into a dirty draft,
 * ported verbatim from the Angular util of the same name.
 *
 * The page keeps editing a copy; the host may rewrite the stored widget under
 * it. The diff is what lets an outside change land without discarding the
 * user's own edits: only the keys the host actually changed are adopted.
 */
type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function diffWidgetData(baseline: unknown, current: unknown): Bag | null {
  if (!isBag(baseline) || !isBag(current)) return null;

  const patch: Bag = {};
  for (const key of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
    const before = baseline[key];
    const after = current[key];

    if (isBag(before) && isBag(after)) {
      const nested = diffWidgetData(before, after);
      if (nested) patch[key] = nested;
      continue;
    }

    if (JSON.stringify(before) !== JSON.stringify(after)) patch[key] = after;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export function applyWidgetDataPatch<T>(draft: T, patch: Bag | null): T {
  if (!patch || !isBag(draft)) return draft;

  const merged: Bag = { ...draft };
  for (const [key, value] of Object.entries(patch)) {
    const existing = merged[key];
    merged[key] = isBag(value) && isBag(existing) ? applyWidgetDataPatch(existing, value) : value;
  }

  return merged as T;
}
