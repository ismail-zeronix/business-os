/**
 * Display formatting. Pure functions. Timestamps are stored in UTC and shown in the business timezone (Asia/Dubai by default).
 * Unknown values are never invented: callers pass null/undefined and get UNKNOWN back so the UI can render an explicit "Unknown".
 */

export const UNKNOWN = "Unknown";
export const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Dubai";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Zoned = { year: number; month: number; day: number; hour: number; minute: number };

function zoned(date: Date, timeZone: string): Zoned {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "20 Sep 2026" */
export function formatDate(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  const z = zoned(date, timeZone);
  return `${z.day} ${MONTHS[z.month - 1]} ${z.year}`;
}

/** "20 Sep 2026, 09:14" (24-hour, business timezone) */
export function formatDateTime(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  const z = zoned(date, timeZone);
  return `${z.day} ${MONTHS[z.month - 1]} ${z.year}, ${pad(z.hour)}:${pad(z.minute)}`;
}

/** Calendar day number in the given timezone, so "yesterday" means the previous local calendar day. */
function localDayNumber(date: Date, timeZone: string): number {
  const z = zoned(date, timeZone);
  return Math.floor(Date.UTC(z.year, z.month - 1, z.day) / 86_400_000);
}

/**
 * "just now", "12 min ago", "3 hours ago", "Yesterday", "18 days ago", "3 months ago".
 * A timestamp slightly in the future (clock skew) is treated as "just now".
 */
export function formatRelativeAge(date: Date, now: Date = new Date(), timeZone = DEFAULT_TIMEZONE): string {
  const elapsedMs = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

  const days = Math.max(1, localDayNumber(now, timeZone) - localDayNumber(date, timeZone));
  if (days === 1) return "Yesterday";
  if (days < 60) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

type MoneyLike = string | number | { toString(): string };

/** "AED 2,450" or "AED 2,450.50". Decimals only when present. Amounts are DECIMAL(14,2), which a JS number represents exactly. */
export function formatMoney(amount: MoneyLike, currencyCode: string): string {
  const value = Number(amount.toString());
  if (!Number.isFinite(value)) return UNKNOWN;
  const hasFraction = Math.round(value * 100) % 100 !== 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
  return `${currencyCode} ${formatted}`;
}

/** "25 pcs", "1 pc"; null (unknown) returns null so the caller renders "Unknown", never "0". */
export function formatQuantity(quantity: number | null | undefined): string | null {
  if (quantity == null) return null;
  return `${quantity.toLocaleString("en-US")} ${quantity === 1 ? "pc" : "pcs"}`;
}

/** "2026-09-20T09:14" for an <input type="datetime-local">, showing the given instant in the business timezone. */
export function toZonedInputValue(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  const z = zoned(date, timeZone);
  return `${z.year}-${pad(z.month)}-${pad(z.day)}T${pad(z.hour)}:${pad(z.minute)}`;
}

/**
 * Reads a datetime-local value ("2026-09-20T09:14") as wall-clock time in the business timezone and returns the UTC instant.
 * Returns null for anything that is not a real date. (One offset correction; exact for Asia/Dubai, which has no DST.)
 */
export function zonedInputToUtc(value: string, timeZone = DEFAULT_TIMEZONE): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [number, number, number, number, number];
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(asUtc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null; // e.g. 31 Feb
  const z = zoned(check, timeZone);
  const offsetMs = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute) - asUtc;
  return new Date(asUtc - offsetMs);
}
