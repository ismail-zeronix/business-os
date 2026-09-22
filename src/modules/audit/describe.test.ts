import { describe, expect, it } from "vitest";
import { auditActionLabel, describeDetails, humanizeField } from "./describe";

describe("humanizeField", () => {
  it("turns camelCase and snake_case into a sentence", () => {
    expect(humanizeField("paymentTerms")).toBe("Payment terms");
    expect(humanizeField("preferred_channel")).toBe("Preferred channel");
    expect(humanizeField("name")).toBe("Name");
  });
});

describe("auditActionLabel", () => {
  it("uses friendly labels and falls back to the raw action for unknown ones", () => {
    expect(auditActionLabel("supplier.created")).toBe("Supplier created");
    expect(auditActionLabel("something.new")).toBe("something.new");
  });
});

describe("describeDetails", () => {
  it("formats from/to diffs and shows unknown as a dash", () => {
    expect(describeDetails({ paymentTerms: { from: null, to: "30 days" }, emirate: { from: "Dubai", to: "Sharjah" } })).toEqual([
      "Payment terms: — → 30 days",
      "Emirate: Dubai → Sharjah",
    ]);
  });

  it("formats added/removed association changes and skips empty sides", () => {
    expect(describeDetails({ brands: { added: ["Dell"], removed: ["HP"] } })).toEqual(["Brands: added Dell, removed HP"]);
    expect(describeDetails({ brands: { added: ["Dell"], removed: [] } })).toEqual(["Brands: added Dell"]);
  });

  it("formats plain lists and scalar context, and ignores empty values", () => {
    expect(describeDetails({ name: "ABC", brands: ["Dell", "HP"], categories: [], notes: null })).toEqual(["Name: ABC", "Brands: Dell, HP"]);
  });

  it("returns nothing for missing or non-object details", () => {
    expect(describeDetails(null)).toEqual([]);
    expect(describeDetails(undefined)).toEqual([]);
    expect(describeDetails("text")).toEqual([]);
  });
});
