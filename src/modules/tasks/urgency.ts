import { getFreshnessBand } from "../../lib/freshness";

/**
 * How late something is. Deterministic, no AI/scoring (CLAUDE.md "deterministic rules before LLM reasoning").
 * Drives both sort order (rank.ts) and the badge shown in the UI.
 */
export type TaskUrgency = "normal" | "aging" | "overdue";

const HOUR_MS = 3_600_000;

/**
 * Age-based read for something with no deadline, reusing the one freshness scale already in the app
 * (lib/freshness.ts: under 24h / under 7d / under 14d) so "how late" reads the same as every other age
 * signal in the app. fresh/recent -> normal, aging -> aging, stale (14d+) -> overdue.
 */
export function urgencyFromAge(anchorAt: Date, now: Date = new Date()): TaskUrgency {
  const band = getFreshnessBand(anchorAt, now);
  if (band === "stale") return "overdue";
  if (band === "aging") return "aging";
  return "normal";
}

/** Deadline-based: overdue once passed, "aging" inside a warning window before it, otherwise normal. */
export function urgencyFromDeadline(dueAt: Date, now: Date = new Date(), warningHours = 48): TaskUrgency {
  const msRemaining = dueAt.getTime() - now.getTime();
  if (msRemaining < 0) return "overdue";
  if (msRemaining < warningHours * HOUR_MS) return "aging";
  return "normal";
}

/**
 * A faster, explicit clock for exactly one rule (an enquiry with no quote sent yet): a live lead going cold should
 * read overdue well before the general 14-day freshness scale would catch it.
 */
export function urgencyFromFixedAge(anchorAt: Date, now: Date, agingAfterHours: number, overdueAfterHours: number): TaskUrgency {
  const ageHours = (now.getTime() - anchorAt.getTime()) / HOUR_MS;
  if (ageHours >= overdueAfterHours) return "overdue";
  if (ageHours >= agingAfterHours) return "aging";
  return "normal";
}

/** A deadline wins when present; otherwise the age-based read. */
export function resolveUrgency(dueAt: Date | null, anchorAt: Date, now: Date = new Date()): TaskUrgency {
  return dueAt ? urgencyFromDeadline(dueAt, now) : urgencyFromAge(anchorAt, now);
}
