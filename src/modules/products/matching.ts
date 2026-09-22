import type { Db } from "../../core/database/tx";
import type { MatchBasis } from "../../generated/prisma/enums";
import { normalizeCode, normalizeCodeOrNull, normalizeName } from "../../lib/normalize";

/**
 * Product matching for broadcast items. Deterministic layers only (docs/modules/PRODUCTS.md); fuzzy and LLM matching are later layers.
 *   1. exact normalised part number            -> EXACT      (basis PART_NUMBER)
 *   2. exact normalised model (brand-checked)  -> PROBABLE / POSSIBLE (basis MODEL)
 *   3. known alias                             -> PROBABLE / POSSIBLE (basis ALIAS)
 *   4. manual selection, or an automatic new product when nothing else matches -> decided by the caller, not produced here
 * This module only PROPOSES candidates. It never confirms anything; a person does.
 */

export type MatchStrength = "EXACT" | "PROBABLE" | "POSSIBLE";

export type MatchInput = {
  partNumber?: string | null;
  model?: string | null;
  brandText?: string | null;
  description?: string | null;
};

export type MatchCandidate = {
  productId: string;
  name: string;
  partNumber: string | null;
  brandName: string | null;
  basis: Extract<MatchBasis, "PART_NUMBER" | "MODEL" | "ALIAS">;
  strength: MatchStrength;
};

const STRENGTH_RANK: Record<MatchStrength, number> = { EXACT: 3, PROBABLE: 2, POSSIBLE: 1 };

const productSelect = { id: true, name: true, partNumber: true, brand: { select: { name: true, normalizedName: true } } } as const;
type ProductRow = { id: string; name: string; partNumber: string | null; brand: { name: string; normalizedName: string } | null };

const notArchived = { status: { not: "ARCHIVED" as const } };

/** A brand written in the broadcast that contradicts the product's brand rules that product out. Unknown on either side does not. */
function brandConflicts(brandKey: string | null, product: ProductRow): boolean {
  return Boolean(brandKey && product.brand && product.brand.normalizedName !== brandKey);
}

export async function findMatchCandidates(db: Db, input: MatchInput): Promise<MatchCandidate[]> {
  const found = new Map<string, MatchCandidate>();
  const propose = (product: ProductRow, basis: MatchCandidate["basis"], strength: MatchStrength) => {
    const previous = found.get(product.id);
    if (previous && STRENGTH_RANK[previous.strength] >= STRENGTH_RANK[strength]) return;
    found.set(product.id, { productId: product.id, name: product.name, partNumber: product.partNumber, brandName: product.brand?.name ?? null, basis, strength });
  };

  const brandKey = input.brandText?.trim() ? normalizeName(input.brandText) : null;
  const partNumberKey = normalizeCodeOrNull(input.partNumber);
  const modelKey = normalizeCodeOrNull(input.model);

  // Layer 1: exact part number (the product's own, then an alias that is the part number).
  if (partNumberKey) {
    const own = await db.product.findFirst({ where: { normalizedPartNumber: partNumberKey, ...notArchived }, select: productSelect });
    if (own) propose(own, "PART_NUMBER", "EXACT");

    const viaAlias = await db.productAlias.findMany({ where: { normalizedAlias: partNumberKey, product: notArchived }, select: { product: { select: productSelect } } });
    for (const row of viaAlias) propose(row.product, "ALIAS", "PROBABLE");
  }

  // Layer 2: exact model. A matching brand makes it PROBABLE; unknown brand on either side leaves it POSSIBLE.
  if (modelKey) {
    const byModel = await db.product.findMany({ where: { normalizedModel: modelKey, ...notArchived }, select: productSelect });
    for (const product of byModel) {
      if (brandConflicts(brandKey, product)) continue;
      const brandAgrees = Boolean(brandKey && product.brand && product.brand.normalizedName === brandKey);
      propose(product, "MODEL", brandAgrees ? "PROBABLE" : "POSSIBLE");
    }
  }

  // Layer 3: known aliases, trying the model, "brand+model" ("DELL5440") and the full description as written.
  const aliasKeys = [...new Set([modelKey, brandKey && modelKey ? normalizeCode(brandKey) + modelKey : null, normalizeCodeOrNull(input.description)].filter((k): k is string => Boolean(k)))];
  if (aliasKeys.length) {
    const rows = await db.productAlias.findMany({ where: { normalizedAlias: { in: aliasKeys }, product: notArchived }, select: { product: { select: productSelect } } });
    const products = new Map(rows.map((r) => [r.product.id, r.product]));
    const viable = [...products.values()].filter((p) => !brandConflicts(brandKey, p));
    // One product behind the alias is a probable match; several is ambiguous and stays "possible" for a human to choose.
    for (const product of viable) propose(product, "ALIAS", viable.length === 1 ? "PROBABLE" : "POSSIBLE");
  }

  return [...found.values()].sort((a, b) => STRENGTH_RANK[b.strength] - STRENGTH_RANK[a.strength] || a.name.localeCompare(b.name));
}

/**
 * The one candidate that may PRE-LINK a parsed item, or null. Pre-linking is only a proposal (the item stays pending until a person
 * confirms): exactly one EXACT match, or, when there is no EXACT match, exactly one PROBABLE match. Anything ambiguous returns null.
 */
export function pickAutoLink(candidates: readonly MatchCandidate[]): MatchCandidate | null {
  const exact = candidates.filter((c) => c.strength === "EXACT");
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) return null;
  const probable = candidates.filter((c) => c.strength === "PROBABLE");
  return probable.length === 1 ? probable[0]! : null;
}
