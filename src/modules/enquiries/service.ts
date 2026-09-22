import { ConflictError, InvariantError, NotFoundError, ValidationError } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import type { Prisma } from "../../generated/prisma/client";
import type { EvidenceChannel } from "../../generated/prisma/enums";
import { diffFields } from "../../lib/diff";
import { writeAudit } from "../audit/service";
import { addCustomerContact } from "../customers/contact.service";
import { createCustomer } from "../customers/service";
import { createEvidence } from "../evidence/service";
import { findMatchCandidates, pickAutoLink } from "../products/matching";
import { enquiryRulesParser } from "./parsing/enquiry-parser";
import { emailHeaderLineCount, emailSubjectLineIndex } from "./parsing/quoted";
import type { EnquiryHeaderProposal } from "./parsing/types";
import type { CustomerFromRequesterInput, EnquiryArchiveInput, EnquiryHeaderInput, EnquiryNoteInput, EnquirySuggestionInput, EnquiryStatusInput } from "./schemas";
import { assertCustomerAndContact, requireNotArchived, touchEnquiry } from "./shared";

/**
 * Enquiry workflow (header level). The customer's original request is stored as immutable evidence; parsed lines become PENDING items
 * (proposals, see item.service.ts); header suggestions are shown for a person to apply. Every step is audited in the same transaction.
 * Nothing here creates supplier observations: an enquiry records what the customer needs, not what a supplier offered.
 */

export type EnquirySource =
  | { kind: "new"; channel: EvidenceChannel; observedAt: Date; rawText: string }
  /** Evidence that already exists (an ingested email). It is reused, never copied, and can belong to only one enquiry. */
  | { kind: "existing"; evidenceSourceId: string };

export type EnquiryCreateServiceInput = {
  source: EnquirySource;
  customerId: string | null;
  contactId: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  subject: string | null;
  notes: string | null;
};

// ───────────────────────────────────────── create ─────────────────────────────────────────

export async function createEnquiry(ctx: ServiceContext, input: EnquiryCreateServiceInput) {
  return inTransaction(ctx, async (c) => {
    await assertCustomerAndContact(c, input.customerId, input.contactId);

    let evidence: { id: string; rawText: string };
    if (input.source.kind === "new") {
      evidence = await createEvidence(c, { kind: "CUSTOMER_ENQUIRY", channel: input.source.channel, rawText: input.source.rawText, observedAt: input.source.observedAt });
    } else {
      const found = await c.db.evidenceSource.findUnique({ where: { id: input.source.evidenceSourceId }, select: { id: true, rawText: true, enquiry: { select: { id: true } } } });
      if (!found) throw new NotFoundError("Evidence");
      if (found.enquiry) throw new ConflictError("This message already has an enquiry.");
      evidence = { id: found.id, rawText: found.rawText };
    }

    // Propose requirements deterministically. An email's header block is skipped; if the body holds nothing, the subject line is tried.
    const brands = (await c.db.brand.findMany({ where: { status: { not: "ARCHIVED" } }, select: { name: true } })).map((b) => b.name);
    const families = (await c.db.product.findMany({ where: { status: { not: "ARCHIVED" }, family: { not: null } }, select: { family: true }, distinct: ["family"] })).map((p) => p.family as string);
    const skip = emailHeaderLineCount(evidence.rawText);
    let parsed = enquiryRulesParser.parse(evidence.rawText, { brands, families, skipLeadingLines: skip });
    if (parsed.items.length === 0 && skip > 0) {
      const subjectIndex = emailSubjectLineIndex(evidence.rawText);
      if (subjectIndex >= 0) parsed = enquiryRulesParser.parse(evidence.rawText, { brands, families, skipLeadingLines: subjectIndex });
    }

    const enquiry = await c.db.enquiry.create({
      data: {
        evidenceSourceId: evidence.id,
        customerId: input.customerId,
        contactId: input.contactId,
        requesterName: input.requesterName,
        requesterEmail: input.requesterEmail,
        subject: input.subject,
        notes: input.notes,
        extractedData: { parser: enquiryRulesParser.name, version: enquiryRulesParser.version, header: parsed.header } as Prisma.InputJsonValue,
        createdById: ctx.actor.id,
      },
    });

    // Items are proposals: pre-link a product only when exactly one strong match exists. Everything stays PENDING.
    for (const item of parsed.items) {
      const candidates = await findMatchCandidates(c.db, { partNumber: item.partNumber, model: item.modelText, brandText: item.brandText, description: item.description });
      const link = pickAutoLink(candidates);
      const { extractedData, confidence, ...fields } = item;
      // The parser's original values are kept write-once in extracted_data, so the workspace can always show "original vs corrected".
      const original = {
        description: fields.description,
        brandText: fields.brandText,
        familyText: fields.familyText,
        modelText: fields.modelText,
        partNumber: fields.partNumber,
        specText: fields.specText,
        quantity: fields.quantity,
      };
      await c.db.enquiryItem.create({
        data: {
          ...fields,
          enquiryId: enquiry.id,
          origin: "PARSER",
          extractionConfidence: confidence,
          extractedData: { ...extractedData, fields: original } as Prisma.InputJsonValue,
          productId: link?.productId ?? null,
          matchBasis: link?.basis ?? null,
        },
      });
    }

    await writeAudit(c, {
      action: "enquiry.created",
      entityType: "Enquiry",
      entityId: enquiry.id,
      details: { number: enquiry.number, source: input.source.kind === "new" ? input.source.channel : "EMAIL", items: parsed.items.length, parser: `${enquiryRulesParser.name} v${enquiryRulesParser.version}` },
    });
    return { enquiry, itemCount: parsed.items.length };
  });
}

// ───────────────────────────────────────── header ─────────────────────────────────────────

const HEADER_FIELDS = ["requesterName", "requesterEmail", "subject", "priority", "requiredBy", "deliveryLocation", "blocker", "nextAction", "notes"] as const;

export async function updateEnquiryHeader(ctx: ServiceContext, input: EnquiryHeaderInput) {
  return inTransaction(ctx, async (c) => {
    const { id, customerId, contactId, assignedToId, ...fields } = input;
    const existing = await c.db.enquiry.findUnique({
      where: { id },
      include: { customer: { select: { name: true } }, contact: { select: { name: true } }, assignedTo: { select: { name: true } } },
    });
    if (!existing) throw new NotFoundError("Enquiry");
    requireNotArchived(existing);

    await assertCustomerAndContact(c, customerId, contactId, { customerId: existing.customerId, contactId: existing.contactId });
    if (assignedToId && assignedToId !== existing.assignedToId) {
      const user = await c.db.user.findUnique({ where: { id: assignedToId }, select: { status: true } });
      if (!user || user.status !== "ACTIVE") throw new ValidationError("That owner is not available.", { assignedToId: "Choose an active user" });
    }

    const details: Record<string, Prisma.InputJsonValue> = { ...diffFields(existing, fields, HEADER_FIELDS) };
    if (customerId !== existing.customerId) {
      const next = customerId ? await c.db.customer.findUnique({ where: { id: customerId }, select: { name: true } }) : null;
      details.customer = { from: existing.customer?.name ?? null, to: next?.name ?? null };
    }
    if (contactId !== existing.contactId) {
      const next = contactId ? await c.db.customerContact.findUnique({ where: { id: contactId }, select: { name: true } }) : null;
      details.contact = { from: existing.contact?.name ?? null, to: next?.name ?? null };
    }
    if (assignedToId !== existing.assignedToId) {
      const next = assignedToId ? await c.db.user.findUnique({ where: { id: assignedToId }, select: { name: true } }) : null;
      details.owner = { from: existing.assignedTo?.name ?? null, to: next?.name ?? null };
    }
    if (Object.keys(details).length === 0) return existing;

    const updated = await c.db.enquiry.update({ where: { id }, data: { ...fields, customerId, contactId, assignedToId, lastActivityAt: new Date() } });
    await writeAudit(c, { action: "enquiry.updated", entityType: "Enquiry", entityId: id, details });
    return updated;
  });
}

export async function setEnquiryStatus(ctx: ServiceContext, input: EnquiryStatusInput) {
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.enquiry.findUnique({ where: { id: input.id }, select: { id: true, status: true, archivedAt: true } });
    if (!existing) throw new NotFoundError("Enquiry");
    requireNotArchived(existing);
    if (existing.status === input.status) return existing;
    const updated = await c.db.enquiry.update({ where: { id: input.id }, data: { status: input.status, lastActivityAt: new Date() } });
    await writeAudit(c, {
      action: "enquiry.status_changed",
      entityType: "Enquiry",
      entityId: input.id,
      details: { status: { from: existing.status, to: input.status }, note: input.note },
    });
    return updated;
  });
}

/** A note is an append-only audit entry (no notes table). It appears in the enquiry's timeline and counts as activity. */
export async function addEnquiryNote(ctx: ServiceContext, input: EnquiryNoteInput) {
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.enquiry.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!existing) throw new NotFoundError("Enquiry");
    await writeAudit(c, { action: "enquiry.note_added", entityType: "Enquiry", entityId: input.id, details: { note: input.note } });
    await touchEnquiry(c, input.id);
  });
}

/** Soft-archive (or restore) an enquiry. Its evidence and items remain; it is only hidden from the working lists. */
export async function setEnquiryArchived(ctx: ServiceContext, input: EnquiryArchiveInput) {
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.enquiry.findUnique({ where: { id: input.id }, select: { id: true, archivedAt: true } });
    if (!existing) throw new NotFoundError("Enquiry");
    if (Boolean(existing.archivedAt) === input.archived) return existing;
    const updated = await c.db.enquiry.update({ where: { id: input.id }, data: { archivedAt: input.archived ? new Date() : null, lastActivityAt: new Date() } });
    await writeAudit(c, { action: "enquiry.archived", entityType: "Enquiry", entityId: input.id, details: { archived: input.archived } });
    return updated;
  });
}

/** Applies one parser suggestion (delivery or urgency) the person accepted. Never overwrites a value that is already set. */
export async function applyHeaderSuggestion(ctx: ServiceContext, input: EnquirySuggestionInput) {
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.enquiry.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundError("Enquiry");
    requireNotArchived(existing);
    const proposal = (existing.extractedData as { header?: EnquiryHeaderProposal } | null)?.header;

    if (input.field === "deliveryLocation") {
      if (!proposal?.deliveryLocation) throw new InvariantError("There is no delivery suggestion to apply.");
      if (existing.deliveryLocation) return existing;
      const updated = await c.db.enquiry.update({ where: { id: input.id }, data: { deliveryLocation: proposal.deliveryLocation, lastActivityAt: new Date() } });
      await writeAudit(c, { action: "enquiry.updated", entityType: "Enquiry", entityId: input.id, details: { deliveryLocation: { from: null, to: proposal.deliveryLocation }, via: "suggestion" } });
      return updated;
    }

    if (proposal?.priority !== "URGENT") throw new InvariantError("There is no priority suggestion to apply.");
    if (existing.priority !== "NORMAL") return existing;
    const updated = await c.db.enquiry.update({ where: { id: input.id }, data: { priority: "URGENT", lastActivityAt: new Date() } });
    await writeAudit(c, { action: "enquiry.updated", entityType: "Enquiry", entityId: input.id, details: { priority: { from: "NORMAL", to: "URGENT" }, via: "suggestion" } });
    return updated;
  });
}

/** Promotes an unknown requester to a real customer (and contact) and links the enquiry to them, in one transaction. */
export async function createCustomerFromRequester(ctx: ServiceContext, input: CustomerFromRequesterInput) {
  return inTransaction(ctx, async (c) => {
    const enquiry = await c.db.enquiry.findUnique({ where: { id: input.enquiryId }, select: { id: true, customerId: true, archivedAt: true } });
    if (!enquiry) throw new NotFoundError("Enquiry");
    requireNotArchived(enquiry);
    if (enquiry.customerId) throw new InvariantError("This enquiry already has a customer.");

    const customer = await createCustomer(c, { name: input.name, legalName: null, trn: null, country: null, emirate: null, website: null, phone: null, email: null, notes: null });
    const contact =
      input.contactName || input.contactEmail
        ? await addCustomerContact(c, {
            customerId: customer.id,
            name: input.contactName ?? input.contactEmail ?? "Contact",
            jobTitle: null,
            department: null,
            phone: null,
            whatsapp: null,
            email: input.contactEmail,
            preferredChannel: null,
            notes: null,
          })
        : null;

    const updated = await c.db.enquiry.update({ where: { id: input.enquiryId }, data: { customerId: customer.id, contactId: contact?.id ?? null, lastActivityAt: new Date() } });
    await writeAudit(c, {
      action: "enquiry.updated",
      entityType: "Enquiry",
      entityId: input.enquiryId,
      details: { customer: { from: null, to: customer.name }, contact: { from: null, to: contact?.name ?? null }, created: true },
    });
    return updated;
  });
}
