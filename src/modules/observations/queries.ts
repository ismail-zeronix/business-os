import { db } from "../../core/database/client";
import { Prisma } from "../../generated/prisma/client";

export type ObservationSummary = { supplierCount: number; latestObservedAt: Date; latestSupplierName: string | null };

/**
 * For a page of products: how many distinct suppliers have (non-retracted) observations, when the newest one was stated,
 * and which supplier made that newest observation (the "current" supplier shown in the UI). One grouped query over price
 * and stock observations (no N+1). Products with no observations are simply absent from the map.
 */
export async function observationSummaryByProduct(productIds: string[]): Promise<Map<string, ObservationSummary>> {
  if (productIds.length === 0) return new Map();
  const rows = await db.$queryRaw<{ product_id: string; supplier_count: number; latest: Date; latest_supplier_name: string | null }[]>(Prisma.sql`
    WITH obs AS (
      SELECT product_id, supplier_id, observed_at FROM price_observations WHERE retracted_at IS NULL AND product_id = ANY(${productIds}::uuid[])
      UNION ALL
      SELECT product_id, supplier_id, observed_at FROM stock_observations WHERE retracted_at IS NULL AND product_id = ANY(${productIds}::uuid[])
    ),
    agg AS (
      SELECT product_id, COUNT(DISTINCT supplier_id)::int AS supplier_count, MAX(observed_at) AS latest
      FROM obs
      GROUP BY product_id
    ),
    latest_obs AS (
      SELECT DISTINCT ON (product_id) product_id, supplier_id
      FROM obs
      ORDER BY product_id, observed_at DESC
    )
    SELECT agg.product_id, agg.supplier_count, agg.latest, s.name AS latest_supplier_name
    FROM agg
    JOIN latest_obs ON latest_obs.product_id = agg.product_id
    JOIN suppliers s ON s.id = latest_obs.supplier_id`);
  return new Map(
    rows.map((r) => [r.product_id, { supplierCount: r.supplier_count, latestObservedAt: r.latest, latestSupplierName: r.latest_supplier_name }]),
  );
}
