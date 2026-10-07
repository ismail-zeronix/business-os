import { ConflictError, InvariantError, NotFoundError, ValidationError, uniqueViolation } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { writeAudit } from "../audit/service";
import { quotationReference } from "../quotations/shared";
import type { InvoiceCancelInput, InvoiceFromQuotationInput, InvoiceIdInput } from "./schemas";
import { invoiceReference, invoiceScope, nextInvoiceReference } from "./shared";

/**
 * Invoice rules. An invoice always comes from exactly one ISSUED quotation (one invoice per quotation) - its customer,
 * currency, VAT and lines are a frozen copy made once, here, never re-priced: the quotation already did the pricing and
 * costing work, and an invoice line carries no cost/markup columns at all (the same wall as the quotation's print view).
 * Status only moves forward: DRAFT -> ISSUED -> PAID, or DRAFT/ISSUED -> CANCELLED. Every change is audited in the same
 * transaction, scoped to the invoice.
 */

export async function createInvoiceFromQuotation(ctx: ServiceContext, input: InvoiceFromQuotationInput) {
  try {
    return await inTransaction(ctx, async (c) => {
      const quotation = await c.db.quotation.findUnique({
        where: { id: input.quotationId },
        select: {
          id: true,
          number: true,
          revision: true,
          quoteDate: true,
          quoteSeq: true,
          status: true,
          customerId: true,
          customerName: true,
          contactName: true,
          currencyCode: true,
          vatPercent: true,
          invoice: { select: { id: true, invoiceDate: true, invoiceSeq: true } },
          lines: { orderBy: { position: "asc" }, select: { position: true, description: true, partNumber: true, quantity: true, unitPrice: true } },
        },
      });
      if (!quotation) throw new NotFoundError("Quotation");
      if (quotation.status !== "ISSUED") throw new InvariantError("Only an issued quotation can be invoiced.");
      if (quotation.invoice) throw new ConflictError(`This quotation already has an invoice (${invoiceReference(quotation.invoice)}). Open it instead.`);

      const reference = await nextInvoiceReference(c);
      const invoice = await c.db.invoice.create({
        data: {
          ...reference,
          quotationId: quotation.id,
          customerId: quotation.customerId,
          customerName: quotation.customerName,
          contactName: quotation.contactName,
          currencyCode: quotation.currencyCode,
          vatPercent: quotation.vatPercent,
          createdById: ctx.actor.id,
          lines: { create: quotation.lines.map((line) => ({ position: line.position, description: line.description, partNumber: line.partNumber, quantity: line.quantity, unitPrice: line.unitPrice })) },
        },
        select: { id: true, invoiceDate: true, invoiceSeq: true },
      });
      await writeAudit(c, {
        action: "invoice.created",
        entityType: "Invoice",
        entityId: invoice.id,
        scope: invoiceScope(invoice.id),
        details: { reference: invoiceReference(invoice), quotation: quotationReference({ quoteDate: quotation.quoteDate, quoteSeq: quotation.quoteSeq }) },
      });
      return { id: invoice.id };
    });
  } catch (error) {
    if (uniqueViolation(error)) throw new ConflictError("This quotation already has an invoice. Open it instead.");
    throw error;
  }
}

export async function issueInvoice(ctx: ServiceContext, input: InvoiceIdInput) {
  return inTransaction(ctx, async (c) => {
    const invoice = await c.db.invoice.findUnique({ where: { id: input.id }, select: { id: true, status: true } });
    if (!invoice) throw new NotFoundError("Invoice");
    if (invoice.status !== "DRAFT") throw new InvariantError("Only a draft invoice can be issued.");
    await c.db.invoice.update({ where: { id: invoice.id }, data: { status: "ISSUED", issuedAt: new Date(), issuedById: ctx.actor.id } });
    await writeAudit(c, { action: "invoice.issued", entityType: "Invoice", entityId: invoice.id, scope: invoiceScope(invoice.id) });
    return { id: invoice.id };
  });
}

export async function markInvoicePaid(ctx: ServiceContext, input: InvoiceIdInput) {
  return inTransaction(ctx, async (c) => {
    const invoice = await c.db.invoice.findUnique({ where: { id: input.id }, select: { id: true, status: true } });
    if (!invoice) throw new NotFoundError("Invoice");
    if (invoice.status !== "ISSUED") throw new InvariantError("Only an issued invoice can be marked paid.");
    await c.db.invoice.update({ where: { id: invoice.id }, data: { status: "PAID", paidAt: new Date() } });
    await writeAudit(c, { action: "invoice.paid", entityType: "Invoice", entityId: invoice.id, scope: invoiceScope(invoice.id) });
    return { id: invoice.id };
  });
}

export async function cancelInvoice(ctx: ServiceContext, input: InvoiceCancelInput) {
  if (!input.reason.trim()) throw new ValidationError("Give a reason for cancelling this invoice.", { reason: "Reason is required" });
  return inTransaction(ctx, async (c) => {
    const invoice = await c.db.invoice.findUnique({ where: { id: input.id }, select: { id: true, status: true } });
    if (!invoice) throw new NotFoundError("Invoice");
    if (invoice.status === "PAID") throw new InvariantError("A paid invoice cannot be cancelled.");
    if (invoice.status === "CANCELLED") throw new InvariantError("This invoice is already cancelled.");
    await c.db.invoice.update({ where: { id: invoice.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledReason: input.reason } });
    await writeAudit(c, { action: "invoice.cancelled", entityType: "Invoice", entityId: invoice.id, scope: invoiceScope(invoice.id), details: { reason: input.reason } });
    return { id: invoice.id };
  });
}
