import type { ServiceContext } from "../../core/database/tx";
import { InvariantError } from "../../core/errors";
import { requireNotArchived, touchEnquiry } from "../enquiries/shared";
import { toZonedInputValue } from "../../lib/format";

type QuotationRef = { quoteDate: Date; quoteSeq: number };

/** The reference people see: QUO-20260921-0001, the day it was made (business timezone) and that day's 4-digit counter. */
export const quotationReference = (q: QuotationRef): string => `QUO-${q.quoteDate.toISOString().slice(0, 10).replaceAll("-", "")}-${String(q.quoteSeq).padStart(4, "0")}`;

/** The reference, with " rev 2" from the second revision on. */
export const quotationLabel = (q: QuotationRef & { revision: number }): string => (q.revision > 1 ? `${quotationReference(q)} rev ${q.revision}` : quotationReference(q));

/** Quotation changes are audited on the quotation itself, so its own Activity shows them. */
export const quotationScope = (quotationId: string) => ({ type: "Quotation" as const, id: quotationId });

export const NOT_DRAFT_MESSAGE = "This quotation is issued and cannot be changed. Revise it to make changes.";

export function requireDraft(quotation: { status: string }): void {
  if (quotation.status !== "DRAFT") throw new InvariantError(NOT_DRAFT_MESSAGE);
}

/** A manual quotation has no enquiry, so there is nothing to be archived. */
export function requireEnquiryOpen(enquiry: { archivedAt: Date | null } | null): void {
  if (enquiry) requireNotArchived(enquiry);
}

/** Marks the quotation's enquiry as just worked on, when it has one. */
export async function touchEnquiryIfAny(c: ServiceContext, enquiryId: string | null): Promise<void> {
  if (enquiryId) await touchEnquiry(c, enquiryId);
}

/**
 * The next reference for a new quotation: today's date (business timezone) and the next counter for that day. Takes an advisory lock for the
 * rest of the transaction, so two people creating a quotation at the same moment cannot get the same number.
 */
export async function nextQuotationReference(c: ServiceContext): Promise<{ quoteDate: Date; quoteSeq: number }> {
  await c.db.$executeRaw`SELECT pg_advisory_xact_lock(${QUOTATION_REFERENCE_LOCK})`;
  const quoteDate = parseDateOnly(todayInBusinessZone()) as Date;
  const last = await c.db.quotation.aggregate({ where: { quoteDate }, _max: { quoteSeq: true } });
  return { quoteDate, quoteSeq: (last._max.quoteSeq ?? 0) + 1 };
}

const QUOTATION_REFERENCE_LOCK = 7_420_017;

/** Today's calendar date in the business timezone, "2026-09-21". Compared as text with an <input type="date"> value. */
export const todayInBusinessZone = (now: Date = new Date()): string => toZonedInputValue(now).slice(0, 10);

/** A DATE column value as "2026-09-21". */
export const dateOnly = (date: Date | null): string | null => (date ? date.toISOString().slice(0, 10) : null);

/** A "2026-09-21" text as the UTC-midnight instant Prisma stores in a DATE column. */
export const parseDateOnly = (value: string | null): Date | null => (value ? new Date(`${value}T00:00:00Z`) : null);
