import { describe, expect, it } from "vitest";
import { dateOnly, parseDateOnly, quotationLabel, quotationReference, requireDraft, todayInBusinessZone } from "./shared";
import { InvariantError } from "../../core/errors";

const ref = (iso: string, quoteSeq: number, revision = 1) => ({ quoteDate: new Date(`${iso}T00:00:00Z`), quoteSeq, revision });

describe("quotation reference", () => {
  it("is the date and a four-digit counter", () => {
    expect(quotationReference(ref("2026-09-26", 1))).toBe("QUO-20260926-0001");
    expect(quotationReference(ref("2026-01-05", 123))).toBe("QUO-20260105-0123");
    expect(quotationReference(ref("2026-01-05", 12345))).toBe("QUO-20260105-12345");
  });
  it('adds " rev N" from the second revision only', () => {
    expect(quotationLabel(ref("2026-09-26", 2, 1))).toBe("QUO-20260926-0002");
    expect(quotationLabel(ref("2026-09-26", 2, 2))).toBe("QUO-20260926-0002 rev 2");
  });
});

describe("date-only helpers", () => {
  it("round-trips a calendar date without shifting a day", () => {
    expect(dateOnly(parseDateOnly("2026-12-31"))).toBe("2026-12-31");
    expect(dateOnly(parseDateOnly("2026-01-01"))).toBe("2026-01-01");
  });
  it("keeps null as null", () => {
    expect(parseDateOnly(null)).toBeNull();
    expect(dateOnly(null)).toBeNull();
  });
});

describe("todayInBusinessZone (Asia/Dubai, UTC+4)", () => {
  it("is still the same day just before local midnight", () => {
    expect(todayInBusinessZone(new Date("2026-09-25T19:59:00Z"))).toBe("2026-09-25");
  });
  it("is the next day from local midnight, although UTC is still the earlier day", () => {
    expect(todayInBusinessZone(new Date("2026-09-25T20:00:00Z"))).toBe("2026-09-26");
    expect(todayInBusinessZone(new Date("2026-09-25T23:59:00Z"))).toBe("2026-09-26");
  });
  it("crosses a year boundary correctly", () => {
    expect(todayInBusinessZone(new Date("2026-12-31T20:30:00Z"))).toBe("2027-01-01");
  });
});

describe("requireDraft", () => {
  it("passes a draft and refuses anything else with the standard message", () => {
    expect(() => requireDraft({ status: "DRAFT" })).not.toThrow();
    for (const status of ["ISSUED", "SUPERSEDED"]) {
      expect(() => requireDraft({ status })).toThrow(InvariantError);
      expect(() => requireDraft({ status })).toThrow(/Revise it to make changes/);
    }
  });
});
