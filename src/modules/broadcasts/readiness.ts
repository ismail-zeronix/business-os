/**
 * Whether a PENDING broadcast item is ready for "Confirm N ready items": already linked (by a person, or an unambiguous
 * auto-match — see products/matching.ts pickAutoLink, which never pre-links an ambiguous POSSIBLE match) to an ACTIVE
 * product. Price, currency and stock are never required here: confirmItem now defaults a missing currency to AED and a
 * missing price/stock to a stock status of AVAILABLE (this business runs on a single currency and treats being listed by
 * a supplier as evidence of availability), so there is nothing about those fields that should hold up a bulk confirm.
 * Pure and DB-shape-agnostic so the service (what to confirm) and the queries/page (the ready count) share one definition.
 */
export type ReadinessItem = { productId: string | null; product: { status: string } | null };

export function isItemReady(item: ReadinessItem): boolean {
  return Boolean(item.productId) && item.product?.status === "ACTIVE";
}
