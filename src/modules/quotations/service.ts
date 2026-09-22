import { ConflictError, InvariantError, NotFoundError, uniqueViolation, ValidationError } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { diffFields, hasChanges } from "../../lib/diff";
import { formatMoney } from "../../lib/format";
import { writeAudit } from "../audit/service";
import { recordDirectConfirmation } from "../broadcasts/confirmation.service";
import { enquiryReference, requireNotArchived, touchEnquiry } from "../enquiries/shared";
import { lineTitle } from "../sourcing/message";
import { computeTotals, markupFromPrice, priceFromMarkup, resolveLinePricing } from "./pricing";
import type { LineAddInput, LineFromConfirmationInput, LineIdInput, LineUpdateInput, ManualQuotationInput, QuotationCreateInput, QuotationDetailsInput, QuotationIdInput } from "./schemas";
import { dateOnly, parseDateOnly, nextQuotationReference, quotationLabel, quotationReference, quotationScope, requireDraft, requireEnquiryOpen, todayInBusinessZone, touchEnquiryIfAny } from "./shared";

/**
 * Quotation rules. A draft is editable; Issue freezes it (the database refuses later changes) and Revise makes a new draft revision.
 * The cost of a line is never typed: it is a pointer to a supplier's price observation, so it cannot drift. What the customer reads
 * (names, descriptions, quantities, prices) is copied onto the quotation. Nothing here sends anything or changes the enquiry status.
 * Every change is audited in the same transaction, scoped to the quotation.
 */

const decimalText = (value: { toString(): string } | null): string | null => (value === null ? null : value.toString());

type Lines = { id: string; quantity: number | null; unitPrice: { toString(): string } | null }[];

const totalsOf = (lines: Lines, vatPercent: { toString(): string }) => computeTotals(lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice })), vatPercent);

/** A requirement's wording as a customer-facing description: its title, plus its spec text when the title does not already carry it. */
function describeRequirement(item: { description: string | null; brandText: string | null; modelText: string | null; partNumber: string | null; specText: string | null; quantity: number | null }): string {
  const title = lineTitle(item);
  const spec = item.specText?.trim();
  return spec && !title.toLowerCase().includes(spec.toLowerCase()) ? `${title} - ${spec}` : title;
}

export async function createQuotation(ctx: ServiceContext, input: QuotationCreateInput) {
  try {
    return await inTransaction(ctx, async (c) => {
      const enquiry = await c.db.enquiry.findUnique({
        where: { id: input.enquiryId },
        select: {
          id: true,
          number: true,
          archivedAt: true,
          customerId: true,
          requesterName: true,
          customer: { select: { name: true } },
          contact: { select: { name: true } },
          items: {
            where: { reviewStatus: "CONFIRMED" },
            orderBy: { position: "asc" },
            select: { id: true, description: true, brandText: true, modelText: true, partNumber: true, specText: true, quantity: true },
          },
        },
      });
      if (!enquiry) throw new NotFoundError("Enquiry");
      requireNotArchived(enquiry);
      if (enquiry.items.length === 0) throw new InvariantError("Confirm at least one requirement before creating a quotation.");

      const draft = await c.db.quotation.findFirst({ where: { enquiryId: enquiry.id, status: "DRAFT" }, select: { quoteDate: true, quoteSeq: true, revision: true } });
      if (draft) throw new ConflictError(`There is already a draft quotation for this enquiry (${quotationLabel(draft)}). Open it instead.`);

      // The cost of a line is the price the buyer chose for that requirement, if a supplier has been chosen and had a price on record.
      const decisions = await c.db.procurementDecision.findMany({
        where: { retractedAt: null, enquiryItemId: { in: enquiry.items.map((i) => i.id) } },
        select: { enquiryItemId: true, priceObservationId: true },
      });
      const costByItem = new Map(decisions.map((d) => [d.enquiryItemId, d.priceObservationId]));

      const reference = await nextQuotationReference(c);
      const quotation = await c.db.quotation.create({
        data: {
          ...reference,
          enquiryId: enquiry.id,
          customerId: enquiry.customerId,
          customerName: enquiry.customer?.name ?? enquiry.requesterName ?? null,
          contactName: enquiry.contact?.name ?? null,
          createdById: ctx.actor.id,
          lines: {
            create: enquiry.items.map((item, index) => ({
              position: index + 1,
              enquiryItemId: item.id,
              description: describeRequirement(item),
              partNumber: item.partNumber,
              quantity: item.quantity !== null && item.quantity > 0 ? item.quantity : null,
              costPriceObservationId: costByItem.get(item.id) ?? null,
            })),
          },
        },
        select: { id: true, quoteDate: true, quoteSeq: true },
      });
      await writeAudit(c, {
        action: "quotation.created",
        entityType: "Quotation",
        entityId: quotation.id,
        scope: quotationScope(quotation.id),
        details: { reference: quotationReference(quotation), enquiry: enquiryReference(enquiry.number), lines: enquiry.items.length, linesWithCost: [...costByItem.values()].filter(Boolean).length },
      });
      await touchEnquiry(c, enquiry.id);
      return { id: quotation.id, enquiryId: enquiry.id };
    });
  } catch (error) {
    if (uniqueViolation(error)) throw new ConflictError("There is already a draft quotation for this enquiry. Open it instead.");
    throw error;
  }
}

/** A quotation made without an enquiry: a saved customer or just a name. Lines are added by hand or from a supplier confirmation. */
export async function createManualQuotation(ctx: ServiceContext, input: ManualQuotationInput) {
  return inTransaction(ctx, async (c) => {
    let customerName = input.customerName;
    if (input.customerId) {
      const customer = await c.db.customer.findUnique({ where: { id: input.customerId }, select: { name: true, status: true } });
      if (!customer) throw new NotFoundError("Customer");
      if (customer.status === "ARCHIVED") throw new ValidationError("That customer is archived.", { customerId: "Archived" });
      customerName = customer.name;
    }
    const reference = await nextQuotationReference(c);
    const quotation = await c.db.quotation.create({
      data: { ...reference, enquiryId: null, customerId: input.customerId, customerName, contactName: input.contactName, createdById: ctx.actor.id },
      select: { id: true, quoteDate: true, quoteSeq: true },
    });
    await writeAudit(c, {
      action: "quotation.created",
      entityType: "Quotation",
      entityId: quotation.id,
      scope: quotationScope(quotation.id),
      details: { reference: quotationReference(quotation), manual: true, customer: customerName },
    });
    return { id: quotation.id, enquiryId: null };
  });
}

/**
 * Adds a line from a supplier who has just confirmed a price (a call, a message). The confirmation is recorded first as ordinary supplier
 * evidence, with the product and the price and stock observations, in the same transaction; the line then costs from that price. If the
 * markup asked for cannot be used (another currency), nothing is recorded.
 */
export async function addLineFromConfirmation(ctx: ServiceContext, input: LineFromConfirmationInput & { confirmedAtDate: Date }) {
  return inTransaction(ctx, async (c) => {
    const quotation = await c.db.quotation.findUnique({
      where: { id: input.quotationId },
      select: { id: true, status: true, currencyCode: true, enquiryId: true, enquiry: { select: { archivedAt: true } }, lines: { select: { position: true } } },
    });
    if (!quotation) throw new NotFoundError("Quotation");
    requireEnquiryOpen(quotation.enquiry);
    requireDraft(quotation);

    // Work out the price first: a markup that cannot be used should fail before anything is recorded.
    const pricing = resolveLinePricing({
      basis: "MARKUP",
      markupPercent: input.markupPercent,
      unitPrice: null,
      costAmount: input.priceAmount,
      costComparable: input.currencyCode === quotation.currencyCode,
    });
    if ("error" in pricing) throw new ValidationError(pricing.error, { [pricing.field]: pricing.error });

    const confirmation = await recordDirectConfirmation(c, input);
    const position = quotation.lines.reduce((max, l) => Math.max(max, l.position), 0) + 1;
    const line = await c.db.quotationLine.create({
      data: {
        quotationId: quotation.id,
        position,
        description: confirmation.productName,
        partNumber: confirmation.partNumber,
        quantity: input.quantity,
        unitPrice: pricing.unitPrice,
        markupPercent: pricing.markupPercent,
        costPriceObservationId: confirmation.priceObservationId,
      },
      select: { id: true },
    });
    await writeAudit(c, {
      action: "quotation.line_added",
      entityType: "Quotation",
      entityId: quotation.id,
      scope: quotationScope(quotation.id),
      details: { line: confirmation.productName, quantity: input.quantity, source: `Direct confirmation from ${confirmation.supplierName}`, cost: formatMoney(confirmation.priceAmount, confirmation.currencyCode), unitPrice: pricing.unitPrice },
    });
    await touchEnquiryIfAny(c, quotation.enquiryId);
    return { id: line.id, quotationId: quotation.id };
  });
}

/** The header of a draft. Changing the currency re-derives each line's markup (a cost in another currency has no markup); prices stay as typed. */
export async function updateQuotationDetails(ctx: ServiceContext, input: QuotationDetailsInput) {
  return inTransaction(ctx, async (c) => {
    const quotation = await c.db.quotation.findUnique({
      where: { id: input.id },
      include: { enquiry: { select: { archivedAt: true } }, lines: { select: { id: true, unitPrice: true, markupPercent: true, costObservation: { select: { amount: true, currencyCode: true } } } } },
    });
    if (!quotation) throw new NotFoundError("Quotation");
    requireEnquiryOpen(quotation.enquiry);
    requireDraft(quotation);

    const validUntil = input.validUntil;
    if (validUntil && validUntil < todayInBusinessZone()) throw new ValidationError("The valid-until date is in the past.", { validUntil: "Choose today or a later date" });

    const before = {
      customerName: quotation.customerName,
      contactName: quotation.contactName,
      currencyCode: quotation.currencyCode,
      vatPercent: Number(quotation.vatPercent.toString()).toString(),
      validUntil: dateOnly(quotation.validUntil),
      paymentTerms: quotation.paymentTerms,
      deliveryTerms: quotation.deliveryTerms,
      notes: quotation.notes,
    };
    const after = {
      customerName: input.customerName,
      contactName: input.contactName,
      currencyCode: input.currencyCode,
      vatPercent: Number(input.vatPercent).toString(),
      validUntil,
      paymentTerms: input.paymentTerms,
      deliveryTerms: input.deliveryTerms,
      notes: input.notes,
    };
    const changes = diffFields(before, after, Object.keys(before) as (keyof typeof before)[]);
    if (!hasChanges(changes)) return { id: quotation.id, enquiryId: quotation.enquiryId };

    await c.db.quotation.update({
      where: { id: quotation.id },
      data: { ...after, validUntil: parseDateOnly(validUntil) },
    });

    if (input.currencyCode !== quotation.currencyCode) {
      for (const line of quotation.lines) {
        const comparable = line.costObservation?.currencyCode === input.currencyCode;
        const markup = comparable && line.costObservation && line.unitPrice ? markupFromPrice(line.costObservation.amount, line.unitPrice) : null;
        if (markup !== decimalText(line.markupPercent)) await c.db.quotationLine.update({ where: { id: line.id }, data: { markupPercent: markup } });
      }
    }

    await writeAudit(c, { action: "quotation.updated", entityType: "Quotation", entityId: quotation.id, scope: quotationScope(quotation.id), details: changes });
    await touchEnquiryIfAny(c, quotation.enquiryId);
    return { id: quotation.id, enquiryId: quotation.enquiryId };
  });
}

/** A line typed by hand (delivery, installation): no requirement, no cost, so its price is typed. */
export async function addLine(ctx: ServiceContext, input: LineAddInput) {
  return inTransaction(ctx, async (c) => {
    const quotation = await c.db.quotation.findUnique({
      where: { id: input.quotationId },
      select: { id: true, status: true, enquiryId: true, enquiry: { select: { archivedAt: true } }, lines: { select: { position: true } } },
    });
    if (!quotation) throw new NotFoundError("Quotation");
    requireEnquiryOpen(quotation.enquiry);
    requireDraft(quotation);

    const position = quotation.lines.reduce((max, l) => Math.max(max, l.position), 0) + 1;
    const line = await c.db.quotationLine.create({
      data: { quotationId: quotation.id, position, description: input.description, quantity: input.quantity, unitPrice: input.unitPrice },
      select: { id: true },
    });
    await writeAudit(c, {
      action: "quotation.line_added",
      entityType: "Quotation",
      entityId: quotation.id,
      scope: quotationScope(quotation.id),
      details: { line: input.description, quantity: input.quantity, unitPrice: input.unitPrice },
    });
    await touchEnquiryIfAny(c, quotation.enquiryId);
    return { id: line.id, quotationId: quotation.id };
  });
}

const lineForEdit = {
  id: true,
  description: true,
  partNumber: true,
  quantity: true,
  unitPrice: true,
  markupPercent: true,
  enquiryItemId: true,
  quotation: { select: { id: true, status: true, enquiryId: true, currencyCode: true, enquiry: { select: { archivedAt: true } } } },
  costObservation: { select: { id: true, amount: true, currencyCode: true, supplier: { select: { name: true } } } },
} as const;

/** Edits one draft line. The person changes markup or price (`basis`); the other is worked out here from the cost. */
export async function updateLine(ctx: ServiceContext, input: LineUpdateInput) {
  return inTransaction(ctx, async (c) => {
    const line = await c.db.quotationLine.findUnique({ where: { id: input.id }, select: lineForEdit });
    if (!line) throw new NotFoundError("Line");
    requireEnquiryOpen(line.quotation.enquiry);
    requireDraft(line.quotation);

    const cost = line.costObservation;
    const pricing = resolveLinePricing({
      basis: input.basis,
      markupPercent: input.markupPercent,
      unitPrice: input.unitPrice,
      costAmount: cost ? cost.amount.toString() : null,
      costComparable: cost?.currencyCode === line.quotation.currencyCode,
    });
    if ("error" in pricing) throw new ValidationError(pricing.error, { [pricing.field]: pricing.error });

    const after = { description: input.description, partNumber: input.partNumber, quantity: input.quantity, unitPrice: pricing.unitPrice, markupPercent: pricing.markupPercent };
    const changes = diffFields(
      { description: line.description, partNumber: line.partNumber, quantity: line.quantity, unitPrice: decimalText(line.unitPrice), markupPercent: decimalText(line.markupPercent) },
      after,
      ["description", "partNumber", "quantity", "unitPrice", "markupPercent"],
    );
    if (!hasChanges(changes)) return { id: line.id, quotationId: line.quotation.id };

    await c.db.quotationLine.update({ where: { id: line.id }, data: after });
    await writeAudit(c, {
      action: "quotation.line_updated",
      entityType: "Quotation",
      entityId: line.quotation.id,
      scope: quotationScope(line.quotation.id),
      details: { line: line.description, ...changes },
    });
    await touchEnquiryIfAny(c, line.quotation.enquiryId);
    return { id: line.id, quotationId: line.quotation.id };
  });
}

/** Removes a line from a draft. A draft is working state, not a record the customer saw, so the row is deleted; the removal is audited. */
export async function removeLine(ctx: ServiceContext, input: LineIdInput) {
  return inTransaction(ctx, async (c) => {
    const line = await c.db.quotationLine.findUnique({ where: { id: input.id }, select: lineForEdit });
    if (!line) throw new NotFoundError("Line");
    requireEnquiryOpen(line.quotation.enquiry);
    requireDraft(line.quotation);

    await c.db.quotationLine.delete({ where: { id: line.id } });
    await writeAudit(c, {
      action: "quotation.line_removed",
      entityType: "Quotation",
      entityId: line.quotation.id,
      scope: quotationScope(line.quotation.id),
      details: { line: line.description, quantity: line.quantity, unitPrice: decimalText(line.unitPrice) },
    });
    await touchEnquiryIfAny(c, line.quotation.enquiryId);
    return { id: line.id, quotationId: line.quotation.id };
  });
}

const costText = (cost: { amount: { toString(): string }; currencyCode: string; supplier: { name: string } } | null): string | null =>
  cost ? `${formatMoney(cost.amount.toString(), cost.currencyCode)} (${cost.supplier.name})` : null;

/**
 * Re-reads the cost from the requirement's active supplier choice. Use it after choosing a different supplier, or after choosing one at all.
 * If the line has a markup and the new cost is in the quotation's currency, the price follows the markup; otherwise the price stays and the
 * markup is re-derived (or cleared when there is no comparable cost).
 */
export async function refreshLineCost(ctx: ServiceContext, input: LineIdInput) {
  return inTransaction(ctx, async (c) => {
    const line = await c.db.quotationLine.findUnique({ where: { id: input.id }, select: lineForEdit });
    if (!line) throw new NotFoundError("Line");
    requireEnquiryOpen(line.quotation.enquiry);
    requireDraft(line.quotation);
    if (!line.enquiryItemId) throw new InvariantError("This line was typed by hand, so it has no requirement to take a cost from.");

    const decision = await c.db.procurementDecision.findFirst({
      where: { enquiryItemId: line.enquiryItemId, retractedAt: null },
      select: { priceObservation: { select: { id: true, amount: true, currencyCode: true, supplier: { select: { name: true } } } } },
    });
    const next = decision?.priceObservation ?? null;
    const currency = line.quotation.currencyCode;
    const comparable = next?.currencyCode === currency;

    let unitPrice = decimalText(line.unitPrice);
    let markup = decimalText(line.markupPercent);
    if (next && comparable && markup !== null) {
      unitPrice = priceFromMarkup(next.amount.toString(), markup) ?? unitPrice;
    } else {
      markup = next && comparable && unitPrice !== null ? markupFromPrice(next.amount.toString(), unitPrice) : null;
    }

    await c.db.quotationLine.update({ where: { id: line.id }, data: { costPriceObservationId: next?.id ?? null, unitPrice, markupPercent: markup } });
    await writeAudit(c, {
      action: "quotation.line_updated",
      entityType: "Quotation",
      entityId: line.quotation.id,
      scope: quotationScope(line.quotation.id),
      details: {
        line: line.description,
        cost: { from: costText(line.costObservation), to: costText(next) },
        ...(unitPrice !== decimalText(line.unitPrice) ? { unitPrice: { from: decimalText(line.unitPrice), to: unitPrice } } : {}),
      },
    });
    await touchEnquiryIfAny(c, line.quotation.enquiryId);
    return { id: line.id, quotationId: line.quotation.id };
  });
}

/** Freezes a complete draft. Lists everything still missing rather than stopping at the first problem. */
export async function issueQuotation(ctx: ServiceContext, input: QuotationIdInput) {
  return inTransaction(ctx, async (c) => {
    const quotation = await c.db.quotation.findUnique({
      where: { id: input.id },
      include: { enquiry: { select: { archivedAt: true } }, lines: { orderBy: { position: "asc" }, select: { id: true, position: true, quantity: true, unitPrice: true } } },
    });
    if (!quotation) throw new NotFoundError("Quotation");
    requireEnquiryOpen(quotation.enquiry);
    requireDraft(quotation);

    const problems: string[] = [];
    if (!quotation.customerName?.trim()) problems.push("the customer name is missing");
    if (!quotation.validUntil) problems.push("the valid-until date is missing");
    else if (dateOnly(quotation.validUntil)! < todayInBusinessZone()) problems.push("the valid-until date is in the past");
    if (quotation.lines.length === 0) problems.push("there are no lines");
    for (const line of quotation.lines) {
      if (line.quantity === null) problems.push(`line ${line.position} needs a quantity`);
      if (line.unitPrice === null) problems.push(`line ${line.position} needs a price`);
    }
    if (problems.length > 0) {
      const shown = problems.slice(0, 6).join("; ");
      throw new InvariantError(`This quotation cannot be issued yet: ${shown}${problems.length > 6 ? `; and ${problems.length - 6} more` : ""}.`);
    }

    const totals = totalsOf(quotation.lines, quotation.vatPercent);
    await c.db.quotation.update({ where: { id: quotation.id }, data: { status: "ISSUED", issuedAt: new Date(), issuedById: ctx.actor.id } });
    await writeAudit(c, {
      action: "quotation.issued",
      entityType: "Quotation",
      entityId: quotation.id,
      scope: quotationScope(quotation.id),
      details: {
        reference: quotationLabel(quotation),
        customer: quotation.customerName,
        lines: quotation.lines.length,
        total: formatMoney(totals.total, quotation.currencyCode),
        validUntil: dateOnly(quotation.validUntil),
      },
    });
    await touchEnquiryIfAny(c, quotation.enquiryId);
    return { id: quotation.id, enquiryId: quotation.enquiryId };
  });
}

/** Turns an issued quotation into a new draft revision (same number, revision + 1) and marks the issued one superseded. It stays as issued. */
export async function reviseQuotation(ctx: ServiceContext, input: QuotationIdInput) {
  try {
    return await inTransaction(ctx, async (c) => {
      const quotation = await c.db.quotation.findUnique({
        where: { id: input.id },
        include: { enquiry: { select: { archivedAt: true } }, lines: { orderBy: { position: "asc" } } },
      });
      if (!quotation) throw new NotFoundError("Quotation");
      requireEnquiryOpen(quotation.enquiry);
      if (quotation.status !== "ISSUED") throw new InvariantError("Only an issued quotation can be revised.");

      // One draft per enquiry. A manual quotation has no enquiry, so it has no such limit.
      const draft = quotation.enquiryId ? await c.db.quotation.findFirst({ where: { enquiryId: quotation.enquiryId, status: "DRAFT" }, select: { quoteDate: true, quoteSeq: true, revision: true } }) : null;
      if (draft) throw new ConflictError(`There is already a draft quotation for this enquiry (${quotationLabel(draft)}). Finish or issue it first.`);

      const revision = quotation.revision + 1;
      await c.db.quotation.update({ where: { id: quotation.id }, data: { status: "SUPERSEDED", supersededAt: new Date() } });
      const next = await c.db.quotation.create({
        data: {
          number: quotation.number,
          quoteDate: quotation.quoteDate,
          quoteSeq: quotation.quoteSeq,
          revision,
          enquiryId: quotation.enquiryId,
          customerId: quotation.customerId,
          customerName: quotation.customerName,
          contactName: quotation.contactName,
          currencyCode: quotation.currencyCode,
          vatPercent: quotation.vatPercent,
          validUntil: quotation.validUntil,
          paymentTerms: quotation.paymentTerms,
          deliveryTerms: quotation.deliveryTerms,
          notes: quotation.notes,
          createdById: ctx.actor.id,
          lines: {
            create: quotation.lines.map((l) => ({
              position: l.position,
              enquiryItemId: l.enquiryItemId,
              description: l.description,
              partNumber: l.partNumber,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              markupPercent: l.markupPercent,
              costPriceObservationId: l.costPriceObservationId,
            })),
          },
        },
        select: { id: true },
      });

      await writeAudit(c, {
        action: "quotation.revised",
        entityType: "Quotation",
        entityId: quotation.id,
        scope: quotationScope(quotation.id),
        details: { supersededBy: quotationLabel({ ...quotation, revision }) },
      });
      await writeAudit(c, {
        action: "quotation.revised",
        entityType: "Quotation",
        entityId: next.id,
        scope: quotationScope(next.id),
        details: { reference: quotationLabel({ ...quotation, revision }), revisionOf: quotationLabel(quotation), lines: quotation.lines.length },
      });
      await touchEnquiryIfAny(c, quotation.enquiryId);
      return { id: next.id, enquiryId: quotation.enquiryId };
    });
  } catch (error) {
    if (uniqueViolation(error)) throw new ConflictError("There is already a draft quotation for this enquiry. Open it instead.");
    throw error;
  }
}
