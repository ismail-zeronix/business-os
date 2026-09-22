import type { EnquiryStatus } from "../../generated/prisma/enums";
import { getFreshnessBand, type FreshnessBand } from "../../lib/freshness";

/**
 * Pure logic for the Overview charts: date ranges, per-day counts, pipeline stages, win rate and price-freshness bands. No database access,
 * so it is easy to test later. Days are Dubai calendar days (UTC+4, no daylight saving), the business timezone. Everything is derived from
 * real records; a figure that cannot be computed is null and shown as "Unknown", never guessed.
 */

export const OVERVIEW_RANGES = [7, 30, 90] as const;
export type OverviewRange = (typeof OVERVIEW_RANGES)[number];
export const DEFAULT_RANGE: OverviewRange = 30;

export function parseRange(value: string | undefined): OverviewRange {
  const days = Number(value);
  return (OVERVIEW_RANGES as readonly number[]).includes(days) ? (days as OverviewRange) : DEFAULT_RANGE;
}

const DAY_MS = 86_400_000;
const DUBAI_OFFSET_MS = 4 * 3_600_000;

/** Dubai calendar day number of an instant (days since 1970-01-01 in Dubai). */
export const dubaiDay = (date: Date): number => Math.floor((date.getTime() + DUBAI_OFFSET_MS) / DAY_MS);

/** First instant of a window of `days` Dubai calendar days ending with today. */
export const rangeStart = (now: Date, days: number): Date => new Date((dubaiDay(now) - days + 1) * DAY_MS - DUBAI_OFFSET_MS);

/** "21 Sep" for a Dubai day number. */
export function dayLabel(day: number): string {
  return new Date(day * DAY_MS).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export const percentChange = (current: number, previous: number): number | null => (previous > 0 ? Math.round(((current - previous) / previous) * 100) : null);

export type DayCount = { day: number; label: string; count: number };

/** Number of `dates` on each of the last `days` Dubai days, oldest first (days with none are 0). */
export function dailyCounts(dates: Date[], now: Date, days: number): DayCount[] {
  const first = dubaiDay(now) - days + 1;
  const counts = new Array<number>(days).fill(0);
  for (const date of dates) {
    const index = dubaiDay(date) - first;
    if (index >= 0 && index < days) counts[index]! += 1;
  }
  return counts.map((count, index) => ({ day: first + index, label: dayLabel(first + index), count }));
}

/** How many of `dates` fall inside the `days` days before the current window (for "vs previous period"). */
export function countInPreviousWindow(dates: Date[], now: Date, days: number): number {
  const today = dubaiDay(now);
  return dates.filter((date) => {
    const day = dubaiDay(date);
    return day >= today - 2 * days + 1 && day <= today - days;
  }).length;
}

export type PipelineStage = "new" | "progress" | "qualified" | "won" | "lost";
export const PIPELINE_STAGES: readonly PipelineStage[] = ["new", "progress", "qualified", "won", "lost"];
export const PIPELINE_LABEL: Record<PipelineStage, string> = { new: "New", progress: "In progress", qualified: "Quote ready or quoted", won: "Won", lost: "Lost" };

const STAGE_OF: Record<EnquiryStatus, PipelineStage> = {
  NEW: "new",
  ASSIGNED: "progress",
  SOURCING: "progress",
  WAITING_SUPPLIER: "progress",
  NEGOTIATION: "progress",
  FOLLOW_UP: "progress",
  ON_HOLD: "progress",
  QUOTATION_READY: "qualified",
  QUOTED: "qualified",
  WON: "won",
  LOST: "lost",
};

export function pipelineCounts(statuses: EnquiryStatus[]): Record<PipelineStage, number> {
  const counts: Record<PipelineStage, number> = { new: 0, progress: 0, qualified: 0, won: 0, lost: 0 };
  for (const status of statuses) counts[STAGE_OF[status]] += 1;
  return counts;
}

/** Won / (Won + Lost) as a percentage with one decimal; null while nothing is closed. */
export function winRate(counts: Pick<Record<PipelineStage, number>, "won" | "lost">): number | null {
  const closed = counts.won + counts.lost;
  return closed > 0 ? Math.round((counts.won / closed) * 1000) / 10 : null;
}

export const FRESHNESS_ORDER: readonly FreshnessBand[] = ["fresh", "recent", "aging", "stale"];

/** Bands (fresh / recent / aging / stale, defined once in lib/freshness.ts) of a set of observation times. */
export function freshnessCounts(observedAt: Date[], now: Date): Record<FreshnessBand, number> {
  const counts: Record<FreshnessBand, number> = { fresh: 0, recent: 0, aging: 0, stale: 0 };
  for (const date of observedAt) counts[getFreshnessBand(date, now)] += 1;
  return counts;
}
