import { ConflictError, InvariantError, NotFoundError, ValidationError, uniqueViolation } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import type { PreferredChannel } from "../../generated/prisma/enums";
import { writeAudit } from "../audit/service";
import { enquiryScope, requireNotArchived, touchEnquiry } from "../enquiries/shared";
import type { RequestAddInput, RequestIdInput, RequestOutcomeInput } from "./schemas";

/**
 * Sourcing requests: "we asked this supplier about this enquiry". The app prepares the text; a person sends it and presses Mark sent.
 * Nothing here creates observations: a reply is a broadcast (see broadcasts/service.ts), reviewed and confirmed as usual. Every change
 * is audited in the same transaction, scoped to the enquiry so it shows on the enquiry's Activity timeline.
 */

async function loadRequest(c: ServiceContext, id: string) {
  const request = await c.db.supplierRequest.findUnique({
    where: { id },
    include: { supplier: { select: { id: true, name: true } }, enquiry: { select: { id: true, archivedAt: true } } },
  });
  if (!request) throw new NotFoundError("Request");
  requireNotArchived(request.enquiry);
  return request;
}

// ───────────────────────────────────────── add / remove ─────────────────────────────────────────

export async function addSupplierRequest(ctx: ServiceContext, input: RequestAddInput) {
  return inTransaction(ctx, async (c) => {
    const enquiry = await c.db.enquiry.findUnique({ where: { id: input.enquiryId }, select: { id: true, archivedAt: true } });
    if (!enquiry) throw new NotFoundError("Enquiry");
    requireNotArchived(enquiry);

    const confirmed = await c.db.enquiryItem.count({ where: { enquiryId: enquiry.id, reviewStatus: "CONFIRMED" } });
    if (confirmed === 0) throw new InvariantError("Confirm at least one requirement before asking suppliers.");

    const supplier = await c.db.supplier.findUnique({ where: { id: input.supplierId }, select: { id: true, name: true, status: true } });
    if (!supplier) throw new NotFoundError("Supplier");
    if (supplier.status !== "ACTIVE") throw new ValidationError("That supplier is not active.", { supplierId: "Choose an active supplier" });

    let contactName: string | null = null;
    if (input.contactId) {
      const contact = await c.db.supplierContact.findUnique({ where: { id: input.contactId }, select: { name: true, supplierId: true, status: true } });
      if (!contact || contact.supplierId !== supplier.id) throw new ValidationError("That contact does not belong to this supplier.", { contactId: "Choose a contact of this supplier" });
      if (contact.status === "ARCHIVED") throw new ValidationError("That contact is archived.", { contactId: "Archived" });
      contactName = contact.name;
    }

    const request = await c.db.supplierRequest
      .create({ data: { enquiryId: enquiry.id, supplierId: supplier.id, contactId: input.contactId, createdById: ctx.actor.id } })
      .catch((error: unknown) => {
        if (uniqueViolation(error)) throw new ConflictError(`${supplier.name} is already on this enquiry.`, { supplierId: "Already added" });
        throw error;
      });

    await writeAudit(c, {
      action: "supplier_request.added",
      entityType: "SupplierRequest",
      entityId: request.id,
      scope: enquiryScope(enquiry.id),
      details: { supplier: supplier.name, contact: contactName },
    });
    await touchEnquiry(c, enquiry.id);
    return request;
  });
}

/** Only a request that has not been sent. A sent request stays (it is a record of what was asked). */
export async function removeSupplierRequest(ctx: ServiceContext, input: RequestIdInput) {
  return inTransaction(ctx, async (c) => {
    const request = await loadRequest(c, input.id);
    if (request.status !== "DRAFT") throw new InvariantError("Only a request that has not been sent can be removed.");

    await c.db.supplierRequest.delete({ where: { id: request.id } });
    await writeAudit(c, {
      action: "supplier_request.removed",
      entityType: "SupplierRequest",
      entityId: request.id,
      scope: enquiryScope(request.enquiryId),
      details: { supplier: request.supplier.name },
    });
    await touchEnquiry(c, request.enquiryId);
    return { id: request.id, enquiryId: request.enquiryId };
  });
}

// ───────────────────────────────────────── sent / outcome ─────────────────────────────────────────

export type MarkSentServiceInput = { id: string; messageText: string; channel: PreferredChannel; sentAt: Date };

/** DRAFT -> SENT. Stores the exact text, channel and time; the database then refuses to change them. */
export async function markRequestSent(ctx: ServiceContext, input: MarkSentServiceInput) {
  return inTransaction(ctx, async (c) => {
    const request = await loadRequest(c, input.id);
    if (request.status !== "DRAFT") throw new InvariantError("This request was already sent.");
    if (input.sentAt.getTime() > Date.now() + 5 * 60_000) throw new ValidationError("It cannot have been sent in the future.", { sentAt: "In the future" });

    const updated = await c.db.supplierRequest.update({
      where: { id: request.id },
      data: { status: "SENT", channel: input.channel, messageText: input.messageText, sentAt: input.sentAt, sentById: ctx.actor.id },
    });
    await writeAudit(c, {
      action: "supplier_request.sent",
      entityType: "SupplierRequest",
      entityId: request.id,
      scope: enquiryScope(request.enquiryId),
      details: { supplier: request.supplier.name, channel: input.channel, sentAt: input.sentAt.toISOString() },
    });
    await touchEnquiry(c, request.enquiryId);
    return updated;
  });
}

/** A person records "no stock" or "declined" (for example after a phone call). It creates no observation; only a confirmed reply line does. */
export async function setRequestOutcome(ctx: ServiceContext, input: RequestOutcomeInput) {
  return inTransaction(ctx, async (c) => {
    const request = await loadRequest(c, input.id);
    if (request.status !== "DRAFT" && request.status !== "SENT") throw new InvariantError("Only a request that is still open can be marked this way.");

    const updated = await c.db.supplierRequest.update({ where: { id: request.id }, data: { status: input.status, note: input.note ?? request.note } });
    await writeAudit(c, {
      action: "supplier_request.status_changed",
      entityType: "SupplierRequest",
      entityId: request.id,
      scope: enquiryScope(request.enquiryId),
      details: { supplier: request.supplier.name, status: { from: request.status, to: input.status }, note: input.note },
    });
    await touchEnquiry(c, request.enquiryId);
    return updated;
  });
}

/** NO_STOCK / DECLINED back to SENT (or DRAFT if it was never sent). REPLIED is only ever set by recording a reply. */
export async function reopenRequest(ctx: ServiceContext, input: RequestIdInput) {
  return inTransaction(ctx, async (c) => {
    const request = await loadRequest(c, input.id);
    if (request.status !== "NO_STOCK" && request.status !== "DECLINED") throw new InvariantError("Only a request marked No stock or Declined can be reopened.");

    const to = request.sentAt ? "SENT" : "DRAFT";
    const updated = await c.db.supplierRequest.update({ where: { id: request.id }, data: { status: to } });
    await writeAudit(c, {
      action: "supplier_request.status_changed",
      entityType: "SupplierRequest",
      entityId: request.id,
      scope: enquiryScope(request.enquiryId),
      details: { supplier: request.supplier.name, status: { from: request.status, to } },
    });
    await touchEnquiry(c, request.enquiryId);
    return updated;
  });
}

// ───────────────────────────────────────── replies (called by broadcasts/service.ts) ─────────────────────────────────────────

/** Before the reply broadcast is created: the request exists, its enquiry is not archived, and it is for the same supplier. */
export async function assertRequestAcceptsReply(c: ServiceContext, requestId: string, supplierId: string): Promise<void> {
  const request = await c.db.supplierRequest.findUnique({ where: { id: requestId }, select: { supplierId: true, enquiry: { select: { archivedAt: true } } } });
  if (!request) throw new NotFoundError("Request");
  if (request.supplierId !== supplierId) {
    throw new ValidationError("This reply is linked to a request for another supplier. Keep the supplier the request was sent to.", { supplierId: "Not the supplier this request was sent to" });
  }
  requireNotArchived(request.enquiry);
}

/** Right after the reply broadcast is created, in the same transaction: the request becomes REPLIED (a second reply changes nothing). */
export async function markRequestReplied(c: ServiceContext, requestId: string, broadcastId: string): Promise<void> {
  const request = await c.db.supplierRequest.findUniqueOrThrow({ where: { id: requestId }, select: { id: true, status: true, enquiryId: true, supplier: { select: { name: true } } } });
  if (request.status !== "REPLIED") {
    await c.db.supplierRequest.update({ where: { id: requestId }, data: { status: "REPLIED" } });
    await writeAudit(c, {
      action: "supplier_request.status_changed",
      entityType: "SupplierRequest",
      entityId: requestId,
      scope: enquiryScope(request.enquiryId),
      details: { supplier: request.supplier.name, status: { from: request.status, to: "REPLIED" }, reply: broadcastId },
    });
  }
  await touchEnquiry(c, request.enquiryId);
}
