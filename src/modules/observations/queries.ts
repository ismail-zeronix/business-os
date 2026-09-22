import { db } from "../../core/database/client";
import { Prisma } from "../../generated/prisma/client";

export type ObservationSummary = { supplierCount: number; latestObservedAt: Date };

/**
 * For a page of products: how many distinct suppliers have (non-retracted) observations, and when the newest one was stated.
 * One grouped query over price and stock observations (no N+1). Products with no observations are simply absent from the map.
 */
export async function observationSummaryByProduct(productIds: string[]): Promise<Map<string, ObservationSummary>> {
  if (productIds.length === 0) return new Map();
  const rows = await db.$queryRaw<{ product_id: string; supplier_count: number; latest: Date }[]>(Prisma.sql`
    SELECT product_id, COUNT(DISTINCT supplier_id)::int AS supplier_count, MAX(observed_at) AS latest
    FROM (
      SELECT product_id, supplier_id, observed_at FROM price_observations WHERE retracted_at IS NULL AND product_id = ANY(${productIds}::uuid[])
      UNION ALL
      SELECT product_id, supplier_id, observed_at FROM stock_observations WHERE retracted_at IS NULL AND product_id = ANY(${productIds}::uuid[])
    ) o
    GROUP BY product_id`);
  return new Map(rows.map((r) => [r.product_id, { supplierCount: r.supplier_count, latestObservedAt: r.latest }]));
}
