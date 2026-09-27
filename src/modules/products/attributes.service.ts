import type { ServiceContext } from "../../core/database/tx";
import type { ProposedAttribute } from "../specs/extract";
import { extractAttributes } from "../specs/extract";

/**
 * Structured specifications of a product (`product_attributes`, DATA_MODEL section 19): what the product IS, read from its own name and
 * description by the same normalizers that read a customer's requirements. Proposals only (source PARSER): nothing is guessed, a product with
 * no stated specification has no rows (UNKNOWN). Rows are append-only; a value that is already in force is never written twice.
 */

/** The words a product states about itself. Its name and description, and nothing else. */
export const productAttributeText = (product: { name: string; description: string | null }) => [product.name, product.description ?? ""].filter(Boolean).join("\n");

export const proposeProductAttributes = (product: { name: string; description: string | null }): ProposedAttribute[] => extractAttributes(productAttributeText(product));

/** Writes proposals for attributes the product has no active value for. Returns how many rows were written. */
export async function createParsedProductAttributes(c: ServiceContext, productId: string, proposals: readonly ProposedAttribute[], sourceBroadcastItemId: string | null = null): Promise<number> {
  if (proposals.length === 0) return 0;
  const active = await c.db.productAttribute.findMany({ where: { productId, retractedAt: null }, select: { attributeKey: true } });
  const have = new Set(active.map((a) => a.attributeKey));
  const fresh = proposals.filter((p) => !have.has(p.attributeKey));
  if (fresh.length === 0) return 0;
  const result = await c.db.productAttribute.createMany({
    data: fresh.map((p) => ({
      productId,
      attributeKey: p.attributeKey,
      rawValue: p.rawValue,
      valueText: p.valueText,
      valueNum: p.valueNum,
      valueList: p.valueList,
      unit: p.unit,
      confidence: p.confidence,
      source: "PARSER" as const,
      sourceBroadcastItemId,
      createdById: c.actor.id,
    })),
  });
  return result.count;
}
