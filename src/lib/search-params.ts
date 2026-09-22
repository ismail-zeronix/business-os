/** Helpers for URL-driven list state (search, filters, page). All list state lives in the URL so views are shareable and back-button safe. */

export type SearchParams = Record<string, string | string[] | undefined>;

export const PAGE_SIZE = 25;

export function firstParam(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  const single = Array.isArray(value) ? value[0] : value;
  const trimmed = single?.trim();
  return trimmed ? trimmed : undefined;
}

/** 1-based page number; anything invalid falls back to 1. */
export function parsePage(searchParams: SearchParams, key = "page"): number {
  const parsed = Number.parseInt(firstParam(searchParams, key) ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

/** Builds `pathname?query` from the current params with a patch applied. `undefined`/`null`/"" removes a key. */
export function buildHref(
  pathname: string,
  current: SearchParams,
  patch: Record<string, string | number | null | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(current)) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) query.set(key, value);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === "") query.delete(key);
    else query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
