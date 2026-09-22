import { describe, expect, it } from "vitest";
import { diffFields, hasChanges } from "./diff";

type Row = { name: string; phone: string | null; amount: { toString(): string } | null; seen: Date | null; active: boolean };

const before: Row = { name: "ABC", phone: null, amount: { toString: () => "2450.00" }, seen: new Date("2026-09-20T00:00:00Z"), active: true };
const fields = ["name", "phone", "amount", "seen", "active"] as const;

describe("diffFields", () => {
  it("returns only the fields that changed, as from/to", () => {
    const changes = diffFields(before, { name: "ABC Computers", phone: "0501234567" }, fields);
    expect(changes).toEqual({
      name: { from: "ABC", to: "ABC Computers" },
      phone: { from: null, to: "0501234567" },
    });
  });

  it("treats null and undefined as the same unknown value", () => {
    expect(diffFields(before, { phone: undefined }, fields)).toEqual({});
    expect(diffFields({ ...before, phone: null }, { phone: null }, fields)).toEqual({});
  });

  it("ignores fields not present in the patch", () => {
    expect(diffFields(before, {}, fields)).toEqual({});
  });

  it("compares Decimal-like and Date values by their serialised form", () => {
    const same = diffFields(before, { amount: { toString: () => "2450.00" }, seen: new Date("2026-09-20T00:00:00Z") }, fields);
    expect(same).toEqual({});
    const changed = diffFields(before, { amount: { toString: () => "2390.00" } }, fields);
    expect(changed).toEqual({ amount: { from: "2450.00", to: "2390.00" } });
  });

  it("records clearing a value as a change to null", () => {
    const withPhone: Row = { ...before, phone: "050" };
    expect(diffFields(withPhone, { phone: null }, fields)).toEqual({ phone: { from: "050", to: null } });
  });
});

describe("hasChanges", () => {
  it("reports whether anything changed", () => {
    expect(hasChanges({})).toBe(false);
    expect(hasChanges({ name: { from: "a", to: "b" } })).toBe(true);
  });
});
