import { db } from "../../core/database/client";
import type { Prisma } from "../../generated/prisma/client";
import type { RecordStatus } from "../../generated/prisma/enums";
import { escapeLike } from "../../lib/like";
import { normalizeCode } from "../../lib/normalize";
import { PAGE_SIZE } from "../../lib/search-params";
import { observationSummaryByProduct, type LatestPriceSummary } from "../observations/queries";
import { describeAttributes } from "../specs/format";

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
  description: string | null;
  model: string | null;
  partNumber: string | null;
  brandName: string | null;
  categoryName: string | null;
  isTemporary: boolean;
  status: RecordStatus;
  supplierName: string | null;
  supplierCount: number;
  latestObservedAt: Date | null;
  latestPrice: LatestPriceSummary | null;
  /** Top 2 specs as "Label: value" phrases, e.g. "RAM: 16 GB · Storage: 512 GB". Null when the product has no active attributes. */
  specSummary: string | null;
};

const MAX_TOKENS = 6;
const MIN_CODE_LENGTH = 3;

/** One search word must match at least one of the product's identifying fields, in readable or normalised form. */
function tokenClause(token: string): Prisma.ProductWhereInput {
  const contains = { contains: escapeLike(token), mode: "insensitive" as const };
  const code = normalizeCode(token);
  const anyOf: Prisma.ProductWhereInput[] = [
    { name: contains },
    { description: contains },
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
        description: true,
        model: true,
        partNumber: true,
        isTemporary: true,
        status: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    db.product.count({ where }),
  ]);

  const ids = products.map((p) => p.id);
  const [summaries, attributeRows] = await Promise.all([
    observationSummaryByProduct(ids),
    db.productAttribute.findMany({
      where: { productId: { in: ids }, retractedAt: null },
      select: { productId: true, attributeKey: true, valueText: true, valueNum: true, valueList: true, unit: true },
    }),
  ]);

  const attributesByProduct = new Map<string, typeof attributeRows>();
  for (const row of attributeRows) {
    const rows = attributesByProduct.get(row.productId) ?? [];
    rows.push(row);
    attributesByProduct.set(row.productId, rows);
  }
  const specSummaryByProduct = new Map<string, string | null>();
  for (const id of ids) {
    const rows = attributesByProduct.get(id) ?? [];
    const described = describeAttributes(rows.map((r) => ({ ...r, valueNum: r.valueNum === null ? null : Number(r.valueNum) }))).slice(0, 2);
    specSummaryByProduct.set(id, described.length > 0 ? described.join(" · ") : null);
  }

  return {
    total,
    rows: products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      model: p.model,
      partNumber: p.partNumber,
      brandName: p.brand?.name ?? null,
      categoryName: p.category?.name ?? null,
      isTemporary: p.isTemporary,
      status: p.status,
      supplierName: summaries.get(p.id)?.latestSupplierName ?? null,
      supplierCount: summaries.get(p.id)?.supplierCount ?? 0,
      latestObservedAt: summaries.get(p.id)?.latestObservedAt ?? null,
      latestPrice: summaries.get(p.id)?.latestPrice ?? null,
      specSummary: specSummaryByProduct.get(p.id) ?? null,
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
      attributes: { where: { retractedAt: null }, select: { id: true, attributeKey: true, rawValue: true, valueText: true, valueNum: true, valueList: true, unit: true, confidence: true, source: true } },
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
