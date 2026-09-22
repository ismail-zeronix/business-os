import { db } from "../../core/database/client";
import { Prisma } from "../../generated/prisma/client";
import type { RecordStatus, SupplierType } from "../../generated/prisma/enums";
import { escapeLike } from "../../lib/like";
import { PAGE_SIZE } from "../../lib/search-params";

export type SupplierListParams = {
  q?: string;
  status?: RecordStatus;
  type?: SupplierType;
  brandId?: string;
  categoryId?: string;
  page: number;
};

export type SupplierListRow = {
  id: string;
  name: string;
  legalName: string | null;
  type: SupplierType | null;
  emirate: string | null;
  country: string | null;
  paymentTerms: string | null;
  status: RecordStatus;
  brands: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  lastEvidenceAt: Date | null;
};

/** Latest evidence time per supplier, over its non-archived broadcasts. One grouped query for the whole page (no N+1). */
export async function lastEvidenceBySupplier(supplierIds: string[]): Promise<Map<string, Date>> {
  if (supplierIds.length === 0) return new Map();
  const rows = await db.$queryRaw<{ supplier_id: string; last_observed_at: Date }[]>(Prisma.sql`
    SELECT b.supplier_id, MAX(e.observed_at) AS last_observed_at
    FROM broadcasts b
    JOIN evidence_sources e ON e.id = b.evidence_source_id
    WHERE b.supplier_id = ANY(${supplierIds}::uuid[]) AND b.archived_at IS NULL
    GROUP BY b.supplier_id`);
  return new Map(rows.map((r) => [r.supplier_id, r.last_observed_at]));
}

/** Server-side filtered, paginated supplier list. By default archived suppliers are hidden; choose the Archived status to see them. */
export async function listSuppliers(params: SupplierListParams): Promise<{ rows: SupplierListRow[]; total: number }> {
  const q = params.q?.trim();
  const contains = (value: string) => ({ contains: escapeLike(value), mode: "insensitive" as const });

  const where: Prisma.SupplierWhereInput = {
    AND: [
      params.status ? { status: params.status } : { status: { not: "ARCHIVED" } },
      params.type ? { type: params.type } : {},
      params.brandId ? { brands: { some: { brandId: params.brandId } } } : {},
      params.categoryId ? { categories: { some: { categoryId: params.categoryId } } } : {},
      q
        ? {
            OR: [
              { name: contains(q) },
              { legalName: contains(q) },
              { code: contains(q) },
              { emirate: contains(q) },
              { country: contains(q) },
              { area: contains(q) },
              { paymentTerms: contains(q) },
              { brands: { some: { brand: { name: contains(q) } } } },
              { categories: { some: { category: { name: contains(q) } } } },
              { contacts: { some: { OR: [{ name: contains(q) }, { email: contains(q) }, { phone: contains(q) }, { whatsapp: contains(q) }] } } },
            ],
          }
        : {},
    ],
  };

  const [suppliers, total] = await Promise.all([
    db.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        legalName: true,
        type: true,
        emirate: true,
        country: true,
        paymentTerms: true,
        status: true,
        brands: { select: { brand: { select: { id: true, name: true } } }, orderBy: { brand: { name: "asc" } } },
        categories: { select: { category: { select: { id: true, name: true } } }, orderBy: { category: { name: "asc" } } },
      },
    }),
    db.supplier.count({ where }),
  ]);

  const lastEvidence = await lastEvidenceBySupplier(suppliers.map((s) => s.id));

  return {
    total,
    rows: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      legalName: s.legalName,
      type: s.type,
      emirate: s.emirate,
      country: s.country,
      paymentTerms: s.paymentTerms,
      status: s.status,
      brands: s.brands.map((b) => b.brand),
      categories: s.categories.map((c) => c.category),
      lastEvidenceAt: lastEvidence.get(s.id) ?? null,
    })),
  };
}

export async function getSupplier(id: string) {
  return db.supplier.findUnique({
    where: { id },
    include: {
      brands: { select: { brand: { select: { id: true, name: true, status: true } } }, orderBy: { brand: { name: "asc" } } },
      categories: { select: { category: { select: { id: true, name: true, status: true } } }, orderBy: { category: { name: "asc" } } },
    },
  });
}

/** Contacts of a supplier, with their brands/categories. Archived contacts are included only when asked for. */
export async function listContacts(supplierId: string, opts: { includeArchived?: boolean } = {}) {
  return db.supplierContact.findMany({
    where: { supplierId, ...(opts.includeArchived ? {} : { status: { not: "ARCHIVED" } }) },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      brands: { select: { brand: { select: { id: true, name: true } } }, orderBy: { brand: { name: "asc" } } },
      categories: { select: { category: { select: { id: true, name: true } } }, orderBy: { category: { name: "asc" } } },
    },
  });
}

/** Number of non-archived contacts, for the tab label. */
export async function countContacts(supplierId: string): Promise<number> {
  return db.supplierContact.count({ where: { supplierId, status: { not: "ARCHIVED" } } });
}

/** Active suppliers for pickers (id + name), plus `alsoId` so a currently-selected inactive one is still shown. */
export async function listSupplierOptions(alsoId?: string) {
  const rows = await db.supplier.findMany({
    where: { OR: [{ status: "ACTIVE" }, ...(alsoId ? [{ id: alsoId }] : [])] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, legalName: true },
  });
  // `legalName` lets a message that names the company by its legal name ("FIRST OPTION GENERAL TRADING LLC") still find the supplier.
  return rows.map((r) => ({ value: r.id, label: r.name, legalName: r.legalName }));
}

/** Contacts of active suppliers for pickers. Each carries its supplierId so a form can filter by the chosen supplier without a round trip. */
export async function listContactOptions() {
  const rows = await db.supplierContact.findMany({
    where: { status: { not: "ARCHIVED" }, supplier: { status: "ACTIVE" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, jobTitle: true, supplierId: true },
  });
  return rows.map((r) => ({ supplierId: r.supplierId, value: r.id, label: r.jobTitle ? `${r.name} · ${r.jobTitle}` : r.name, name: r.name }));
}
