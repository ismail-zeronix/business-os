import { db } from "../../core/database/client";
import { Prisma } from "../../generated/prisma/client";
import type { RecordStatus } from "../../generated/prisma/enums";
import { escapeLike } from "../../lib/like";
import { PAGE_SIZE } from "../../lib/search-params";

export type CustomerListParams = { q?: string; status?: RecordStatus; page: number };

export type CustomerListRow = {
  id: string;
  name: string;
  legalName: string | null;
  emirate: string | null;
  country: string | null;
  status: RecordStatus;
  contactCount: number;
  openEnquiries: number;
  lastEnquiryAt: Date | null;
};

/** Open enquiries and latest enquiry time per customer, for one page of customers. One grouped query (no N+1). */
async function enquiryStatsByCustomer(customerIds: string[]): Promise<Map<string, { open: number; lastAt: Date }>> {
  if (customerIds.length === 0) return new Map();
  const rows = await db.$queryRaw<{ customer_id: string; open_count: bigint; last_at: Date }[]>(Prisma.sql`
    SELECT e.customer_id,
           COUNT(*) FILTER (WHERE e.archived_at IS NULL AND e.status NOT IN ('WON', 'LOST')) AS open_count,
           MAX(s.observed_at) AS last_at
    FROM enquiries e
    JOIN evidence_sources s ON s.id = e.evidence_source_id
    WHERE e.customer_id = ANY(${customerIds}::uuid[])
    GROUP BY e.customer_id`);
  return new Map(rows.map((r) => [r.customer_id, { open: Number(r.open_count), lastAt: r.last_at }]));
}

/** Server-side filtered, paginated customer list. Archived customers are hidden unless the Archived status is chosen. */
export async function listCustomers(params: CustomerListParams): Promise<{ rows: CustomerListRow[]; total: number }> {
  const q = params.q?.trim();
  const contains = (value: string) => ({ contains: escapeLike(value), mode: "insensitive" as const });

  const where: Prisma.CustomerWhereInput = {
    AND: [
      params.status ? { status: params.status } : { status: { not: "ARCHIVED" } },
      q
        ? {
            OR: [
              { name: contains(q) },
              { legalName: contains(q) },
              { emirate: contains(q) },
              { country: contains(q) },
              { email: contains(q) },
              { contacts: { some: { OR: [{ name: contains(q) }, { email: contains(q) }, { phone: contains(q) }, { whatsapp: contains(q) }] } } },
            ],
          }
        : {},
    ],
  };

  const [customers, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        legalName: true,
        emirate: true,
        country: true,
        status: true,
        _count: { select: { contacts: { where: { status: { not: "ARCHIVED" } } } } },
      },
    }),
    db.customer.count({ where }),
  ]);

  const stats = await enquiryStatsByCustomer(customers.map((c) => c.id));
  return {
    total,
    rows: customers.map((c) => ({
      id: c.id,
      name: c.name,
      legalName: c.legalName,
      emirate: c.emirate,
      country: c.country,
      status: c.status,
      contactCount: c._count.contacts,
      openEnquiries: stats.get(c.id)?.open ?? 0,
      lastEnquiryAt: stats.get(c.id)?.lastAt ?? null,
    })),
  };
}

export async function getCustomer(id: string) {
  return db.customer.findUnique({ where: { id } });
}

/** Contacts of a customer. Archived contacts are included only when asked for. */
export async function listCustomerContacts(customerId: string, opts: { includeArchived?: boolean } = {}) {
  return db.customerContact.findMany({
    where: { customerId, ...(opts.includeArchived ? {} : { status: { not: "ARCHIVED" } }) },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

export async function countCustomerContacts(customerId: string): Promise<number> {
  return db.customerContact.count({ where: { customerId, status: { not: "ARCHIVED" } } });
}

/** Active customers for pickers (id + name), plus `alsoId` so a currently-selected inactive one is still shown. */
export async function listCustomerOptions(alsoId?: string) {
  const rows = await db.customer.findMany({
    where: { OR: [{ status: "ACTIVE" }, ...(alsoId ? [{ id: alsoId }] : [])] },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

/** Contacts of active customers for pickers. Each carries its customerId so a form can filter by the chosen customer without a round trip. */
export async function listCustomerContactOptions() {
  const rows = await db.customerContact.findMany({
    where: { status: { not: "ARCHIVED" }, customer: { status: "ACTIVE" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, jobTitle: true, customerId: true },
  });
  return rows.map((r) => ({ customerId: r.customerId, value: r.id, label: r.jobTitle ? `${r.name} · ${r.jobTitle}` : r.name }));
}

/**
 * The customer contact whose email equals `email` (case-insensitive), or null. Used to recognise a known customer from an email
 * sender. Archived contacts and customers are ignored.
 */
export async function findKnownCustomerByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const contact = await db.customerContact.findFirst({
    where: { normalizedEmail: normalized, status: { not: "ARCHIVED" }, customer: { status: { not: "ARCHIVED" } } },
    orderBy: [{ customer: { name: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, customer: { select: { id: true, name: true } } },
  });
  return contact ? { customerId: contact.customer.id, customerName: contact.customer.name, contactId: contact.id, contactName: contact.name } : null;
}
