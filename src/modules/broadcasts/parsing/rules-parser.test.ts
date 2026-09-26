import { describe, expect, it } from "vitest";
import { rulesParser } from "./rules-parser";

/**
 * Fixtures are the product-line formats of real supplier broadcasts (a bulleted price list, and one-line "LAP ... @price" lists), with no
 * supplier name, contact or phone number. The expectations are the business rules: nothing is guessed, a missing price leaves the currency
 * empty, quantity and stock stay unknown unless written.
 */
const context = { brands: ["HP", "Lenovo", "Dell"], categories: ["Laptop", "Monitor"] };
const parse = (text: string) => rulesParser.parse(text, context);

const priceListBlocks = [
  "*LAPTOP PRICE LIST READY STOCK* ",
  "",
  "*HP*",
  "",
  "*HP PROBOOK 440 G11*",
  "A38B9ET#BH5 | U5-125U | 16GB | 512GB SSD | 14” | DOS",
  "💰 AED 2,750",
  "",
  "*HP 255R G10*",
  "B9YQ1ET | R5-7535U | 16GB | 512GB SSD | 15.6” FHD IPS | FreeDOS",
  "💰 AED 1,895",
  "",
].join("\n");

describe("rulesParser: a block price list", () => {
  const items = parse(priceListBlocks);

  it("finds one item per product block, in order, and skips the header and brand lines", () => {
    expect(items.map((i) => i.position)).toEqual([1, 2]);
    expect(items.map((i) => i.description)).toEqual(["HP PROBOOK 440 G11", "HP 255R G10"]);
  });
  it("reads brand, model, part number and the written price with thousands separators", () => {
    expect(items[0]).toMatchObject({ brandText: "HP", modelText: "440 G11", partNumber: "A38B9ET#BH5", priceAmount: "2750", currencyCode: "AED", confidence: "HIGH" });
    expect(items[1]).toMatchObject({ modelText: "255R G10", partNumber: "B9YQ1ET", priceAmount: "1895" });
  });
  it("keeps the spec text and does not repeat the part number in it", () => {
    expect(items[0]!.specText).toContain("16GB");
    expect(items[0]!.specText).not.toContain("A38B9ET");
  });
  it("points back at the exact source lines (1-based, inclusive)", () => {
    expect(items[0]).toMatchObject({ sourceLineStart: 5, sourceLineEnd: 7 });
    expect(items[0]!.sourceText).toBe("*HP PROBOOK 440 G11*\nA38B9ET#BH5 | U5-125U | 16GB | 512GB SSD | 14” | DOS\n💰 AED 2,750");
    expect(items[1]).toMatchObject({ sourceLineStart: 9, sourceLineEnd: 11 });
  });
  it("leaves quantity, VAT and stock unknown when they are not written", () => {
    for (const item of items) expect(item).toMatchObject({ quantity: null, vatState: "UNKNOWN", stockStatus: "UNKNOWN" });
  });
  it("records why it decided what it did", () => {
    expect(items[0]!.extractedData.parser).toBeTruthy();
    expect(items[0]!.extractedData.reasons.length).toBeGreaterThan(0);
  });
});

describe("rulesParser: one line per product with @price", () => {
  const items = parse(['LAP LENOVO E14 G7 U7-256V 16GB 512GB SSD 14" DOS 1YR @2200 AED', "", 'MONITOR LED LENOVO C24-40 23.8" FHD 3YR @450 AED'].join("\n"));

  it("reads price, currency and brand from each line", () => {
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ brandText: "Lenovo", modelText: "E14 G7", priceAmount: "2200", currencyCode: "AED", sourceLineStart: 1, sourceLineEnd: 1 });
    expect(items[1]).toMatchObject({ brandText: "Lenovo", modelText: "C24-40", priceAmount: "450", currencyCode: "AED", sourceLineStart: 3 });
  });
  it("resolves the category from the master list", () => {
    expect(items[0]!.categoryText).toBe("Laptop");
    expect(items[1]!.categoryText).toBe("Monitor");
  });
  it("reads warranty in years as months", () => {
    expect(items[0]!.warrantyMonths).toBe(12);
    expect(items[1]!.warrantyMonths).toBe(36);
  });
  it("does not invent a warranty type that is not written", () => {
    expect(items[0]!.warrantyType).toBeNull();
  });
});

describe("rulesParser: what stays unknown", () => {
  it("a product line with no price has no price and no currency, and lower confidence", () => {
    const [item] = parse('LAP HP PROBOOK 440 G11 U5-125U 16GB 512GB SSD 14" DOS ENG 1YR');
    expect(item).toMatchObject({ priceAmount: null, currencyCode: null, confidence: "LOW", quantity: null });
  });
  it("an unknown brand is not guessed", () => {
    const [item] = parse('LAP ACMEBOOK X1 16GB 512GB SSD 14" @1500 AED');
    expect(item?.brandText ?? null).toBeNull();
  });
  it("empty and whitespace-only text give no items", () => {
    expect(parse("")).toEqual([]);
    expect(parse("  \n\n \t\n")).toEqual([]);
  });
  it("is deterministic: the same text gives the same items", () => {
    expect(parse(priceListBlocks)).toEqual(parse(priceListBlocks));
  });
});
