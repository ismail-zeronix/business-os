import { db } from "../../core/database/client";
import type { Prisma } from "../../generated/prisma/client";
import type { RecordStatus } from "../../generated/prisma/enums";
import { escapeLike } from "../../lib/like";
import { normalizeCode } from "../../lib/normalize";
import { PAGE_SIZE } from "../../lib/search-params";
import { observationSummaryByProduct } from "../observations/queries";

export type ProductListParams = {
  q?: string;
  brandId?: string;
  categoryId?: string;
  status?: RecordStatus;
  temporaryOnly?: boolean;
  page: number;
};

export type ProductListRow = {
  id: string;
  name: string;
  partNumber: string | null;
  brandName: string | null;
  categoryName: string | null;
  isTemporary: boolean;
  status: RecordStatus;
  supplierCount: number;
  latestObservedAt: Date | null;
};

const MAX_TOKENS = 6;
const MIN_CODE_LENGTH = 3;

/** One search word must match at least one of the product's identifying fields, in readable or normalised form. */
function tokenClause(token: string): Prisma.ProductWhereInput {
  const contains = { contains: escapeLike(token), mode: "insensitive" as const };
  const code = normalizeCode(token);
  const anyOf: Prisma.ProductWhereInput[] = [
    { name: contains },
    { family: contains },
    { model: contains },
    { partNumber: contains },
    { manufacturerSku: contains },
    { brand: { name: contains } },
    { category: { name: contains } },
    { aliases: { some: { alias: contains } } },
  ];
  // Code-like words are also compared in normalised form, so "83a100-suak" finds "83A100SUAK" and "v15 g4" finds an alias "V15G4".
  if (code.length >= MIN_CODE_LENGTH) {
    anyOf.push({ normalizedPartNumber: { contains: code } }, { normalizedModel: { contains: code } }, { aliases: { some: { normalizedAlias: { contains: code } } } });
  }
  return { OR: anyOf };
}

/**
 * Product search: the query is split into words and EVERY word must match somewhere (name, brand, category, family, model, part number,
 * SKU, alias). "dell 5440" therefore finds a Dell product whose model is 5440. Archived products are hidden unless asked for.
 */
export async function searchProducts(params: ProductListParams): Promise<{ rows: ProductListRow[]; total: number }> {
  const tokens = (params.q ?? "").split(/\s+/).filter(Boolean).slice(0, MAX_TOKENS);

  const where: Prisma.ProductWhereInput = {
    AND: [
      params.status ? { status: params.status } : { status: { not: "ARCHIVED" } },
      params.brandId ? { brandId: params.brandId } : {},
      params.categoryId ? { categoryId: params.categoryId } : {},
      params.temporaryOnly ? { isTemporary: true } : {},
      ...tokens.map(tokenClause),
    ],
  };

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        partNumber: true,
        isTemporary: true,
        status: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    db.product.count({ where }),
  ]);

  const summaries = await observationSummaryByProduct(products.map((p) => p.id));

  return {
    total,
    rows: products.map((p) => ({
      id: p.id,
      name: p.name,
      partNumber: p.partNumber,
      brandName: p.brand?.name ?? null,
      categoryName: p.category?.name ?? null,
      isTemporary: p.isTemporary,
      status: p.status,
      supplierCount: summaries.get(p.id)?.supplierCount ?? 0,
      latestObservedAt: summaries.get(p.id)?.latestObservedAt ?? null,
    })),
  };
}

export async function getProduct(id: string) {
  return db.product.findUnique({
    where: { id },
    include: {
      brand: { select: { id: true, name: true, status: true } },
      category: { select: { id: true, name: true, status: true } },
      aliases: { orderBy: { alias: "asc" }, select: { id: true, alias: true, source: true, createdAt: true } },
    },
  });
}

export type ProductPickerRow = { id: string; name: string; partNumber: string | null; brandName: string | null };

/** Small, fast product lookup for pickers (e.g. linking a broadcast item). Same word-by-word matching as the main search; at most `limit` rows. */
export async function searchProductOptions(q: string, limit = 8): Promise<ProductPickerRow[]> {
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, MAX_TOKENS);
  if (tokens.length === 0) return [];
  const rows = await db.product.findMany({
    where: { AND: [{ status: { not: "ARCHIVED" } }, ...tokens.map(tokenClause)] },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true, name: true, partNumber: true, brand: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, partNumber: r.partNumber, brandName: r.brand?.name ?? null }));
}
