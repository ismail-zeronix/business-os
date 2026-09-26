import { beforeEach, describe, expect, it } from "vitest";
import type { ServiceContext } from "@/core/database/tx";
import { ConflictError, InvariantError, NotFoundError, ValidationError } from "@/core/errors";
import { createTestContext, resetDatabase, testDb } from "@/test/helpers";
import {
  addLine,
  addLineFromConfirmation,
  createManualQuotation,
  createQuotation,
  issueQuotation,
  removeLine,
  reviseQuotation,
  updateLine,
  updateQuotationDetails,
} from "./service";
import { lineAddSchema, lineFromConfirmationSchema, lineUpdateSchema, manualQuotationSchema, quotationDetailsSchema } from "./schemas";

let ctx: ServiceContext;

beforeEach(async () => {
  await resetDatabase();
  ctx = await createTestContext();
});

const FUTURE = "2099-12-31";

const manual = async (customerName: string | null = "TEST Customer") => (await createManualQuotation(ctx, manualQuotationSchema.parse({ customerName: customerName ?? "", contactName: "" }))).id;
const details = (id: string, over: Record<string, unknown> = {}) =>
  updateQuotationDetails(ctx, quotationDetailsSchema.parse({ id, customerName: "TEST Customer", currencyCode: "AED", vatPercent: "5", validUntil: FUTURE, ...over }));
const typedLine = (quotationId: string, over: Record<string, unknown> = {}) =>
  addLine(ctx, lineAddSchema.parse({ quotationId, description: "TEST delivery", quantity: "1", unitPrice: "50", ...over }));
const updateLineInput = (id: string, over: Record<string, unknown> = {}) =>
  lineUpdateSchema.parse({ id, description: "TEST line", partNumber: "", quantity: "2", basis: "PRICE", markupPercent: "", unitPrice: "100", ...over });

async function supplier(name = "TEST Supplier A") {
  return testDb.supplier.create({ data: { name, normalizedName: name.toLowerCase() } });
}

/** A line whose cost is a real supplier price observation, made the way a person does it: a direct confirmation. */
async function costedLine(quotationId: string, over: Record<string, unknown> = {}) {
  const s = await supplier();
  const input = lineFromConfirmationSchema.parse({
    quotationId,
    supplierId: s.id,
    channel: "PHONE",
    confirmedAt: "2026-09-25T10:00",
    note: "TEST confirmed by phone",
    name: "TEST Laptop 14",
    partNumber: `TEST-PN-${Math.random().toString(36).slice(2, 8)}`,
    priceAmount: "1000",
    currencyCode: "AED",
    quantity: "2",
    ...over,
  });
  return addLineFromConfirmation(ctx, { ...input, confirmedAtDate: new Date("2026-09-25T06:00:00Z") });
}

const audits = (quotationId: string) => testDb.auditLog.findMany({ where: { scopeType: "Quotation", scopeId: quotationId }, orderBy: { createdAt: "asc" } });

describe("createManualQuotation", () => {
  it("makes a draft with a dated reference, no enquiry, and one audit row", async () => {
    const id = await manual();
    const q = await testDb.quotation.findUniqueOrThrow({ where: { id } });
    expect(q).toMatchObject({ status: "DRAFT", revision: 1, enquiryId: null, customerName: "TEST Customer", currencyCode: "AED", createdById: ctx.actor.id });
    expect(Number(q.vatPercent)).toBe(5);
    expect((await audits(id)).map((a) => a.action)).toEqual(["quotation.created"]);
  });

  it("counts the day's references up from 1", async () => {
    const a = await testDb.quotation.findUniqueOrThrow({ where: { id: await manual() } });
    const b = await testDb.quotation.findUniqueOrThrow({ where: { id: await manual("TEST Other") } });
    expect(b.quoteDate.getTime()).toBe(a.quoteDate.getTime());
    expect([a.quoteSeq, b.quoteSeq]).toEqual([1, 2]);
  });

  it("copies a saved customer's name and refuses an archived or unknown one", async () => {
    const customer = await testDb.customer.create({ data: { name: "TEST Saved Customer", normalizedName: "test saved customer" } });
    const { id } = await createManualQuotation(ctx, manualQuotationSchema.parse({ customerId: customer.id }));
    expect(await testDb.quotation.findUniqueOrThrow({ where: { id } })).toMatchObject({ customerId: customer.id, customerName: "TEST Saved Customer" });

    await testDb.customer.update({ where: { id: customer.id }, data: { status: "ARCHIVED" } });
    await expect(createManualQuotation(ctx, manualQuotationSchema.parse({ customerId: customer.id }))).rejects.toBeInstanceOf(ValidationError);
    await expect(createManualQuotation(ctx, manualQuotationSchema.parse({ customerId: "01a0db65-5ba7-75e3-a993-a458968ec3b7" }))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("needs a customer or a name (schema)", () => {
    expect(manualQuotationSchema.safeParse({ customerName: "", contactName: "" }).success).toBe(false);
  });
});

describe("addLine, updateLine, removeLine", () => {
  it("adds typed lines in order and audits each", async () => {
    const id = await manual();
    await typedLine(id, { description: "TEST one" });
    await typedLine(id, { description: "TEST two" });
    const lines = await testDb.quotationLine.findMany({ where: { quotationId: id }, orderBy: { position: "asc" } });
    expect(lines.map((l) => [l.position, l.description])).toEqual([[1, "TEST one"], [2, "TEST two"]]);
    expect((await audits(id)).filter((a) => a.action === "quotation.line_added")).toHaveLength(2);
  });

  it("keeps positions unique after a removal", async () => {
    const id = await manual();
    const first = await typedLine(id);
    await typedLine(id, { description: "TEST second" });
    await removeLine(ctx, { id: first.id });
    await typedLine(id, { description: "TEST third" });
    const positions = (await testDb.quotationLine.findMany({ where: { quotationId: id }, orderBy: { position: "asc" } })).map((l) => l.position);
    expect(positions).toEqual([2, 3]);
  });

  it("a line with no cost accepts a price, and refuses a markup", async () => {
    const id = await manual();
    const line = await typedLine(id);
    await updateLine(ctx, updateLineInput(line.id, { basis: "PRICE", unitPrice: "75" }));
    expect(await testDb.quotationLine.findUniqueOrThrow({ where: { id: line.id } })).toMatchObject({ markupPercent: null });
    await expect(updateLine(ctx, updateLineInput(line.id, { basis: "MARKUP", markupPercent: "10", unitPrice: "" }))).rejects.toMatchObject({ fieldErrors: { markupPercent: expect.any(String) } });
  });

  it("markup and price follow each other from the recorded cost", async () => {
    const id = await manual();
    const { id: lineId } = await costedLine(id);
    await updateLine(ctx, updateLineInput(lineId, { basis: "MARKUP", markupPercent: "20", unitPrice: "" }));
    let line = await testDb.quotationLine.findUniqueOrThrow({ where: { id: lineId } });
    expect([line.unitPrice?.toString(), line.markupPercent?.toString()]).toEqual(["1200", "20"]);

    await updateLine(ctx, updateLineInput(lineId, { basis: "PRICE", unitPrice: "1500", markupPercent: "" }));
    line = await testDb.quotationLine.findUniqueOrThrow({ where: { id: lineId } });
    expect([line.unitPrice?.toString(), line.markupPercent?.toString()]).toEqual(["1500", "50"]);
  });

  it("changing nothing writes no audit row", async () => {
    const id = await manual();
    const line = await typedLine(id, { description: "TEST same", quantity: "2", unitPrice: "100" });
    const before = (await audits(id)).length;
    await updateLine(ctx, updateLineInput(line.id, { description: "TEST same", quantity: "2", unitPrice: "100" }));
    expect(await audits(id)).toHaveLength(before);
  });

  it("refuses to change a line of an issued quotation", async () => {
    const id = await manual();
    const line = await typedLine(id);
    await details(id);
    await issueQuotation(ctx, { id });
    await expect(updateLine(ctx, updateLineInput(line.id))).rejects.toBeInstanceOf(InvariantError);
    await expect(removeLine(ctx, { id: line.id })).rejects.toBeInstanceOf(InvariantError);
    await expect(typedLine(id)).rejects.toBeInstanceOf(InvariantError);
  });
});

describe("addLineFromConfirmation", () => {
  it("records the evidence, a temporary product, the price observation, and costs the line from it", async () => {
    const id = await manual();
    const { id: lineId } = await costedLine(id, { markupPercent: "10" });
    const line = await testDb.quotationLine.findUniqueOrThrow({ where: { id: lineId }, include: { costObservation: { include: { evidenceSource: true, product: true } } } });
    expect(line.unitPrice?.toString()).toBe("1100");
    expect(line.costObservation).toMatchObject({ currencyCode: "AED", retractedAt: null });
    expect(line.costObservation?.amount.toString()).toBe("1000");
    expect(line.costObservation?.evidenceSource).toMatchObject({ kind: "SUPPLIER_CONFIRMATION", channel: "PHONE" });
    expect(line.costObservation?.evidenceSource.rawText).toContain("TEST confirmed by phone");
    expect(line.costObservation?.product.isTemporary).toBe(true);
  });

  it("writes nothing when the markup cannot be used (cost in another currency)", async () => {
    const id = await manual();
    await expect(costedLine(id, { currencyCode: "USD", markupPercent: "10" })).rejects.toBeInstanceOf(ValidationError);
    expect(await testDb.evidenceSource.count()).toBe(0);
    expect(await testDb.priceObservation.count()).toBe(0);
    expect(await testDb.quotationLine.count()).toBe(0);
  });

  it("takes a cost in another currency but leaves the price to be typed", async () => {
    const id = await manual();
    const { id: lineId } = await costedLine(id, { currencyCode: "USD" });
    expect(await testDb.quotationLine.findUniqueOrThrow({ where: { id: lineId } })).toMatchObject({ unitPrice: null, markupPercent: null });
  });

  it("refuses a second product with the same part number", async () => {
    const id = await manual();
    await costedLine(id, { partNumber: "TEST-PN-DUP" });
    await expect(costedLine(id, { partNumber: "TEST-PN-DUP" })).rejects.toThrow();
  });

  it("changing the currency drops the markup of a cost that is no longer comparable", async () => {
    const id = await manual();
    const { id: lineId } = await costedLine(id, { markupPercent: "10" });
    await details(id, { currencyCode: "USD" });
    const line = await testDb.quotationLine.findUniqueOrThrow({ where: { id: lineId } });
    expect(line.markupPercent).toBeNull();
    expect(line.unitPrice?.toString()).toBe("1100");
  });
});

describe("updateQuotationDetails", () => {
  it("saves the header and audits only what changed", async () => {
    const id = await manual();
    await details(id, { paymentTerms: "TEST 50% advance" });
    const q = await testDb.quotation.findUniqueOrThrow({ where: { id } });
    expect(q).toMatchObject({ paymentTerms: "TEST 50% advance", customerName: "TEST Customer" });
    const updated = (await audits(id)).filter((a) => a.action === "quotation.updated");
    expect(updated).toHaveLength(1);
    expect(JSON.stringify(updated[0]!.details)).toContain("paymentTerms");
    expect(JSON.stringify(updated[0]!.details)).not.toContain("notes");
  });

  it("refuses a valid-until date in the past, and a VAT over 100 (schema)", async () => {
    const id = await manual();
    await expect(details(id, { validUntil: "2020-01-01" })).rejects.toMatchObject({ fieldErrors: { validUntil: expect.any(String) } });
    expect(quotationDetailsSchema.safeParse({ id, currencyCode: "AED", vatPercent: "101" }).success).toBe(false);
    expect(quotationDetailsSchema.safeParse({ id, currencyCode: "AED", vatPercent: "0" }).success).toBe(true);
  });

  it("an unknown quotation is not found", async () => {
    await expect(details("01a0db65-5ba7-75e3-a993-a458968ec3b7")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("issueQuotation", () => {
  it("lists everything still missing rather than stopping at the first problem", async () => {
    const id = await manual();
    await typedLine(id, { unitPrice: "" });
    const error = await issueQuotation(ctx, { id }).catch((e) => e);
    expect(error).toBeInstanceOf(InvariantError);
    expect(error.message).toMatch(/valid-until date is missing/);
    expect(error.message).toMatch(/line 1 needs a price/);
    expect(await testDb.quotation.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "DRAFT" });
  });

  it("refuses an empty quotation and a blank customer name", async () => {
    const id = await manual();
    await details(id);
    await expect(issueQuotation(ctx, { id })).rejects.toThrow(/there are no lines/);
    await typedLine(id);
    await testDb.quotation.update({ where: { id }, data: { customerName: null } });
    await expect(issueQuotation(ctx, { id })).rejects.toThrow(/customer name is missing/);
  });

  it("freezes a complete draft, audits the total, and refuses to issue twice", async () => {
    const id = await manual();
    await details(id);
    await typedLine(id, { quantity: "2", unitPrice: "100" });
    await issueQuotation(ctx, { id });
    expect(await testDb.quotation.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "ISSUED", issuedById: ctx.actor.id });
    const issued = (await audits(id)).find((a) => a.action === "quotation.issued");
    expect(JSON.stringify(issued?.details)).toContain("210");
    await expect(issueQuotation(ctx, { id })).rejects.toBeInstanceOf(InvariantError);
    await expect(details(id, { notes: "late" })).rejects.toBeInstanceOf(InvariantError);
  });
});

describe("reviseQuotation", () => {
  async function issued() {
    const id = await manual();
    await details(id);
    await typedLine(id, { description: "TEST kept line", quantity: "3", unitPrice: "20" });
    await issueQuotation(ctx, { id });
    return id;
  }

  it("makes revision 2 as a draft with the same lines, and supersedes the original untouched", async () => {
    const id = await issued();
    const before = await testDb.quotation.findUniqueOrThrow({ where: { id }, include: { lines: true } });
    const { id: nextId } = await reviseQuotation(ctx, { id });

    const original = await testDb.quotation.findUniqueOrThrow({ where: { id }, include: { lines: true } });
    expect(original.status).toBe("SUPERSEDED");
    expect(original.lines.map((l) => [l.description, l.quantity, l.unitPrice?.toString()])).toEqual(before.lines.map((l) => [l.description, l.quantity, l.unitPrice?.toString()]));

    const next = await testDb.quotation.findUniqueOrThrow({ where: { id: nextId }, include: { lines: true } });
    expect(next).toMatchObject({ status: "DRAFT", revision: 2, number: before.number, quoteSeq: before.quoteSeq, customerName: "TEST Customer" });
    expect(next.lines).toHaveLength(1);
    expect(next.lines[0]).toMatchObject({ description: "TEST kept line", quantity: 3 });
    expect(next.lines[0]!.id).not.toBe(before.lines[0]!.id);
  });

  it("audits on both revisions", async () => {
    const id = await issued();
    const { id: nextId } = await reviseQuotation(ctx, { id });
    expect((await audits(id)).map((a) => a.action)).toContain("quotation.revised");
    expect((await audits(nextId)).map((a) => a.action)).toEqual(["quotation.revised"]);
  });

  it("only an issued quotation can be revised", async () => {
    const draft = await manual();
    await expect(reviseQuotation(ctx, { id: draft })).rejects.toBeInstanceOf(InvariantError);
    const id = await issued();
    await reviseQuotation(ctx, { id });
    await expect(reviseQuotation(ctx, { id })).rejects.toBeInstanceOf(InvariantError); // now superseded
  });

  it("the revision can be edited, issued, and revised again (rev 3)", async () => {
    const id = await issued();
    const { id: rev2 } = await reviseQuotation(ctx, { id });
    const line = await testDb.quotationLine.findFirstOrThrow({ where: { quotationId: rev2 } });
    await updateLine(ctx, updateLineInput(line.id, { description: "TEST kept line", quantity: "3", unitPrice: "25" }));
    await issueQuotation(ctx, { id: rev2 });
    const { id: rev3 } = await reviseQuotation(ctx, { id: rev2 });
    expect(await testDb.quotation.findUniqueOrThrow({ where: { id: rev3 } })).toMatchObject({ revision: 3, status: "DRAFT" });
    expect((await testDb.quotation.findMany({ where: { number: (await testDb.quotation.findUniqueOrThrow({ where: { id } })).number } })).map((q) => q.status).sort()).toEqual(["DRAFT", "SUPERSEDED", "SUPERSEDED"]);
  });
});

describe("createQuotation (from an enquiry)", () => {
  async function enquiry(confirmedItems: number, over: Record<string, unknown> = {}) {
    const evidence = await testDb.evidenceSource.create({
      data: { kind: "CUSTOMER_ENQUIRY", channel: "MANUAL_PASTE", rawText: "TEST enquiry text", contentHash: `h-${Math.random()}`, observedAt: new Date(), createdById: ctx.actor.id },
    });
    return testDb.enquiry.create({
      data: {
        evidenceSourceId: evidence.id,
        requesterName: "TEST Requester",
        createdById: ctx.actor.id,
        ...over,
        items: {
          create: Array.from({ length: confirmedItems }, (_, i) => ({
            position: i + 1,
            sourceText: `TEST line ${i + 1}`,
            origin: "MANUAL",
            description: `TEST Laptop ${i + 1}`,
            quantity: i === 0 ? 5 : null,
            reviewStatus: "CONFIRMED" as const,
          })),
        },
      },
    });
  }

  it("makes one line per confirmed requirement, with the quantity as written and nothing invented", async () => {
    const e = await enquiry(2);
    await testDb.enquiryItem.create({ data: { enquiryId: e.id, position: 3, sourceText: "TEST pending", origin: "MANUAL", reviewStatus: "PENDING" } });
    const { id } = await createQuotation(ctx, { enquiryId: e.id });
    const q = await testDb.quotation.findUniqueOrThrow({ where: { id }, include: { lines: { orderBy: { position: "asc" } } } });
    expect(q).toMatchObject({ status: "DRAFT", customerName: "TEST Requester", enquiryId: e.id });
    expect(q.lines.map((l) => [l.description, l.quantity, l.unitPrice, l.costPriceObservationId])).toEqual([
      ["TEST Laptop 1", 5, null, null],
      ["TEST Laptop 2", null, null, null],
    ]);
  });

  it("refuses when nothing is confirmed, when the enquiry is archived, and when it does not exist", async () => {
    await expect(createQuotation(ctx, { enquiryId: (await enquiry(0)).id })).rejects.toBeInstanceOf(InvariantError);
    await expect(createQuotation(ctx, { enquiryId: (await enquiry(1, { archivedAt: new Date() })).id })).rejects.toBeInstanceOf(Error);
    await expect(createQuotation(ctx, { enquiryId: "01a0db65-5ba7-75e3-a993-a458968ec3b7" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("allows one draft per enquiry, and a revision is refused while another draft exists", async () => {
    const e = await enquiry(1);
    const { id } = await createQuotation(ctx, { enquiryId: e.id });
    await expect(createQuotation(ctx, { enquiryId: e.id })).rejects.toBeInstanceOf(ConflictError);

    await details(id);
    await testDb.quotationLine.updateMany({ where: { quotationId: id }, data: { quantity: 1, unitPrice: "10" } });
    await issueQuotation(ctx, { id });
    const again = await createQuotation(ctx, { enquiryId: e.id }); // a new quotation is allowed once the draft is issued
    await expect(reviseQuotation(ctx, { id })).rejects.toBeInstanceOf(ConflictError);
    expect(again.id).not.toBe(id);
  });

  it("an archived enquiry blocks every change to its quotation", async () => {
    const e = await enquiry(1);
    const { id } = await createQuotation(ctx, { enquiryId: e.id });
    await testDb.enquiry.update({ where: { id: e.id }, data: { archivedAt: new Date() } });
    await expect(details(id)).rejects.toThrow();
    await expect(typedLine(id)).rejects.toThrow();
    await expect(issueQuotation(ctx, { id })).rejects.toThrow();
  });
});
