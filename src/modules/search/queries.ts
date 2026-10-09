import { db } from "../../core/database/client";
import type { RecordStatus } from "../../generated/prisma/enums";
import { getFreshnessBand } from "../../lib/freshness";
import { getProductsIntelligence, type SupplierIntelligenceRow } from "../observations/procurement-queries";
import { findMatchCandidates, type MatchCandidate } from "../products/matching";
import { searchProducts } from "../products/queries";
import { canonicalModelKey } from "../specs/model-key";
import type { SearchFilters } from "./filters";

/** Most products shown for one search. More matches than this means the person should refine the query, not page through them. */
export const MAX_SEARCH_RESULTS = 20;

export type SearchResult = {
  id: string;
  name: string;
  partNumber: string | null;
  brandName: string | null;
  categoryName: string | null;
  isTemporary: boolean;
  status: RecordStatus;
  aliases: string[];
  /** Set when the product was pinned by an exact part-number, model or alias hit; null when it only matched the words. */
  match: Pick<MatchCandidate, "basis" | "strength"> | null;
  suppliers: SupplierIntelligenceRow[];
};

export type ProcurementSearch = { results: SearchResult[]; total: number; truncated: boolean };

/**
 * Procurement search: matched products with what every supplier has most recently said about each. Read-only.
 * Exact and probable hits from the deterministic matcher (part number, model, alias) come first and say why; the word-by-word product
 * search fills the rest. Nothing here decides which product a person "meant": it lists, it does not pick.
 */
export async function searchProcurement(rawQuery: string, filters: SearchFilters = {}): Promise<ProcurementSearch> {
  const q = rawQuery.trim();
  if (!q) return { results: [], total: 0, truncated: false };

  const modelKey = canonicalModelKey(q);
  const [candidates, text, sameModel] = await Promise.all([
    findMatchCandidates(db, { partNumber: q, model: q, description: q }),
    searchProducts({ q, page: 1 }),
    // "E14 Gen 7" and "E14 G7" are one model: products that share the canonical model key are listed as possible matches (never as pinned ones).
    modelKey ? db.product.findMany({ where: { modelKey, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, take: MAX_SEARCH_RESULTS, select: { id: true } }) : Promise.resolve([]),
  ]);

  const pinned = new Map(candidates.filter((c) => c.strength === "EXACT" || c.strength === "PROBABLE").map((c) => [c.productId, c]));
  const sameModelIds = new Set(sameModel.map((p) => p.id));
  const orderedIds = [...new Set([...pinned.keys(), ...sameModelIds, ...text.rows.map((r) => r.id)])];
  const total = Math.max(text.total, orderedIds.length);
  const shownIds = orderedIds.slice(0, MAX_SEARCH_RESULTS);
  if (shownIds.length === 0) return { results: [], total: 0, truncated: false };

  // Brand/category narrow the FINAL product fetch, so any match type (pinned part-number/model/alias hit, same-model hit, or
  // word-search hit) that doesn't belong to the chosen brand/category is excluded: the `byId.get(id)` guard below drops it.
  const [products, intelligence] = await Promise.all([
    db.product.findMany({
      where: { id: { in: shownIds }, ...(filters.brandId ? { brandId: filters.brandId } : {}), ...(filters.categoryId ? { categoryId: filters.categoryId } : {}) },
      select: {
        id: true,
        name: true,
        partNumber: true,
        isTemporary: true,
        status: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
        aliases: { orderBy: { alias: "asc" }, select: { alias: true } },
      },
    }),
    getProductsIntelligence(shownIds),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));

  // Supplier/stock/freshness filter each result's own supplier rows (never the matching query). When active, a result whose
  // suppliers are all filtered out is dropped entirely: an empty offers table is noise, not a result.
  const now = new Date();
  const supplierFilterActive = Boolean(filters.supplierId || filters.stock || filters.freshness);

  const results = shownIds.flatMap((id): SearchResult[] => {
    const p = byId.get(id);
    if (!p) return [];
    const hit = pinned.get(id);
    let suppliers = intelligence.get(id) ?? [];
    if (supplierFilterActive) {
      suppliers = suppliers.filter((s) => {
        if (filters.supplierId && s.supplierId !== filters.supplierId) return false;
        if (filters.stock && s.stock?.status !== filters.stock) return false;
        if (filters.freshness && getFreshnessBand(s.latestObservedAt, now) !== filters.freshness) return false;
        return true;
      });
      if (suppliers.length === 0) return [];
    }
    return [
      {
        id: p.id,
        name: p.name,
        partNumber: p.partNumber,
        brandName: p.brand?.name ?? null,
        categoryName: p.category?.name ?? null,
        isTemporary: p.isTemporary,
        status: p.status,
        aliases: p.aliases.map((a) => a.alias),
        match: hit ? { basis: hit.basis, strength: hit.strength } : sameModelIds.has(id) ? { basis: "MODEL" as const, strength: "POSSIBLE" as const } : null,
        suppliers,
      },
    ];
  });

  // Any active filter changes which products qualify, so the original unfiltered total/truncation no longer describes this set.
  const anyFilterActive = Boolean(filters.brandId || filters.categoryId || filters.supplierId || filters.stock || filters.freshness);
  return anyFilterActive ? { results, total: results.length, truncated: false } : { results, total, truncated: total > results.length };
}
