import { describe, expect, it } from "vitest";
import { buildQuotationEmailBody, composeEmailText, defaultSignature, quotationEmailSubject } from "./email";

const base = {
  reference: "QUO-20260926-0001",
  contactName: "Aisha",
  currency: "AED",
  vatPercent: 5,
  total: "8507.10",
  validUntil: null,
  paymentTerms: null,
  deliveryTerms: null,
  notes: null,
};

describe("buildQuotationEmailBody", () => {
  it("greets the contact by name and names the reference and total", () => {
    const body = buildQuotationEmailBody(base);
    expect(body.startsWith("Dear Aisha,")).toBe(true);
    expect(body).toContain("QUO-20260926-0001");
    expect(body).toContain("8,507.10");
  });
  it('greets "Sir or Madam" when there is no attention name, or only spaces', () => {
    expect(buildQuotationEmailBody({ ...base, contactName: null })).toMatch(/^Dear Sir or Madam,/);
    expect(buildQuotationEmailBody({ ...base, contactName: "   " })).toMatch(/^Dear Sir or Madam,/);
  });
  it("always states the currency and VAT, and includes the standard line", () => {
    const body = buildQuotationEmailBody({ ...base, vatPercent: 0 });
    expect(body).toContain("All prices are in AED and exclude VAT; 0% VAT is added in the total.");
    expect(body).toContain("subject to confirmation");
  });
  it("shows payment, delivery and validity only when the quotation has them", () => {
    const bare = buildQuotationEmailBody(base);
    expect(bare).not.toContain("Payment terms");
    expect(bare).not.toContain("Delivery:");
    expect(bare).not.toContain("valid until");
    const full = buildQuotationEmailBody({ ...base, paymentTerms: "50% advance", deliveryTerms: "3 days", validUntil: new Date("2026-10-15T00:00:00Z") });
    expect(full).toContain("Payment terms: 50% advance");
    expect(full).toContain("Delivery: 3 days");
    expect(full).toContain("This quotation is valid until");
  });
  it("adds a trimmed note only when there is one", () => {
    expect(buildQuotationEmailBody(base)).not.toContain("Note:");
    expect(buildQuotationEmailBody({ ...base, notes: "  Stock is limited  " })).toContain("\nNote: Stock is limited\n");
  });
  it("never mentions a supplier, cost or margin", () => {
    expect(buildQuotationEmailBody({ ...base, notes: "x", paymentTerms: "y", deliveryTerms: "z" })).not.toMatch(/supplier|cost|margin|markup/i);
  });
});

describe("quotationEmailSubject", () => {
  it("names the reference and the company", () => {
    expect(quotationEmailSubject("QUO-1 rev 2")).toBe("Quotation QUO-1 rev 2 from Zeronix Technology LLC");
  });
});

describe("defaultSignature and composeEmailText", () => {
  it("starts from the person's name and the company", () => {
    const signature = defaultSignature("Ismail");
    expect(signature.split("\n").slice(0, 3)).toEqual(["Best regards,", "Ismail", "Zeronix Technology LLC"]);
  });
  it("puts the signature a blank line after the message", () => {
    expect(composeEmailText("Hello\n\n", "Regards\nMe")).toBe("Hello\n\nRegards\nMe");
  });
  it("leaves the signature out when it is empty", () => {
    expect(composeEmailText("Hello  \n", null)).toBe("Hello");
    expect(composeEmailText("Hello", "   ")).toBe("Hello");
  });
});
