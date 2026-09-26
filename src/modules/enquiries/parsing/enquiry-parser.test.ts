import { describe, expect, it } from "vitest";
import { enquiryRulesParser } from "./enquiry-parser";

/**
 * Fixtures are the shapes of real customer requirement text (a spec sheet with "Qty", a one-line request with a part number, and a short
 * email), with no customer name or contact. The expectations are the business rules: brand and family are recognised only from the master
 * lists, the header proposes only what the text says, and everything else stays null.
 */
const context = { brands: ["HP", "Lenovo", "Dell"], families: ["Latitude", "ProBook", "ThinkPad"] };
const parse = (text: string, extra: { skipLeadingLines?: number } = {}) => enquiryRulesParser.parse(text, { ...context, ...extra });

describe("enquiryRulesParser: a spec sheet with Qty", () => {
  const { items } = parse(
    "DELL LATITUDE 7450 XCTO – Qty: 1\nIntel Core Ultra 7 165U vPro | 32GB DDR5 5600 Soldered RAM | 1TB M.2 2230 TLC Gen4 SSD | 14” FHD Touch | Windows 11 Pro | 3-Year Warranty",
  );
  it("makes one requirement from the two lines", () => {
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ sourceLineStart: 1, sourceLineEnd: 2, position: 1, confidence: "HIGH" });
  });
  it("reads brand, family, model and the written quantity", () => {
    expect(items[0]).toMatchObject({ brandText: "Dell", familyText: "Latitude", modelText: "7450 XCTO", quantity: 1, partNumber: null });
  });
  it("keeps the spec text", () => {
    expect(items[0]!.specText).toContain("32GB");
    expect(items[0]!.specText).toContain("Windows 11 Pro");
  });
});

describe("enquiryRulesParser: a one-line request with a part number", () => {
  const { items, header } = parse('LAP LENOVO P14s U7-255H 16GB 512GBSSD RTX500 6GB 14.5" W11P ENG/ARA 3YR\t21QT0009GR');
  it("reads the part number and brand, and leaves quantity unknown", () => {
    expect(items[0]).toMatchObject({ brandText: "Lenovo", modelText: "P14s", partNumber: "21QT0009GR", quantity: null });
  });
  it("does not recognise a family that is not in the master list", () => {
    expect(items[0]!.familyText).toBeNull();
  });
  it("proposes nothing for the header", () => {
    expect(header).toMatchObject({ deliveryLocation: null, priority: null, requiredByText: null });
  });
});

describe("enquiryRulesParser: a short email", () => {
  const text = "Hi,\nPlease quote 10 units HP ProBook 440 G11 16GB 512GB SSD. Delivery to Dubai, urgent, needed by Friday.\n\nThanks";
  const { items, header } = parse(text);
  it("finds the requirement with its quantity and the line it came from", () => {
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ brandText: "HP", familyText: "ProBook", modelText: "440 G11", quantity: 10, sourceLineStart: 2, sourceLineEnd: 2 });
  });
  it("proposes delivery, urgency and the wording of the deadline as written", () => {
    expect(header).toMatchObject({ deliveryLocation: "Dubai", priority: "URGENT", requiredByText: "Friday" });
  });
  it("ignores the greeting and the sign-off", () => {
    expect(items.map((i) => i.description).join(" ")).not.toMatch(/Thanks|Hi,/);
  });
});

describe("enquiryRulesParser: nothing to propose", () => {
  it("gives no items and an empty header for empty text", () => {
    expect(parse("")).toMatchObject({ items: [], header: { deliveryLocation: null, priority: null, requiredByText: null } });
    expect(parse("   \n\n").items).toEqual([]);
  });
  it("never sets priority to anything but URGENT or null", () => {
    expect(parse("Please quote 2 x Dell Latitude 7450 when you can").header.priority).toBeNull();
  });
  it("skips leading header lines but keeps the numbering of the full text", () => {
    const { items } = parse("From: someone\nSubject: quote\n\nDELL LATITUDE 7450 XCTO – Qty: 3", { skipLeadingLines: 3 });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ sourceLineStart: 4, quantity: 3 });
  });
  it("is deterministic", () => {
    const text = "Please quote 10 units HP ProBook 440 G11 16GB 512GB SSD";
    expect(parse(text)).toEqual(parse(text));
  });
});
