import { describe, expect, it } from "vitest";
import { buildRequestMessage, composeSentText, describeLine, lineTitle, type RequestLine } from "./message";

const blank: RequestLine = { description: null, brandText: null, modelText: null, partNumber: null, specText: null, quantity: null };
const line = (over: Partial<RequestLine> = {}): RequestLine => ({ ...blank, ...over });

describe("lineTitle", () => {
  it("prefers the description, then brand and model, then the part number", () => {
    expect(lineTitle(line({ description: "  Dell Latitude 5440  ", brandText: "Dell" }))).toBe("Dell Latitude 5440");
    expect(lineTitle(line({ brandText: "Dell", modelText: "5440" }))).toBe("Dell 5440");
    expect(lineTitle(line({ partNumber: "83A100SUAK" }))).toBe("83A100SUAK");
  });
  it("falls back to a neutral word, never an invented product", () => {
    expect(lineTitle(line())).toBe("Item");
  });
});

describe("describeLine", () => {
  it("says the quantity is to be confirmed when unknown", () => {
    expect(describeLine(line({ description: "Dell Latitude 5440" }))).toBe("Dell Latitude 5440 - Qty: to be confirmed");
  });
  it("adds model, part number and spec only when the title does not already carry them", () => {
    expect(describeLine(line({ description: "Dell Latitude 5440", modelText: "5440", partNumber: "83A100", specText: "i7 16GB", quantity: 50 }))).toBe(
      "Dell Latitude 5440 - P/N 83A100 - i7 16GB - Qty: 50",
    );
    expect(describeLine(line({ description: "Dell 5440 83A100 i7 16GB", modelText: "5440", partNumber: "83A100", specText: "i7 16GB", quantity: 1 }))).toBe("Dell 5440 83A100 i7 16GB - Qty: 1");
  });
  it("matches without regard to case, and formats large quantities with separators", () => {
    expect(describeLine(line({ description: "DELL LATITUDE", modelText: "latitude", quantity: 1200 }))).toBe("DELL LATITUDE - Qty: 1,200");
  });
});

describe("buildRequestMessage", () => {
  it("greets the contact by name, or plainly when there is none", () => {
    expect(buildRequestMessage({ contactName: "Sara", lines: [line({ description: "X" })] }).body.startsWith("Hello Sara,")).toBe(true);
    expect(buildRequestMessage({ contactName: "  ", lines: [line({ description: "X" })] }).body.startsWith("Hello,")).toBe(true);
    expect(buildRequestMessage({ contactName: null, lines: [line({ description: "X" })] }).body.startsWith("Hello,")).toBe(true);
  });
  it("numbers the lines and asks for price, VAT, quantity and lead time", () => {
    const { body } = buildRequestMessage({ contactName: null, lines: [line({ description: "First", quantity: 2 }), line({ description: "Second" })] });
    expect(body).toContain("1. First - Qty: 2");
    expect(body).toContain("2. Second - Qty: to be confirmed");
    expect(body).toMatch(/price per unit, and whether VAT is included/);
    expect(body).toMatch(/lead time/);
  });
  it('names the first line in the subject, with "+N more" for the rest', () => {
    expect(buildRequestMessage({ contactName: null, lines: [line({ description: "Only" })] }).subject).toBe("Quotation request: Only");
    expect(buildRequestMessage({ contactName: null, lines: [line({ description: "A" }), line({ description: "B" }), line({ description: "C" })] }).subject).toBe("Quotation request: A +2 more");
    expect(buildRequestMessage({ contactName: null, lines: [] }).subject).toBe("Quotation request");
  });
  it("is deterministic, and its input has no place for a customer's name or details", () => {
    const input = { contactName: "Sara", lines: [line({ description: "X", quantity: 3 })] };
    expect(buildRequestMessage(input)).toEqual(buildRequestMessage(input));
    // A customer name that is not passed in cannot appear; only what the caller supplies is used.
    expect(JSON.stringify(buildRequestMessage(input))).not.toMatch(/customer|ENQ-/i);
  });
});

describe("composeSentText", () => {
  it("puts the subject first, a blank line, then the body", () => {
    expect(composeSentText("  Quote please ", "Body")).toBe("Subject: Quote please\n\nBody");
  });
  it("is just the body when there is no subject", () => {
    expect(composeSentText(null, "Body")).toBe("Body");
    expect(composeSentText("   ", "Body")).toBe("Body");
  });
});
