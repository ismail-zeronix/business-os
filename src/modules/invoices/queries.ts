import { db } from "../../core/database/client";
import type { Prisma } from "../../generated/prisma/client";
import type { InvoiceStatus } from "../../generated/prisma/enums";
import type { OwnerActor } from "../customers/queries";
import { escapeLike } from "../../lib/like";
import { PAGE_SIZE } from "../../lib/search-params";
import { computeTotals } from "../quotations/pricing";

export type InvoiceListParams = { q?: string; status?: InvoiceStatus; page: number };

export type InvoiceListRow = {
  id: string;
  invoiceDate: Date;
  invoiceSeq: number;
  status: InvoiceStatus;
  customerName: string | null;
  currencyCode: string;
  dueDate: Date | null;
  updatedAt: Date;
  quotation: { id: string; quoteDate: Date; quoteSeq: number; revision: number };
  lineCount: number;
  total: string;
};

/** Same rule as quotations/queries.ts: follows the linked customer's owner, plus the invoice's own creator/issuer, plus ADMIN. */
function visibilityWhere(actor: OwnerActor): Prisma.InvoiceWhereInput {
  if (actor.role === "ADMIN") return {};
  return { OR: [{ customer: { ownerId: null } }, { customer: { ownerId: actor.id } }, { createdById: actor.id }, { issuedById: actor.id }] };
}

function listWhere(params: InvoiceListParams, actor: OwnerActor): Prisma.InvoiceWhereInput {
  const q = params.q?.trim();
  const contains = (value: string) => ({ contains: escapeLike(value), mode: "insensitive" as const });
  // INV-20260921-0001 (or 20260921-0001) finds one invoice; a bare counter such as 0001 or 1 finds that counter on any day.
  const full = q ? /^(?:INV-?)?(\d{4})(\d{2})(\d{2})-?(\d{1,4})$/i.exec(q) : null;
  const counter = q && !full ? /^(?:INV-?)?(\d{1,4})$/i.exec(q)?.[1] : undefined;
  return {
    AND: [
      visibilityWhere(actor),
      params.status ? { status: params.status } : {},
      q
        ? {
            OR: [
              ...(full ? [{ invoiceDate: new Date(`${full[1]}-${full[2]}-${full[3]}T00:00:00Z`), invoiceSeq: Number(full[4]) }] : []),
              ...(counter ? [{ invoiceSeq: Number(counter) }] : []),
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
export async function listInvoices(params: InvoiceListParams, actor: OwnerActor): Promise<{ rows: InvoiceListRow[]; total: number }> {
  const where = listWhere(params, actor);
  const [invoices, total] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        invoiceDate: true,
        invoiceSeq: true,
        status: true,
        customerName: true,
        currencyCode: true,
        vatPercent: true,
        dueDate: true,
        updatedAt: true,
        quotation: { select: { id: true, quoteDate: true, quoteSeq: true, revision: true } },
        lines: { select: { quantity: true, unitPrice: true } },
      },
    }),
    db.invoice.count({ where }),
  ]);
  return {
    total,
    rows: invoices.map((invoice) => {
      const totals = computeTotals(invoice.lines, invoice.vatPercent);
      return {
        id: invoice.id,
        invoiceDate: invoice.invoiceDate,
        invoiceSeq: invoice.invoiceSeq,
        status: invoice.status,
        customerName: invoice.customerName,
        currencyCode: invoice.currencyCode,
        dueDate: invoice.dueDate,
        updatedAt: invoice.updatedAt,
        quotation: invoice.quotation,
        lineCount: invoice.lines.length,
        total: totals.total,
      };
    }),
  };
}

/** The Sales-module detail view. Null when the invoice does not exist OR the actor cannot see it (same as "not found" to the page). */
export async function getInvoice(id: string, actor: OwnerActor) {
  return db.invoice.findFirst({
    where: { AND: [{ id }, visibilityWhere(actor)] },
    include: {
      quotation: { select: { id: true, quoteDate: true, quoteSeq: true, revision: true } },
      customer: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      issuedBy: { select: { name: true } },
      lines: { orderBy: { position: "asc" } },
    },
  });
}

export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;
export type InvoiceLineDetail = InvoiceDetail["lines"][number];
