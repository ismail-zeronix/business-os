import { InvariantError, NotFoundError, ValidationError } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { writeAudit } from "../audit/service";
import { findKnownCustomerByEmail } from "../customers/queries";
import { createEnquiry } from "../enquiries/service";
import type { EmailDismissInput } from "./schemas";

/**
 * Email triage. An ingested email is immutable evidence; a person decides what to do with it: create an enquiry from it, or dismiss it
 * with a reason (and restore it later). Nothing here ever creates an enquiry automatically, and only the triage columns of the email
 * row change (a database trigger enforces that).
 */

async function loadNew(c: ServiceContext, id: string) {
  const email = await c.db.emailMessage.findUnique({ where: { id }, select: { id: true, triageStatus: true, fromAddress: true, fromName: true, subject: true, evidenceSourceId: true } });
  if (!email) throw new NotFoundError("Email");
  return email;
}

/**
 * Creates an enquiry from an email. The enquiry reuses the email's own evidence (no copy), so the raw request and the original message
 * stay one thing. A sender who matches a known customer contact is linked; anyone else is kept as the requester (nothing is invented).
 */
export async function createEnquiryFromEmail(ctx: ServiceContext, emailId: string) {
  return inTransaction(ctx, async (c) => {
    const email = await loadNew(c, emailId);
    if (email.triageStatus !== "NEW") throw new InvariantError("This email has already been handled.");

    const known = email.fromAddress ? await findKnownCustomerByEmail(email.fromAddress) : null;
    const { enquiry } = await createEnquiry(c, {
      source: { kind: "existing", evidenceSourceId: email.evidenceSourceId },
      customerId: known?.customerId ?? null,
      contactId: known?.contactId ?? null,
      requesterName: known ? null : email.fromName,
      requesterEmail: known ? null : email.fromAddress,
      subject: email.subject,
      notes: null,
    });
    await c.db.emailMessage.update({ where: { id: emailId }, data: { triageStatus: "ENQUIRY_CREATED", enquiryId: enquiry.id }, select: { id: true } });
    await writeAudit(c, {
      action: "email_message.enquiry_created",
      entityType: "EmailMessage",
      entityId: emailId,
      scope: { type: "Enquiry", id: enquiry.id },
      details: { enquiry: `ENQ-${String(enquiry.number).padStart(5, "0")}`, customer: known?.customerName ?? null },
    });
    return { enquiryId: enquiry.id };
  });
}

export async function dismissEmail(ctx: ServiceContext, input: EmailDismissInput) {
  // The form validates this with zod; the service still refuses a blank reason, because the database only requires "not null".
  if (!input.reason.trim()) throw new ValidationError("Give a reason for dismissing this email.", { reason: "Reason is required" });
  return inTransaction(ctx, async (c) => {
    const email = await loadNew(c, input.id);
    if (email.triageStatus !== "NEW") throw new InvariantError("Only an email that is still waiting can be dismissed.");
    await c.db.emailMessage.update({ where: { id: input.id }, data: { triageStatus: "DISMISSED", dismissedAt: new Date(), dismissedById: ctx.actor.id, dismissedReason: input.reason }, select: { id: true } });
    await writeAudit(c, { action: "email_message.dismissed", entityType: "EmailMessage", entityId: input.id, details: { reason: input.reason } });
    return { id: input.id };
  });
}

/** Puts a dismissed email back into the triage queue. Its dismissal stays in the audit history. */
export async function restoreEmail(ctx: ServiceContext, input: { id: string }) {
  return inTransaction(ctx, async (c) => {
    const email = await loadNew(c, input.id);
    if (email.triageStatus !== "DISMISSED") throw new InvariantError("Only a dismissed email can be restored.");
    await c.db.emailMessage.update({ where: { id: input.id }, data: { triageStatus: "NEW", dismissedAt: null, dismissedById: null, dismissedReason: null }, select: { id: true } });
    await writeAudit(c, { action: "email_message.restored", entityType: "EmailMessage", entityId: input.id });
    return { id: input.id };
  });
}
