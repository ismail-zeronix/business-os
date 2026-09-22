import { db } from "../../core/database/client";
import { normalizeName } from "../../lib/normalize";
import { getProductIntelligence, type SupplierIntelligenceRow } from "../observations/procurement-queries";

export type ItemIntelligence = {
  /** What each supplier most recently said about the linked product (latest price and stock, with age and evidence). */
  offers: SupplierIntelligenceRow[];
  /** Active suppliers who handle the item's brand: "who normally supplies this", useful even with no observations yet. */
  coverage: { supplierId: string; name: string }[];
};

/**
 * "What do we already know?" for one requirement. Reads existing supplier intelligence only (no writes, nothing invented): the latest
 * observations for the linked product, and the suppliers whose brand focus matches. With no linked product there are no offers.
 */
export async function getItemIntelligence(item: { productId: string | null; productBrandId?: string | null; brandText: string | null }): Promise<ItemIntelligence> {
  const offers = item.productId ? await getProductIntelligence(item.productId) : [];

  let brandId = item.productBrandId ?? null;
  if (!brandId && item.brandText) {
    brandId = (await db.brand.findUnique({ where: { normalizedName: normalizeName(item.brandText) }, select: { id: true } }))?.id ?? null;
  }
  const coverage = brandId
    ? await db.supplier.findMany({ where: { status: "ACTIVE", brands: { some: { brandId } } }, orderBy: { name: "asc" }, take: 8, select: { id: true, name: true } })
    : [];

  return { offers, coverage: coverage.map((s) => ({ supplierId: s.id, name: s.name })) };
}
