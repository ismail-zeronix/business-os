import { db } from "../../core/database/client";

export type MasterDataRow = {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  supplierCount: number;
  productCount: number;
};

/** Brands for the Settings table, with usage counts. Archived rows are included so they can be restored. */
export async function listBrands(): Promise<MasterDataRow[]> {
  const rows = await db.brand.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true, _count: { select: { suppliers: true, products: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, status: r.status, supplierCount: r._count.suppliers, productCount: r._count.products }));
}

export async function listCategories(): Promise<MasterDataRow[]> {
  const rows = await db.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true, _count: { select: { suppliers: true, products: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, status: r.status, supplierCount: r._count.suppliers, productCount: r._count.products }));
}

export type Option = { value: string; label: string };

/**
 * Options for pickers. Only ACTIVE entries, plus any `alsoIds` (already-selected ones) so an archived brand that a supplier still has
 * is shown (marked archived) and is not silently dropped when the form is saved.
 */
export async function listBrandOptions(alsoIds: string[] = []): Promise<Option[]> {
  const rows = await db.brand.findMany({
    where: { OR: [{ status: "ACTIVE" }, ...(alsoIds.length ? [{ id: { in: alsoIds } }] : [])] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true },
  });
  return rows.map((r) => ({ value: r.id, label: r.status === "ARCHIVED" ? `${r.name} (archived)` : r.name }));
}

export async function listCategoryOptions(alsoIds: string[] = []): Promise<Option[]> {
  const rows = await db.category.findMany({
    where: { OR: [{ status: "ACTIVE" }, ...(alsoIds.length ? [{ id: { in: alsoIds } }] : [])] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true },
  });
  return rows.map((r) => ({ value: r.id, label: r.status === "ARCHIVED" ? `${r.name} (archived)` : r.name }));
}
