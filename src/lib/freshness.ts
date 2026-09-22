/**
 * Freshness of an observation, measured from when the SUPPLIER stated it (observed_at), never from when we entered it.
 * The single place that defines the bands (docs/design/UI_SYSTEM.md section 6). Change thresholds here only.
 */

export type FreshnessBand = "fresh" | "recent" | "aging" | "stale";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export const FRESHNESS_LIMITS_MS = {
  /** under 24 hours */
  fresh: DAY_MS,
  /** under 7 days */
  recent: 7 * DAY_MS,
  /** under 14 days; 14 days or more is stale */
  aging: 14 * DAY_MS,
} as const;

export function getFreshnessBand(observedAt: Date, now: Date = new Date()): FreshnessBand {
  const ageMs = Math.max(0, now.getTime() - observedAt.getTime());
  if (ageMs < FRESHNESS_LIMITS_MS.fresh) return "fresh";
  if (ageMs < FRESHNESS_LIMITS_MS.recent) return "recent";
  if (ageMs < FRESHNESS_LIMITS_MS.aging) return "aging";
  return "stale";
}
