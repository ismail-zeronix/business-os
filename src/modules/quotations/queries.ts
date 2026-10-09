import { db } from "../../core/database/client";
import type { Prisma } from "../../generated/prisma/client";
import type { QuotationStatus } from "../../generated/prisma/enums";
import type { OwnerActor } from "../customers/queries";
import { escapeLike } from "../../lib/like";
import { PAGE_SIZE } from "../../lib/search-params";
import { centsToAmount, computeTotals, toCents } from "./pricing";

/**
 * Sales-module visibility, following the linked customer's owner (customers/queries.ts): visible if the customer is
 * shared/unowned, or owned by this actor, OR this actor made or issued the quotation themselves (so creating a quotation
 * for a customer you don't own - e.g. from an enquiry assigned to you - never locks you out of your own work). ADMIN
 * sees everything. A manual quotation with no customer at all is visible only to its creator/issuer (+ ADMIN).
 */
function visibilityWhere(actor: OwnerActor): Prisma.QuotationWhereInput {
  if (actor.role === "ADMIN") return {};
  return { OR: [{ customer: { ownerId: null } }, { customer: { ownerId: actor.id } }, { createdById: actor.id }, { issuedById: actor.id }] };
}

export type QuotationListParams = { q?: string; status?: QuotationStatus; enquiryId?: string; page: number };

export type QuotationListRow = {
  id: string;
  quoteDate: Date;
  quoteSeq: number;
  revision: number;
  status: QuotationStatus;
  customerName: string | null;
  currencyCode: string;
  validUntil: Date | null;
  updatedAt: Date;
  /** NULL for a manual quotation. */
  enquiry: { id: string; number: number } | null;
  /** The linked customer's owner (Customer.ownerId), for display only - never used to filter this list. */
  ownerId: string | null;
  ownerName: string | null;
  lineCount: number;
  /** Total including VAT, "5644.88". Lines still missing a quantity or price are left out of it. */
  total: string;
  incompleteLines: number;
};

function listWhere(params: QuotationListParams, actor: OwnerActor): Prisma.QuotationWhereInput {
  const q = params.q?.trim();
  const contains = (value: string) => ({ contains: escapeLike(value), mode: "insensitive" as const });
  // QUO-20260921-0001 (or 20260921-0001) finds one quotation; a bare counter such as 0001 or 1 finds that counter on any day.
  const full = q ? /^(?:QUO-?)?(\d{4})(\d{2})(\d{2})-?(\d{1,4})$/i.exec(q) : null;
  const counter = q && !full ? /^(?:QUO-?)?(\d{1,4})$/i.exec(q)?.[1] : undefined;
  const enquiryNumber = q ? /^ENQ-?0*(\d+)$/i.exec(q)?.[1] : undefined;
  return {
    AND: [
      visibilityWhere(actor),
      // Superseded revisions are hidden until asked for, so a list shows what is current.
      params.status ? { status: params.status } : { status: { not: "SUPERSEDED" } },
      params.enquiryId ? { enquiryId: params.enquiryId } : {},
      q
        ? {
            OR: [
              ...(full ? [{ quoteDate: new Date(`${full[1]}-${full[2]}-${full[3]}T00:00:00Z`), quoteSeq: Number(full[4]) }] : []),
              ...(counter ? [{ quoteSeq: Number(counter) }] : []),
              ...(enquiryNumber ? [{ enquiry: { number: Number(enquiryNumber) } }] : []),
              { customerName: contains(q) },
              { contactName: contains(q) },
              { lines: { some: { description: contains(q) } } },
            ],
          }
        : {},
    ],
  };
}

/** Server-side filtered, paginated list, most recently changed first. */
export async function listQuotations(params: QuotationListParams, actor: OwnerActor): Promise<{ rows: QuotationListRow[]; total: number }> {
  const where = listWhere(params, actor);
  const [quotations, total] = await Promise.all([
    db.quotation.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        quoteDate: true,
        quoteSeq: true,
        revision: true,
        status: true,
        customerName: true,
        currencyCode: true,
        vatPercent: true,
        validUntil: true,
        updatedAt: true,
        enquiry: { select: { id: true, number: true } },
        customer: { select: { owner: { select: { id: true, name: true } } } },
        lines: { select: { quantity: true, unitPrice: true } },
      },
    }),
    db.quotation.count({ where }),
  ]);
  const rows = quotations.map((quotation) => {
    const totals = computeTotals(quotation.lines, quotation.vatPercent);
    return {
      id: quotation.id,
      quoteDate: quotation.quoteDate,
      quoteSeq: quotation.quoteSeq,
      revision: quotation.revision,
      status: quotation.status,
      customerName: quotation.customerName,
      currencyCode: quotation.currencyCode,
      validUntil: quotation.validUntil,
      updatedAt: quotation.updatedAt,
      enquiry: quotation.enquiry,
      ownerId: quotation.customer?.owner?.id ?? null,
      ownerName: quotation.customer?.owner?.name ?? null,
      lineCount: quotation.lines.length,
      total: totals.total,
      incompleteLines: totals.incompleteLines,
    };
  });
  return { rows, total };
}

export type CustomerOpenQuotationValue = { currencyCode: string; total: string; count: number } | { mixed: true; count: number } | null;

/**
 * The value of this customer's open (DRAFT) quotations, for the customer detail page's snapshot. Summed only when every
 * draft shares one currency - this codebase never converts currency, so drafts spanning 2+ currencies report `{ mixed: true }`
 * instead of a fabricated total. Returns null when there are no open drafts, so the UI omits the row entirely.
 */
export async function getCustomerOpenQuotationValue(customerId: string): Promise<CustomerOpenQuotationValue> {
  const drafts = await db.quotation.findMany({
    where: { customerId, status: "DRAFT" },
    select: { currencyCode: true, vatPercent: true, lines: { select: { quantity: true, unitPrice: true } } },
  });
  if (drafts.length === 0) return null;

  const currencies = new Set(drafts.map((d) => d.currencyCode));
  if (currencies.size > 1) return { mixed: true, count: drafts.length };

  const totalCents = drafts.reduce((sum, d) => sum + toCents(computeTotals(d.lines, d.vatPercent).total), 0);
  return { currencyCode: drafts[0]!.currencyCode, total: centsToAmount(totalCents), count: drafts.length };
}

/** The quotations of one enquiry, newest first. Used by the enquiry header. */
export async function listQuotationsForEnquiry(enquiryId: string) {
  return db.quotation.findMany({
    where: { enquiryId },
    orderBy: [{ number: "desc" }, { revision: "desc" }],
    select: { id: true, quoteDate: true, quoteSeq: true, revision: true, status: true },
  });
}

/** The internal view of a quotation: everything, including each line's cost and where it came from. Never used for the customer's copy. */
export async function getQuotation(id: string, actor: OwnerActor) {
  const quotation = await db.quotation.findFirst({
    where: { AND: [{ id }, visibilityWhere(actor)] },
    include: {
      enquiry: { select: { id: true, number: true, archivedAt: true, subject: true } },
      customer: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      issuedBy: { select: { name: true } },
      invoice: { select: { id: true, invoiceDate: true, invoiceSeq: true, status: true } },
      lines: {
        orderBy: { position: "asc" },
        include: {
          costObservation: { select: { id: true, amount: true, currencyCode: true, vatState: true, observedAt: true, supplier: { select: { id: true, name: true } } } },
        },
      },
    },
  });
  if (!quotation) return null;
  const revisions = await db.quotation.findMany({
    where: { number: quotation.number },
    orderBy: { revision: "desc" },
    select: { id: true, revision: true, status: true },
  });
  return { ...quotation, revisions };
}

export type QuotationDetail = NonNullable<Awaited<ReturnType<typeof getQuotation>>>;
export type QuotationLineDetail = QuotationDetail["lines"][number];

/**
 * The customer's copy. THIS SELECT IS THE WALL between what the customer may read and what is internal: it names only customer-visible
 * columns, so no supplier, cost, markup or margin can reach the print page, whatever the page renders. Add a column here only if the
 * customer is meant to see it.
 */
export async function getQuotationForPrint(id: string) {
  return db.quotation.findUnique({
    where: { id },
    select: {
      quoteDate: true,
      quoteSeq: true,
      revision: true,
      status: true,
      customerName: true,
      contactName: true,
      currencyCode: true,
      vatPercent: true,
      validUntil: true,
      paymentTerms: true,
      deliveryTerms: true,
      notes: true,
      issuedAt: true,
      createdAt: true,
      createdBy: { select: { name: true } },
      issuedBy: { select: { name: true } },
      lines: { orderBy: { position: "asc" }, select: { position: true, description: true, partNumber: true, quantity: true, unitPrice: true } },
    },
  });
}

export type QuotationPrintData = NonNullable<Awaited<ReturnType<typeof getQuotationForPrint>>>;

/** Emails sent for a quotation (or tried and failed), newest first. The attachment bytes are not selected here. */
export async function listSentEmailsForQuotation(quotationId: string) {
  return db.sentEmail.findMany({
    where: { quotationId },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, status: true, error: true, subject: true, toAddresses: true, ccAddresses: true, attachmentName: true, attachmentSize: true, sentBy: { select: { name: true } } },
  });
}

export type SentEmailRow = Awaited<ReturnType<typeof listSentEmailsForQuotation>>[number];

/** Everything the compose drawer starts from, or null when the quotation cannot be emailed right now. */
export async function getEmailComposeData(quotationId: string) {
  const quotation = await db.quotation.findUnique({
    where: { id: quotationId },
    select: {
      id: true,
      quoteDate: true,
      quoteSeq: true,
      revision: true,
      status: true,
      currencyCode: true,
      vatPercent: true,
      validUntil: true,
      contactName: true,
      paymentTerms: true,
      deliveryTerms: true,
      notes: true,
      customerId: true,
      enquiry: { select: { requesterEmail: true, requesterName: true } },
      lines: { select: { quantity: true, unitPrice: true } },
    },
  });
  if (!quotation) return null;

  // People this could go to: the customer's contacts with an email, the customer's own address, and whoever wrote the enquiry.
  const [contacts, customer] = await Promise.all([
    quotation.customerId
      ? db.customerContact.findMany({ where: { customerId: quotation.customerId, status: { not: "ARCHIVED" }, email: { not: null } }, orderBy: { name: "asc" }, select: { name: true, email: true } })
      : Promise.resolve([]),
    quotation.customerId ? db.customer.findUnique({ where: { id: quotation.customerId }, select: { name: true, email: true } }) : Promise.resolve(null),
  ]);
  const suggestions = new Map<string, string>();
  for (const contact of contacts) if (contact.email) suggestions.set(contact.email.toLowerCase(), contact.name);
  if (customer?.email && !suggestions.has(customer.email.toLowerCase())) suggestions.set(customer.email.toLowerCase(), customer.name);
  if (quotation.enquiry?.requesterEmail && !suggestions.has(quotation.enquiry.requesterEmail.toLowerCase())) suggestions.set(quotation.enquiry.requesterEmail.toLowerCase(), quotation.enquiry.requesterName ?? "Requester");

  return { quotation, recipients: [...suggestions].map(([email, name]) => ({ email, name })) };
}

/** The exact PDF that was attached to a sent email, or null. Read only by the attachment download. */
export async function getSentEmailAttachment(id: string) {
  const row = await db.sentEmail.findUnique({ where: { id }, select: { attachmentName: true, attachmentBytes: true } });
  return row?.attachmentBytes && row.attachmentName ? { name: row.attachmentName, bytes: row.attachmentBytes } : null;
}
