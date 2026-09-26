import { describe, expect, it } from "vitest";
import { computeTotals, lineMarginCents, lineTotalCents, markupFromPrice, priceFromMarkup, resolveLinePricing, summariseMargin } from "./pricing";

describe("priceFromMarkup", () => {
  it("adds the markup to the cost, rounded to a cent", () => {
    expect(priceFromMarkup("100", "10")).toBe("110.00");
    expect(priceFromMarkup("99.99", "12.5")).toBe("112.49");
    expect(priceFromMarkup("0.01", "50")).toBe("0.02");
  });
  it("allows a discount down to -100 (a zero price)", () => {
    expect(priceFromMarkup("200", "-25")).toBe("150.00");
    expect(priceFromMarkup("200", "-100")).toBe("0.00");
  });
  it("is null for a negative cost, an out-of-range markup, or text", () => {
    expect(priceFromMarkup("-1", "10")).toBeNull();
    expect(priceFromMarkup("100", "-100.01")).toBeNull();
    expect(priceFromMarkup("100", "100000")).toBeNull();
    expect(priceFromMarkup("abc", "10")).toBeNull();
  });
  it("is null when the price is too large to store", () => {
    expect(priceFromMarkup("99999999999999", "50")).toBeNull();
  });
});

describe("markupFromPrice", () => {
  it("works out the markup to two decimals", () => {
    expect(markupFromPrice("100", "110")).toBe("10.00");
    expect(markupFromPrice("3", "4")).toBe("33.33");
    expect(markupFromPrice("100", "75")).toBe("-25.00");
  });
  it("shows a zero markup without a minus sign", () => {
    expect(markupFromPrice("100", "100")).toBe("0.00");
    expect(markupFromPrice("300", "299.999")).toBe("0.00");
  });
  it("is null with no cost, a zero cost, a negative price, or an out-of-range result", () => {
    expect(markupFromPrice("0", "10")).toBeNull();
    expect(markupFromPrice("-5", "10")).toBeNull();
    expect(markupFromPrice("10", "-1")).toBeNull();
    expect(markupFromPrice("0.01", "1000")).toBeNull();
    expect(markupFromPrice("x", "10")).toBeNull();
  });
});

describe("lineTotalCents", () => {
  it("multiplies quantity by price in cents", () => {
    expect(lineTotalCents(3, "19.99")).toBe(5997);
    expect(lineTotalCents(0, "10")).toBe(0);
  });
  it("is null while a quantity or price is missing", () => {
    expect(lineTotalCents(null, "10")).toBeNull();
    expect(lineTotalCents(2, null)).toBeNull();
    expect(lineTotalCents(2, "abc")).toBeNull();
  });
});

describe("computeTotals", () => {
  it("rounds VAT once, on the subtotal", () => {
    // Three lines of 0.10 at 5% VAT: 0.30 x 5% = 0.015, rounded once to 0.02.
    const t = computeTotals([{ quantity: 1, unitPrice: "0.10" }, { quantity: 1, unitPrice: "0.10" }, { quantity: 1, unitPrice: "0.10" }], "5");
    expect(t).toEqual({ subtotal: "0.30", vat: "0.02", total: "0.32", incompleteLines: 0 });
  });
  it("counts an incomplete line but leaves it out of the totals", () => {
    const t = computeTotals([{ quantity: 2, unitPrice: "100" }, { quantity: null, unitPrice: "5" }, { quantity: 1, unitPrice: null }], "5");
    expect(t).toEqual({ subtotal: "200.00", vat: "10.00", total: "210.00", incompleteLines: 2 });
  });
  it("allows 0% VAT and treats bad VAT text as 0", () => {
    expect(computeTotals([{ quantity: 1, unitPrice: "50" }], "0").total).toBe("50.00");
    expect(computeTotals([{ quantity: 1, unitPrice: "50" }], "abc").total).toBe("50.00");
  });
  it("handles no lines", () => {
    expect(computeTotals([], "5")).toEqual({ subtotal: "0.00", vat: "0.00", total: "0.00", incompleteLines: 0 });
  });
});

describe("summariseMargin and lineMarginCents", () => {
  const line = { quantity: 2, unitPrice: "150", costAmount: "100", costComparable: true };
  it("sums revenue, cost and margin over covered lines", () => {
    const m = summariseMargin([line, { quantity: 1, unitPrice: "50", costAmount: "40", costComparable: true }]);
    expect(m).toMatchObject({ revenue: "350.00", cost: "240.00", margin: "110.00", marginPercent: "31.4", coveredLines: 2, totalLines: 2 });
  });
  it("never mixes in a cost in another currency, an unknown cost or an incomplete line", () => {
    const m = summariseMargin([line, { ...line, costComparable: false }, { ...line, costAmount: null }, { ...line, quantity: null }]);
    expect(m.coveredLines).toBe(1);
    expect(m.totalLines).toBe(4);
    expect(m.margin).toBe("100.00");
  });
  it("has no percentage without revenue", () => {
    expect(summariseMargin([]).marginPercent).toBeNull();
    expect(summariseMargin([{ ...line, costComparable: false }]).marginPercent).toBeNull();
  });
  it("gives a line's profit, or null when any part is unknown", () => {
    expect(lineMarginCents(line)).toBe(10000);
    expect(lineMarginCents({ ...line, costComparable: false })).toBeNull();
    expect(lineMarginCents({ ...line, costAmount: null })).toBeNull();
  });
});

describe("resolveLinePricing", () => {
  const base = { markupPercent: null, unitPrice: null, costAmount: "100", costComparable: true };
  it("MARKUP works the price out from the cost", () => {
    expect(resolveLinePricing({ ...base, basis: "MARKUP", markupPercent: "20" })).toEqual({ unitPrice: "120.00", markupPercent: "20.00" });
  });
  it("MARKUP with a blank markup clears the price", () => {
    expect(resolveLinePricing({ ...base, basis: "MARKUP" })).toEqual({ unitPrice: null, markupPercent: null });
  });
  it("MARKUP is refused without a known, comparable cost", () => {
    expect(resolveLinePricing({ ...base, basis: "MARKUP", markupPercent: "20", costAmount: null })).toMatchObject({ field: "markupPercent" });
    expect(resolveLinePricing({ ...base, basis: "MARKUP", markupPercent: "20", costComparable: false })).toMatchObject({ field: "markupPercent" });
  });
  it("MARKUP is refused when the price cannot be saved", () => {
    expect(resolveLinePricing({ ...base, basis: "MARKUP", markupPercent: "-200" })).toMatchObject({ field: "markupPercent" });
  });
  it("PRICE keeps the price and works the markup out from a comparable cost", () => {
    expect(resolveLinePricing({ ...base, basis: "PRICE", unitPrice: "125" })).toEqual({ unitPrice: "125.00", markupPercent: "25.00" });
  });
  it("PRICE with no comparable cost leaves the markup empty", () => {
    expect(resolveLinePricing({ ...base, basis: "PRICE", unitPrice: "125", costAmount: null })).toEqual({ unitPrice: "125.00", markupPercent: null });
    expect(resolveLinePricing({ ...base, basis: "PRICE", unitPrice: "125", costComparable: false })).toEqual({ unitPrice: "125.00", markupPercent: null });
  });
  it("PRICE with a blank price clears both, and refuses a price that is too large", () => {
    expect(resolveLinePricing({ ...base, basis: "PRICE" })).toEqual({ unitPrice: null, markupPercent: null });
    expect(resolveLinePricing({ ...base, basis: "PRICE", unitPrice: "1000000000000" })).toMatchObject({ field: "unitPrice" });
  });
});
