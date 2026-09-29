import { beforeEach, describe, expect, it } from "vitest";
import type { ServiceContext } from "@/core/database/tx";
import { ConflictError, InvariantError, NotFoundError, ValidationError } from "@/core/errors";
import { createTestContext, resetDatabase, testDb } from "@/test/helpers";
import { createQuotation, refreshLineCost } from "../quotations/service";
import { clearChoice, chooseSupplier } from "./decision.service";
import { decisionChooseSchema, requestAddSchema } from "./schemas";
import { addSupplierRequest, assertRequestAcceptsReply, markRequestReplied, markRequestSent, removeSupplierRequest, reopenRequest, setRequestOutcome } from "./service";

let ctx: ServiceContext;

beforeEach(async () => {
  await resetDatabase();
  ctx = await createTestContext();
});

const NIL = "01a0db65-5ba7-75e3-a993-a458968ec3b7";

async function supplier(name: string, status: "ACTIVE" | "ARCHIVED" = "ACTIVE") {
  return testDb.supplier.create({ data: { name, normalizedName: name.toLowerCase(), status } });
}

async function evidence() {
  return testDb.evidenceSource.create({
    data: { kind: "SUPPLIER_CONFIRMATION", channel: "PHONE", rawText: "TEST confirmation", contentHash: `h-${Math.random()}`, observedAt: new Date(), createdById: ctx.actor.id },
  });
}

/** An enquiry with one confirmed requirement linked to a product. */
async function enquiryWithItem(over: { confirmed?: boolean; archived?: boolean } = {}) {
  const product = await testDb.product.create({ data: { name: "TEST Laptop", normalizedModel: `test-${Math.random()}`, isTemporary: true } });
  const ev = await testDb.evidenceSource.create({
    data: { kind: "CUSTOMER_ENQUIRY", channel: "MANUAL_PASTE", rawText: "TEST enquiry", contentHash: `h-${Math.random()}`, observedAt: new Date(), createdById: ctx.actor.id },
  });
  const enquiry = await testDb.enquiry.create({
    data: {
      evidenceSourceId: ev.id,
      requesterName: "TEST Requester",
      createdById: ctx.actor.id,
      archivedAt: over.archived ? new Date() : null,
      items: { create: [{ position: 1, sourceText: "TEST", origin: "MANUAL", description: "TEST Laptop", quantity: 2, productId: product.id, reviewStatus: over.confirmed === false ? "PENDING" : "CONFIRMED" }] },
    },
    include: { items: true },
  });
  return { enquiry, item: enquiry.items[0]!, product };
}

async function price(productId: string, supplierId: string, amount = "1000", currencyCode = "AED") {
  const ev = await evidence();
  return testDb.priceObservation.create({ data: { productId, supplierId, amount, currencyCode, observedAt: new Date(), evidenceSourceId: ev.id, createdById: ctx.actor.id } });
}

const add = (enquiryId: string, supplierId: string, contactId = "") => addSupplierRequest(ctx, requestAddSchema.parse({ enquiryId, supplierId, contactId }));
const sentAt = () => new Date(Date.now() - 60_000);
const send = (id: string) => markRequestSent(ctx, { id, messageText: "TEST message", channel: "WHATSAPP", sentAt: sentAt() });
const scopeAudits = (enquiryId: string) => testDb.auditLog.findMany({ where: { scopeType: "Enquiry", scopeId: enquiryId }, orderBy: { createdAt: "asc" } });

describe("addSupplierRequest / removeSupplierRequest", () => {
  it("adds a supplier to an enquiry with a confirmed requirement and audits on the enquiry", async () => {
    const { enquiry } = await enquiryWithItem();
    const s = await supplier("TEST Supplier A");
    const request = await add(enquiry.id, s.id);
    expect(request).toMatchObject({ status: "DRAFT", enquiryId: enquiry.id, supplierId: s.id, sentAt: null, messageText: null });
    expect((await scopeAudits(enquiry.id)).map((a) => a.action)).toEqual(["supplier_request.added"]);
  });

  it("refuses without a confirmed requirement, for an archived enquiry, an inactive supplier, or an unknown one", async () => {
    const s = await supplier("TEST Supplier A");
    await expect(add((await enquiryWithItem({ confirmed: false })).enquiry.id, s.id)).rejects.toBeInstanceOf(InvariantError);
    await expect(add((await enquiryWithItem({ archived: true })).enquiry.id, s.id)).rejects.toThrow();
    const { enquiry } = await enquiryWithItem();
    await expect(add(enquiry.id, (await supplier("TEST Old", "ARCHIVED")).id)).rejects.toBeInstanceOf(ValidationError);
    await expect(add(enquiry.id, NIL)).rejects.toBeInstanceOf(NotFoundError);
    await expect(add(NIL, s.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("allows a supplier only once per enquiry", async () => {
    const { enquiry } = await enquiryWithItem();
    const s = await supplier("TEST Supplier A");
    await add(enquiry.id, s.id);
    await expect(add(enquiry.id, s.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses a contact that belongs to another supplier or is archived", async () => {
    const { enquiry } = await enquiryWithItem();
    const a = await supplier("TEST Supplier A");
    const b = await supplier("TEST Supplier B");
    const other = await testDb.supplierContact.create({ data: { supplierId: b.id, name: "TEST Other Contact" } });
    await expect(add(enquiry.id, a.id, other.id)).rejects.toBeInstanceOf(ValidationError);
    const archived = await testDb.supplierContact.create({ data: { supplierId: a.id, name: "TEST Archived", status: "ARCHIVED" } });
    await expect(add(enquiry.id, a.id, archived.id)).rejects.toBeInstanceOf(ValidationError);
    const good = await testDb.supplierContact.create({ data: { supplierId: a.id, name: "TEST Good" } });
    await expect(add(enquiry.id, a.id, good.id)).resolves.toMatchObject({ contactId: good.id });
  });

  it("removes only a request that has not been sent", async () => {
    const { enquiry } = await enquiryWithItem();
    const a = await supplier("TEST Supplier A");
    const b = await supplier("TEST Supplier B");
    const draft = await add(enquiry.id, a.id);
    await removeSupplierRequest(ctx, { id: draft.id });
    expect(await testDb.supplierRequest.count()).toBe(0);

    const sent = await add(enquiry.id, b.id);
    await send(sent.id);
    await expect(removeSupplierRequest(ctx, { id: sent.id })).rejects.toBeInstanceOf(InvariantError);
    expect(await testDb.supplierRequest.count()).toBe(1);
  });
});

describe("request state machine", () => {
  async function draft() {
    const { enquiry, item, product } = await enquiryWithItem();
    const s = await supplier("TEST Supplier A");
    return { enquiry, item, product, s, request: await add(enquiry.id, s.id) };
  }

  it("Draft -> Sent stores the exact text, channel and time, once", async () => {
    const { request } = await draft();
    const when = sentAt();
    const sent = await markRequestSent(ctx, { id: request.id, messageText: "TEST exact text", channel: "EMAIL", sentAt: when });
    expect(sent).toMatchObject({ status: "SENT", messageText: "TEST exact text", channel: "EMAIL", sentById: ctx.actor.id });
    expect(sent.sentAt?.getTime()).toBe(when.getTime());
    await expect(send(request.id)).rejects.toBeInstanceOf(InvariantError);
  });

  it("refuses a send time in the future", async () => {
    const { request } = await draft();
    await expect(markRequestSent(ctx, { id: request.id, messageText: "x", channel: "EMAIL", sentAt: new Date(Date.now() + 3_600_000) })).rejects.toBeInstanceOf(ValidationError);
    expect((await testDb.supplierRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("DRAFT");
  });

  it("No stock / Declined, then Reopen returns to Sent (or Draft if never sent)", async () => {
    const { request } = await draft();
    await setRequestOutcome(ctx, { id: request.id, status: "NO_STOCK", note: "TEST out of stock" });
    expect(await testDb.supplierRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: "NO_STOCK", note: "TEST out of stock" });
    await reopenRequest(ctx, { id: request.id });
    expect((await testDb.supplierRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("DRAFT");

    await send(request.id);
    await setRequestOutcome(ctx, { id: request.id, status: "DECLINED", note: null });
    await reopenRequest(ctx, { id: request.id });
    expect((await testDb.supplierRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("SENT");
  });

  it("only an open request takes an outcome, and only No stock or Declined can be reopened", async () => {
    const { request } = await draft();
    await expect(reopenRequest(ctx, { id: request.id })).rejects.toBeInstanceOf(InvariantError);
    await setRequestOutcome(ctx, { id: request.id, status: "DECLINED", note: null });
    await expect(setRequestOutcome(ctx, { id: request.id, status: "NO_STOCK", note: null })).rejects.toBeInstanceOf(InvariantError);
  });

  it("an archived enquiry blocks every change", async () => {
    const { enquiry, request } = await draft();
    await testDb.enquiry.update({ where: { id: enquiry.id }, data: { archivedAt: new Date() } });
    await expect(send(request.id)).rejects.toThrow();
    await expect(setRequestOutcome(ctx, { id: request.id, status: "DECLINED", note: null })).rejects.toThrow();
    await expect(removeSupplierRequest(ctx, { id: request.id })).rejects.toThrow();
  });

  it("a reply must be for the same supplier, then marks the request Replied (a second reply changes nothing)", async () => {
    const { enquiry, request, s } = await draft();
    const other = await supplier("TEST Supplier B");
    await expect(assertRequestAcceptsReply(ctx, request.id, other.id)).rejects.toBeInstanceOf(ValidationError);
    await expect(assertRequestAcceptsReply(ctx, NIL, s.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(assertRequestAcceptsReply(ctx, request.id, s.id)).resolves.toBeUndefined();

    const before = (await scopeAudits(enquiry.id)).length;
    await markRequestReplied(ctx, request.id, "broadcast-1");
    await markRequestReplied(ctx, request.id, "broadcast-2");
    expect((await testDb.supplierRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("REPLIED");
    expect((await scopeAudits(enquiry.id)).length).toBe(before + 1);
  });

  it("audits each step on the enquiry, in order", async () => {
    const { enquiry, request } = await draft();
    await send(request.id);
    await setRequestOutcome(ctx, { id: request.id, status: "NO_STOCK", note: null });
    expect((await scopeAudits(enquiry.id)).map((a) => a.action)).toEqual(["supplier_request.added", "supplier_request.sent", "supplier_request.status_changed"]);
  });
});

describe("database guards on requests", () => {
  const guardMessage = async (promise: Promise<unknown>) => {
    const error = (await promise.then(() => null, (e) => e)) as { meta?: { driverAdapterError?: { cause?: { originalMessage?: string } } }; message?: string } | null;
    expect(error).not.toBeNull();
    return error?.meta?.driverAdapterError?.cause?.originalMessage ?? error?.message ?? "";
  };

  it("the sent message, time and channel are write-once, and a sent request cannot be deleted", async () => {
    const { enquiry } = await enquiryWithItem();
    const s = await supplier("TEST Supplier A");
    const request = await add(enquiry.id, s.id);
    await send(request.id);
    expect(await guardMessage(testDb.supplierRequest.update({ where: { id: request.id }, data: { messageText: "changed" } }))).toMatch(/write-once/);
    expect(await guardMessage(testDb.supplierRequest.update({ where: { id: request.id }, data: { channel: "EMAIL" } }))).toMatch(/write-once/);
    expect(await guardMessage(testDb.supplierRequest.delete({ where: { id: request.id } }))).toMatch(/cannot be deleted/);
  });

  it("checks that a sent request is complete", async () => {
    const { enquiry } = await enquiryWithItem();
    const s = await supplier("TEST Supplier A");
    const request = await add(enquiry.id, s.id);
    await expect(testDb.supplierRequest.update({ where: { id: request.id }, data: { status: "SENT" } })).rejects.toThrow();
    await expect(testDb.supplierRequest.update({ where: { id: request.id }, data: { messageText: "text only" } })).rejects.toThrow();
    await expect(testDb.supplierRequest.update({ where: { id: request.id }, data: { channel: "EMAIL" } })).rejects.toThrow();
  });

  it("a reply broadcast must come from the supplier the request was sent to", async () => {
    const { enquiry } = await enquiryWithItem();
    const a = await supplier("TEST Supplier A");
    const b = await supplier("TEST Supplier B");
    const request = await add(enquiry.id, a.id);
    const ev = await evidence();
    const broadcast = (supplierId: string) => testDb.broadcast.create({ data: { evidenceSourceId: ev.id, supplierId, supplierRequestId: request.id, createdById: ctx.actor.id } as never });
    expect(await guardMessage(broadcast(b.id))).toMatch(/supplier the request was sent to/);
  });
});

describe("chooseSupplier / clearChoice", () => {
  async function setup() {
    const { enquiry, item, product } = await enquiryWithItem();
    const a = await supplier("TEST Supplier A");
    const b = await supplier("TEST Supplier B");
    await add(enquiry.id, a.id);
    await add(enquiry.id, b.id);
    return { enquiry, item, product, a, b };
  }
  const choose = (over: Record<string, unknown>) => chooseSupplier(ctx, decisionChooseSchema.parse(over));
  const active = (enquiryItemId: string) => testDb.procurementDecision.findMany({ where: { enquiryItemId, retractedAt: null } });

  it("records the choice with the price the buyer saw, and audits on the enquiry", async () => {
    const { enquiry, item, product, a } = await setup();
    const p = await price(product.id, a.id, "1200");
    const { id } = await choose({ enquiryItemId: item.id, supplierId: a.id, priceObservationId: p.id, note: "TEST best price" });
    expect(await testDb.procurementDecision.findUniqueOrThrow({ where: { id } })).toMatchObject({ supplierId: a.id, priceObservationId: p.id, note: "TEST best price", decidedById: ctx.actor.id, retractedAt: null });
    const audit = (await scopeAudits(enquiry.id)).find((x) => x.action === "procurement_decision.chosen");
    expect(JSON.stringify(audit?.details)).toContain("TEST Supplier A");
  });

  it("choosing again retracts the earlier choice, leaving exactly one active", async () => {
    const { enquiry, item, a, b } = await setup();
    const first = await choose({ enquiryItemId: item.id, supplierId: a.id });
    const second = await choose({ enquiryItemId: item.id, supplierId: b.id });
    expect((await active(item.id)).map((d) => d.id)).toEqual([second.id]);
    expect(await testDb.procurementDecision.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ retractedById: ctx.actor.id, retractionReason: "Replaced by a new choice" });
    const chosen = (await scopeAudits(enquiry.id)).filter((x) => x.action === "procurement_decision.chosen");
    expect(JSON.stringify(chosen[1]!.details)).toContain("TEST Supplier A"); // names the supplier it replaced
  });

  it("needs a confirmed requirement and not a No stock / Declined one; a supplier not yet on the enquiry is added and chosen in one step", async () => {
    const { enquiry, item, a } = await setup();
    const outsider = await supplier("TEST Outsider");
    const choice = await choose({ enquiryItemId: item.id, supplierId: outsider.id });
    expect(choice).toBeTruthy();
    expect(await testDb.supplierRequest.findFirstOrThrow({ where: { enquiryId: enquiry.id, supplierId: outsider.id } })).toMatchObject({ status: "DRAFT" });
    await expect(choose({ enquiryItemId: NIL, supplierId: a.id })).rejects.toBeInstanceOf(NotFoundError);

    const pending = await enquiryWithItem({ confirmed: false });
    await expect(choose({ enquiryItemId: pending.item.id, supplierId: a.id })).rejects.toBeInstanceOf(InvariantError);

    const request = await testDb.supplierRequest.findFirstOrThrow({ where: { supplierId: a.id } });
    await setRequestOutcome(ctx, { id: request.id, status: "NO_STOCK", note: null });
    await expect(choose({ enquiryItemId: item.id, supplierId: a.id })).rejects.toBeInstanceOf(InvariantError);
    await reopenRequest(ctx, { id: request.id });
    await expect(choose({ enquiryItemId: item.id, supplierId: a.id })).resolves.toBeTruthy();
  });

  it("refuses another supplier's price, another product's price, and a retracted price", async () => {
    const { item, product, a, b } = await setup();
    const others = await testDb.product.create({ data: { name: "TEST Other Product", normalizedModel: `other-${Math.random()}`, isTemporary: true } });
    await expect(choose({ enquiryItemId: item.id, supplierId: a.id, priceObservationId: (await price(product.id, b.id)).id })).rejects.toMatchObject({ fieldErrors: { priceObservationId: "Not current" } });
    await expect(choose({ enquiryItemId: item.id, supplierId: a.id, priceObservationId: (await price(others.id, a.id)).id })).rejects.toBeInstanceOf(ValidationError);
    const retracted = await price(product.id, a.id);
    await testDb.priceObservation.update({ where: { id: retracted.id }, data: { retractedAt: new Date(), retractedById: ctx.actor.id, retractionReason: "TEST" } });
    await expect(choose({ enquiryItemId: item.id, supplierId: a.id, priceObservationId: retracted.id })).rejects.toBeInstanceOf(ValidationError);
    expect(await active(item.id)).toHaveLength(0);
  });

  it("clearing retracts the choice (never deletes it), once", async () => {
    const { item, a } = await setup();
    const { id } = await choose({ enquiryItemId: item.id, supplierId: a.id });
    await clearChoice(ctx, { id, reason: "TEST changed mind" });
    expect(await testDb.procurementDecision.findUniqueOrThrow({ where: { id } })).toMatchObject({ retractionReason: "TEST changed mind", retractedById: ctx.actor.id });
    await expect(clearChoice(ctx, { id, reason: null })).rejects.toBeInstanceOf(InvariantError);
    await expect(clearChoice(ctx, { id: NIL, reason: null })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("an archived enquiry blocks choosing and clearing", async () => {
    const { enquiry, item, a } = await setup();
    const { id } = await choose({ enquiryItemId: item.id, supplierId: a.id });
    await testDb.enquiry.update({ where: { id: enquiry.id }, data: { archivedAt: new Date() } });
    await expect(choose({ enquiryItemId: item.id, supplierId: a.id })).rejects.toThrow();
    await expect(clearChoice(ctx, { id, reason: null })).rejects.toThrow();
  });

  it("the database refuses to delete or edit a decision, or a choice of a supplier not on the enquiry", async () => {
    const { item, a } = await setup();
    const { id } = await choose({ enquiryItemId: item.id, supplierId: a.id });
    await expect(testDb.procurementDecision.delete({ where: { id } })).rejects.toThrow();
    await expect(testDb.procurementDecision.update({ where: { id }, data: { note: "edited" } })).rejects.toThrow();
    const outsider = await supplier("TEST Outsider");
    await expect(testDb.procurementDecision.create({ data: { enquiryItemId: item.id, supplierId: outsider.id, decidedById: ctx.actor.id } })).rejects.toThrow();
    await expect(testDb.procurementDecision.create({ data: { enquiryItemId: item.id, supplierId: a.id, decidedById: ctx.actor.id } })).rejects.toThrow(); // a second active one
  });
});

describe("a quotation costs from the chosen supplier", () => {
  it("takes the chosen price as the line's cost, and refresh follows a new choice (markup keeps, price follows)", async () => {
    const { enquiry, item, product } = await enquiryWithItem();
    const a = await supplier("TEST Supplier A");
    const b = await supplier("TEST Supplier B");
    await add(enquiry.id, a.id);
    await add(enquiry.id, b.id);
    const pa = await price(product.id, a.id, "1000");
    const pb = await price(product.id, b.id, "900");
    await chooseSupplier(ctx, decisionChooseSchema.parse({ enquiryItemId: item.id, supplierId: a.id, priceObservationId: pa.id }));

    const { id } = await createQuotation(ctx, { enquiryId: enquiry.id });
    const line = await testDb.quotationLine.findFirstOrThrow({ where: { quotationId: id } });
    expect(line.costPriceObservationId).toBe(pa.id);

    await testDb.quotationLine.update({ where: { id: line.id }, data: { markupPercent: "10", unitPrice: "1100" } });
    await chooseSupplier(ctx, decisionChooseSchema.parse({ enquiryItemId: item.id, supplierId: b.id, priceObservationId: pb.id }));
    // The pointer does not move by itself: cost is refreshed on request.
    expect((await testDb.quotationLine.findUniqueOrThrow({ where: { id: line.id } })).costPriceObservationId).toBe(pa.id);

    await refreshLineCost(ctx, { id: line.id });
    const refreshed = await testDb.quotationLine.findUniqueOrThrow({ where: { id: line.id } });
    expect(refreshed.costPriceObservationId).toBe(pb.id);
    expect([refreshed.unitPrice?.toString(), refreshed.markupPercent?.toString()]).toEqual(["990", "10"]);
  });

  it("refresh clears the cost when the choice is cleared, keeping the typed price and dropping the markup", async () => {
    const { enquiry, item, product } = await enquiryWithItem();
    const a = await supplier("TEST Supplier A");
    await add(enquiry.id, a.id);
    const pa = await price(product.id, a.id, "1000");
    const choice = await chooseSupplier(ctx, decisionChooseSchema.parse({ enquiryItemId: item.id, supplierId: a.id, priceObservationId: pa.id }));
    const { id } = await createQuotation(ctx, { enquiryId: enquiry.id });
    const line = await testDb.quotationLine.findFirstOrThrow({ where: { quotationId: id } });
    await testDb.quotationLine.update({ where: { id: line.id }, data: { markupPercent: "10", unitPrice: "1100" } });

    await clearChoice(ctx, { id: choice.id, reason: null });
    await refreshLineCost(ctx, { id: line.id });
    expect(await testDb.quotationLine.findUniqueOrThrow({ where: { id: line.id } })).toMatchObject({ costPriceObservationId: null, markupPercent: null });
  });

  it("a cost in another currency keeps the typed price and has no markup", async () => {
    const { enquiry, item, product } = await enquiryWithItem();
    const a = await supplier("TEST Supplier A");
    await add(enquiry.id, a.id);
    const usd = await price(product.id, a.id, "300", "USD");
    await chooseSupplier(ctx, decisionChooseSchema.parse({ enquiryItemId: item.id, supplierId: a.id, priceObservationId: usd.id }));
    const { id } = await createQuotation(ctx, { enquiryId: enquiry.id });
    const line = await testDb.quotationLine.findFirstOrThrow({ where: { quotationId: id } });
    await testDb.quotationLine.update({ where: { id: line.id }, data: { unitPrice: "1100" } });
    await refreshLineCost(ctx, { id: line.id });
    expect(await testDb.quotationLine.findUniqueOrThrow({ where: { id: line.id } })).toMatchObject({ costPriceObservationId: usd.id, markupPercent: null });
  });

  it("a hand-typed line has no requirement to refresh from", async () => {
    const { enquiry } = await enquiryWithItem();
    const { id } = await createQuotation(ctx, { enquiryId: enquiry.id });
    const typed = await testDb.quotationLine.create({ data: { quotationId: id, position: 9, description: "TEST delivery" } });
    await expect(refreshLineCost(ctx, { id: typed.id })).rejects.toBeInstanceOf(InvariantError);
  });
});
