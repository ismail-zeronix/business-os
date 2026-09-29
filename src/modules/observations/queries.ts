import { db } from "../../core/database/client";
import { Prisma } from "../../generated/prisma/client";
import type { VatValue } from "./procurement-queries";

export type LatestPriceSummary = { amount: string; currencyCode: string; vatState: VatValue };
export type ObservationSummary = { supplierCount: number; latestObservedAt: Date; latestSupplierName: string | null; latestPrice: LatestPriceSummary | null };

/**
 * For a page of products: how many distinct suppliers have (non-retracted) observations, when the newest one was stated,
 * which supplier made that newest observation (the "current" supplier shown in the UI), and the newest non-retracted price
 * specifically (price and stock are independent, so this is its own lookup, not whatever the newest observation of either
 * kind happens to be). One grouped query, no N+1. Products with no observations are simply absent from the map.
 */
export async function observationSummaryByProduct(productIds: string[]): Promise<Map<string, ObservationSummary>> {
  if (productIds.length === 0) return new Map();
  const rows = await db.$queryRaw<
    { product_id: string; supplier_count: number; latest: Date; latest_supplier_name: string | null; price_amount: string | null; price_currency_code: string | null; price_vat_state: VatValue | null }[]
  >(Prisma.sql`
    WITH obs AS (
      SELECT product_id, supplier_id, observed_at, created_at FROM price_observations WHERE retracted_at IS NULL AND product_id = ANY(${productIds}::uuid[])
      UNION ALL
      SELECT product_id, supplier_id, observed_at, created_at FROM stock_observations WHERE retracted_at IS NULL AND product_id = ANY(${productIds}::uuid[])
    ),
    agg AS (
      SELECT product_id, COUNT(DISTINCT supplier_id)::int AS supplier_count, MAX(observed_at) AS latest
      FROM obs
      GROUP BY product_id
    ),
    latest_obs AS (
      SELECT DISTINCT ON (product_id) product_id, supplier_id
      FROM obs
      ORDER BY product_id, observed_at DESC, created_at DESC
    ),
    latest_price AS (
      SELECT DISTINCT ON (product_id) product_id, amount::text AS amount, currency_code, vat_state::text AS vat_state
      FROM price_observations
      WHERE retracted_at IS NULL AND product_id = ANY(${productIds}::uuid[])
      ORDER BY product_id, observed_at DESC, created_at DESC
    )
    SELECT agg.product_id, agg.supplier_count, agg.latest, s.name AS latest_supplier_name,
      lp.amount AS price_amount, lp.currency_code AS price_currency_code, lp.vat_state AS price_vat_state
    FROM agg
    JOIN latest_obs ON latest_obs.product_id = agg.product_id
    JOIN suppliers s ON s.id = latest_obs.supplier_id
    LEFT JOIN latest_price lp ON lp.product_id = agg.product_id`);
  return new Map(
    rows.map((r) => [
      r.product_id,
      {
        supplierCount: r.supplier_count,
        latestObservedAt: r.latest,
        latestSupplierName: r.latest_supplier_name,
        latestPrice: r.price_amount !== null && r.price_currency_code !== null && r.price_vat_state !== null ? { amount: r.price_amount, currencyCode: r.price_currency_code.trim(), vatState: r.price_vat_state } : null,
      },
    ]),
  );
}
