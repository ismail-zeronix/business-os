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

/**
 * Which review mode to default to for a broadcast nobody has touched yet: Table is faster when there are enough items
 * to be worth batching (20-100) and most of them share one category (a repetitive list, e.g. all "RAM"), since the
 * bulk table lets you move through near-identical rows quickly. Otherwise Review (the line-by-line, evidence-linked
 * flow) is the safer default — too few items to bother batching, too many to trust a table pass, or a mixed bag where
 * line-by-line judgement matters more. Pure and DB-shape-agnostic, same style as isItemReady above.
 */
export function recommendReviewMode(items: { categoryText: string | null }[]): "table" | "review" {
  if (items.length < 20 || items.length > 100) return "review";
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = (item.categoryText ?? "").trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const maxCount = Math.max(...counts.values());
  return maxCount / items.length >= 0.6 ? "table" : "review";
}
