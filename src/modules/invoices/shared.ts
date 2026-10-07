import type { ServiceContext } from "../../core/database/tx";
import { parseDateOnly, todayInBusinessZone } from "../quotations/shared";

type InvoiceRef = { invoiceDate: Date; invoiceSeq: number };

/** The reference people see: INV-20260921-0001, the day it was made (business timezone) and that day's counter. No revisions, unlike Quotation. */
export const invoiceReference = (i: InvoiceRef): string => `INV-${i.invoiceDate.toISOString().slice(0, 10).replaceAll("-", "")}-${String(i.invoiceSeq).padStart(4, "0")}`;

/** Invoice changes are audited on the invoice itself, so its own Activity shows them. */
export const invoiceScope = (invoiceId: string) => ({ type: "Invoice" as const, id: invoiceId });

const INVOICE_REFERENCE_LOCK = 7_420_018; // distinct from quotations/shared.ts's QUOTATION_REFERENCE_LOCK (7_420_017)

/**
 * The next reference for a new invoice: today's date (business timezone) and the next counter for that day. Takes an
 * advisory lock for the rest of the transaction, so two invoices created at the same moment cannot get the same number.
 */
export async function nextInvoiceReference(c: ServiceContext): Promise<{ invoiceDate: Date; invoiceSeq: number }> {
  await c.db.$executeRaw`SELECT pg_advisory_xact_lock(${INVOICE_REFERENCE_LOCK})`;
  const invoiceDate = parseDateOnly(todayInBusinessZone()) as Date;
  const last = await c.db.invoice.aggregate({ where: { invoiceDate }, _max: { invoiceSeq: true } });
  return { invoiceDate, invoiceSeq: (last._max.invoiceSeq ?? 0) + 1 };
}
