import { InvariantError, NotFoundError, ValidationError } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { formatMoney } from "../../lib/format";
import { STOCK_STATUS_LABEL, SUPPLIER_REQUEST_STATUS_LABEL } from "../../lib/labels";
import { writeAudit } from "../audit/service";
import { enquiryScope, requireNotArchived, touchEnquiry } from "../enquiries/shared";
import type { DecisionChooseInput, DecisionClearInput } from "./schemas";

/**
 * "We chose this supplier for this requirement." The choice points at the price and stock observations the buyer saw, and observations are
 * immutable, so what was known at that moment can never change. A choice is never edited or deleted: choosing another supplier or
 * clearing it *retracts* the earlier one (one active choice per requirement is enforced by the database). Nothing is ranked or compared
 * for the buyer; the app only records the person's decision. Audited in the same transaction, scoped to the enquiry.
 */

const requirementName = (item: { description: string | null; modelText: string | null; partNumber?: string | null }) => item.description ?? item.modelText ?? item.partNumber ?? "Requirement";

export async function chooseSupplier(ctx: ServiceContext, input: DecisionChooseInput) {
  return inTransaction(ctx, async (c) => {
    const item = await c.db.enquiryItem.findUnique({
      where: { id: input.enquiryItemId },
      select: { id: true, enquiryId: true, productId: true, reviewStatus: true, description: true, modelText: true, partNumber: true, enquiry: { select: { archivedAt: true } } },
    });
    if (!item) throw new NotFoundError("Requirement");
    requireNotArchived(item.enquiry);
    if (item.reviewStatus !== "CONFIRMED") throw new InvariantError("Only a confirmed requirement can have a supplier chosen.");

    const request = await c.db.supplierRequest.findUnique({
      where: { enquiryId_supplierId: { enquiryId: item.enquiryId, supplierId: input.supplierId } },
      select: { status: true, supplier: { select: { name: true } } },
    });
    if (!request) throw new ValidationError("That supplier is not on this enquiry. Add it on the Sourcing tab first.", { supplierId: "Not on this enquiry" });
    if (request.status === "NO_STOCK" || request.status === "DECLINED") {
      throw new InvariantError(`${request.supplier.name} is marked ${SUPPLIER_REQUEST_STATUS_LABEL[request.status]}. Reopen the request before choosing it.`);
    }

    // The values the buyer saw must be this supplier's, for this requirement's product, and still active.
    let price: string | null = null;
    if (input.priceObservationId) {
      const observation = await c.db.priceObservation.findUnique({ where: { id: input.priceObservationId }, select: { productId: true, supplierId: true, retractedAt: true, amount: true, currencyCode: true } });
      if (!observation || observation.supplierId !== input.supplierId || observation.productId !== item.productId || observation.retractedAt) {
        throw new ValidationError("That price is no longer current for this supplier. Reload the page and try again.", { priceObservationId: "Not current" });
      }
      price = formatMoney(observation.amount.toString(), observation.currencyCode);
    }
    let stock: string | null = null;
    if (input.stockObservationId) {
      const observation = await c.db.stockObservation.findUnique({ where: { id: input.stockObservationId }, select: { productId: true, supplierId: true, retractedAt: true, quantity: true, status: true } });
      if (!observation || observation.supplierId !== input.supplierId || observation.productId !== item.productId || observation.retractedAt) {
        throw new ValidationError("That stock information is no longer current for this supplier. Reload the page and try again.", { stockObservationId: "Not current" });
      }
      stock = [observation.quantity != null ? `${observation.quantity} pcs` : null, observation.status !== "UNKNOWN" ? STOCK_STATUS_LABEL[observation.status] : null].filter(Boolean).join(", ") || null;
    }

    // One active choice per requirement: retract the earlier one first (the database's unique index allows only one).
    const previous = await c.db.procurementDecision.findFirst({ where: { enquiryItemId: item.id, retractedAt: null }, select: { id: true, supplier: { select: { name: true } } } });
    if (previous) {
      await c.db.procurementDecision.update({ where: { id: previous.id }, data: { retractedAt: new Date(), retractedById: ctx.actor.id, retractionReason: "Replaced by a new choice" } });
    }

    const decision = await c.db.procurementDecision.create({
      data: {
        enquiryItemId: item.id,
        supplierId: input.supplierId,
        priceObservationId: input.priceObservationId,
        stockObservationId: input.stockObservationId,
        note: input.note,
        decidedById: ctx.actor.id,
      },
    });
    await writeAudit(c, {
      action: "procurement_decision.chosen",
      entityType: "ProcurementDecision",
      entityId: decision.id,
      scope: enquiryScope(item.enquiryId),
      details: { requirement: requirementName(item), supplier: request.supplier.name, price, stock, note: input.note, replaced: previous?.supplier.name ?? null },
    });
    await touchEnquiry(c, item.enquiryId);
    return { id: decision.id, enquiryId: item.enquiryId };
  });
}

/** Withdraws the active choice for a requirement. The row stays (retracted); it is never deleted. */
export async function clearChoice(ctx: ServiceContext, input: DecisionClearInput) {
  return inTransaction(ctx, async (c) => {
    const decision = await c.db.procurementDecision.findUnique({
      where: { id: input.id },
      select: { id: true, retractedAt: true, supplier: { select: { name: true } }, enquiryItem: { select: { enquiryId: true, description: true, modelText: true, partNumber: true, enquiry: { select: { archivedAt: true } } } } },
    });
    if (!decision) throw new NotFoundError("Choice");
    requireNotArchived(decision.enquiryItem.enquiry);
    if (decision.retractedAt) throw new InvariantError("This choice was already cleared.");

    await c.db.procurementDecision.update({ where: { id: decision.id }, data: { retractedAt: new Date(), retractedById: ctx.actor.id, retractionReason: input.reason } });
    await writeAudit(c, {
      action: "procurement_decision.cleared",
      entityType: "ProcurementDecision",
      entityId: decision.id,
      scope: enquiryScope(decision.enquiryItem.enquiryId),
      details: { requirement: requirementName(decision.enquiryItem), supplier: decision.supplier.name, reason: input.reason },
    });
    await touchEnquiry(c, decision.enquiryItem.enquiryId);
    return { id: decision.id, enquiryId: decision.enquiryItem.enquiryId };
  });
}
