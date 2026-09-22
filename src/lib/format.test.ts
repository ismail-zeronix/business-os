import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatMoney, formatQuantity, formatRelativeAge } from "./format";

const TZ = "Asia/Dubai"; // UTC+4, no DST
const at = (iso: string) => new Date(iso);

describe("formatRelativeAge", () => {
  const now = at("2026-09-20T10:00:00+04:00");

  it("says just now under a minute, and tolerates clock skew", () => {
    expect(formatRelativeAge(at("2026-09-20T09:59:40+04:00"), now, TZ)).toBe("just now");
    expect(formatRelativeAge(at("2026-09-20T10:05:00+04:00"), now, TZ)).toBe("just now");
  });

  it("uses minutes under an hour", () => {
    expect(formatRelativeAge(at("2026-09-20T09:48:00+04:00"), now, TZ)).toBe("12 min ago");
  });

  it("uses hours under a day, singular for one", () => {
    expect(formatRelativeAge(at("2026-09-20T09:00:00+04:00"), now, TZ)).toBe("1 hour ago");
    expect(formatRelativeAge(at("2026-09-20T07:00:00+04:00"), now, TZ)).toBe("3 hours ago");
  });

  it("says Yesterday for the previous local calendar day", () => {
    expect(formatRelativeAge(at("2026-09-19T09:00:00+04:00"), now, TZ)).toBe("Yesterday");
    expect(formatRelativeAge(at("2026-09-19T00:30:00+04:00"), now, TZ)).toBe("Yesterday");
  });

  it("counts local calendar days beyond that", () => {
    expect(formatRelativeAge(at("2026-09-18T23:00:00+04:00"), now, TZ)).toBe("2 days ago");
    expect(formatRelativeAge(at("2026-09-02T10:00:00+04:00"), now, TZ)).toBe("18 days ago");
  });

  it("uses the business timezone for the day boundary, not UTC", () => {
    // 01:00 Dubai on the 20th is 21:00 UTC on the 19th, and 23:00 Dubai on the 18th is 19:00 UTC on the 18th.
    // By the UTC calendar the second is "Yesterday"; by the Dubai calendar it is two days ago.
    const justAfterLocalMidnight = at("2026-09-20T01:00:00+04:00");
    expect(formatRelativeAge(at("2026-09-18T23:00:00+04:00"), justAfterLocalMidnight, TZ)).toBe("2 days ago");
    expect(formatRelativeAge(at("2026-09-19T00:30:00+04:00"), justAfterLocalMidnight, TZ)).toBe("Yesterday");
  });

  it("falls back to months and years for old data", () => {
    expect(formatRelativeAge(at("2026-06-20T10:00:00+04:00"), now, TZ)).toBe("3 months ago");
    expect(formatRelativeAge(at("2024-09-20T10:00:00+04:00"), now, TZ)).toBe("2 years ago");
  });
});

describe("formatDateTime / formatDate", () => {
  it("renders in the business timezone with fixed English month names", () => {
    expect(formatDateTime(at("2026-09-20T05:14:00Z"), TZ)).toBe("20 Sep 2026, 09:14");
    expect(formatDate(at("2026-09-20T22:30:00Z"), TZ)).toBe("21 Sep 2026"); // already the next day in Dubai
  });
});

describe("formatMoney", () => {
  it("omits decimals when whole and keeps them when present", () => {
    expect(formatMoney("2450.00", "AED")).toBe("AED 2,450");
    expect(formatMoney(1450, "AED")).toBe("AED 1,450");
    expect(formatMoney("2450.50", "USD")).toBe("USD 2,450.50");
  });

  it("accepts Decimal-like objects", () => {
    expect(formatMoney({ toString: () => "1234567.89" }, "AED")).toBe("AED 1,234,567.89");
  });
});

describe("formatQuantity", () => {
  it("returns null for unknown so callers show Unknown, never 0", () => {
    expect(formatQuantity(null)).toBeNull();
    expect(formatQuantity(undefined)).toBeNull();
  });

  it("formats known quantities including a genuine zero", () => {
    expect(formatQuantity(25)).toBe("25 pcs");
    expect(formatQuantity(1)).toBe("1 pc");
    expect(formatQuantity(0)).toBe("0 pcs");
    expect(formatQuantity(1200)).toBe("1,200 pcs");
  });
});
