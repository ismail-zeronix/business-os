import { db } from "../../core/database/client";
import type { RecordStatus } from "../../generated/prisma/enums";
import { getProductsIntelligence, type SupplierIntelligenceRow } from "../observations/procurement-queries";
import { findMatchCandidates, type MatchCandidate } from "../products/matching";
import { searchProducts } from "../products/queries";

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
export async function searchProcurement(rawQuery: string): Promise<ProcurementSearch> {
  const q = rawQuery.trim();
  if (!q) return { results: [], total: 0, truncated: false };

  const [candidates, text] = await Promise.all([
    findMatchCandidates(db, { partNumber: q, model: q, description: q }),
    searchProducts({ q, page: 1 }),
  ]);

  const pinned = new Map(candidates.filter((c) => c.strength === "EXACT" || c.strength === "PROBABLE").map((c) => [c.productId, c]));
  const orderedIds = [...new Set([...pinned.keys(), ...text.rows.map((r) => r.id)])];
  const total = Math.max(text.total, orderedIds.length);
  const shownIds = orderedIds.slice(0, MAX_SEARCH_RESULTS);
  if (shownIds.length === 0) return { results: [], total: 0, truncated: false };

  const [products, intelligence] = await Promise.all([
    db.product.findMany({
      where: { id: { in: shownIds } },
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

  const results = shownIds.flatMap((id): SearchResult[] => {
    const p = byId.get(id);
    if (!p) return [];
    const hit = pinned.get(id);
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
        match: hit ? { basis: hit.basis, strength: hit.strength } : null,
        suppliers: intelligence.get(id) ?? [],
      },
    ];
  });

  return { results, total, truncated: total > results.length };
}
