import { db } from "../../core/database/client";
import { Prisma } from "../../generated/prisma/client";
import { formatMoney } from "../../lib/format";

/**
 * Procurement read-side. "Latest" = per (product, supplier): newest observed_at, ties broken by created_at, retracted rows excluded.
 * Price and stock are independent: a supplier's newest price and newest stock may come from different broadcasts.
 */

export type VatValue = "INCLUDED" | "EXCLUDED" | "UNKNOWN";
export type StockValue = "IN_STOCK" | "LIMITED" | "AVAILABLE" | "INCOMING" | "ON_REQUEST" | "OUT_OF_STOCK" | "UNKNOWN";

export type LatestPrice = { id: string; amount: string; currencyCode: string; vatState: VatValue; observedAt: Date };
export type LatestStock = { id: string; quantity: number | null; status: StockValue; observedAt: Date };

export type SupplierIntelligenceRow = { supplierId: string; supplierName: string; price: LatestPrice | null; stock: LatestStock | null; latestObservedAt: Date };
export type ProductOfferRow = { productId: string; productName: string; partNumber: string | null; price: LatestPrice | null; stock: LatestStock | null; latestObservedAt: Date };

type PriceRaw = { id: string; product_id: string; supplier_id: string; amount: string; currency_code: string; vat_state: VatValue; observed_at: Date };
type StockRaw = { id: string; product_id: string; supplier_id: string; quantity: number | null; status: StockValue; observed_at: Date };

const toPrice = (r: PriceRaw): LatestPrice => ({ id: r.id, amount: r.amount, currencyCode: r.currency_code.trim(), vatState: r.vat_state, observedAt: r.observed_at });
const toStock = (r: StockRaw): LatestStock => ({ id: r.id, quantity: r.quantity, status: r.status, observedAt: r.observed_at });
const newest = (...dates: (Date | undefined)[]) => new Date(Math.max(...dates.filter((d): d is Date => Boolean(d)).map((d) => d.getTime())));

/** What every supplier has most recently told us about each of several products (two queries in total, whatever the count). Products with no observations are absent from the map. */
export async function getProductsIntelligence(productIds: string[]): Promise<Map<string, SupplierIntelligenceRow[]>> {
  const result = new Map<string, SupplierIntelligenceRow[]>();
  if (productIds.length === 0) return result;
  const ids = Prisma.join(productIds.map((id) => Prisma.sql`${id}::uuid`));

  const [prices, stocks] = await Promise.all([
    db.$queryRaw<PriceRaw[]>(Prisma.sql`
      SELECT DISTINCT ON (product_id, supplier_id) id, product_id, supplier_id, amount::text AS amount, currency_code, vat_state::text AS vat_state, observed_at
      FROM price_observations WHERE product_id IN (${ids}) AND retracted_at IS NULL
      ORDER BY product_id, supplier_id, observed_at DESC, created_at DESC`),
    db.$queryRaw<StockRaw[]>(Prisma.sql`
      SELECT DISTINCT ON (product_id, supplier_id) id, product_id, supplier_id, quantity, status::text AS status, observed_at
      FROM stock_observations WHERE product_id IN (${ids}) AND retracted_at IS NULL
      ORDER BY product_id, supplier_id, observed_at DESC, created_at DESC`),
  ]);

  const supplierIds = [...new Set([...prices.map((p) => p.supplier_id), ...stocks.map((s) => s.supplier_id)])];
  if (supplierIds.length === 0) return result;
  const names = new Map((await db.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } })).map((s) => [s.id, s.name]));

  const pairs = new Set([...prices.map((p) => `${p.product_id}|${p.supplier_id}`), ...stocks.map((s) => `${s.product_id}|${s.supplier_id}`)]);
  for (const pair of pairs) {
    const [productId, supplierId] = pair.split("|") as [string, string];
    const price = prices.find((p) => p.product_id === productId && p.supplier_id === supplierId);
    const stock = stocks.find((s) => s.product_id === productId && s.supplier_id === supplierId);
    const rows = result.get(productId) ?? [];
    rows.push({
      supplierId,
      supplierName: names.get(supplierId) ?? "Unknown supplier",
      price: price ? toPrice(price) : null,
      stock: stock ? toStock(stock) : null,
      latestObservedAt: newest(price?.observed_at, stock?.observed_at),
    });
    result.set(productId, rows);
  }
  for (const rows of result.values()) rows.sort((a, b) => b.latestObservedAt.getTime() - a.latestObservedAt.getTime());
  return result;
}

/** What every supplier has most recently told us about one product: latest price and latest stock, newest first. */
export async function getProductIntelligence(productId: string): Promise<SupplierIntelligenceRow[]> {
  return (await getProductsIntelligence([productId])).get(productId) ?? [];
}

/** Everything one supplier has most recently quoted, per product. Also serves as that supplier's product list. */
export async function getSupplierOffers(supplierId: string): Promise<ProductOfferRow[]> {
  const [prices, stocks] = await Promise.all([
    db.$queryRaw<PriceRaw[]>(Prisma.sql`
      SELECT DISTINCT ON (product_id) id, product_id, supplier_id, amount::text AS amount, currency_code, vat_state::text AS vat_state, observed_at
      FROM price_observations WHERE supplier_id = ${supplierId}::uuid AND retracted_at IS NULL
      ORDER BY product_id, observed_at DESC, created_at DESC`),
    db.$queryRaw<StockRaw[]>(Prisma.sql`
      SELECT DISTINCT ON (product_id) id, product_id, supplier_id, quantity, status::text AS status, observed_at
      FROM stock_observations WHERE supplier_id = ${supplierId}::uuid AND retracted_at IS NULL
      ORDER BY product_id, observed_at DESC, created_at DESC`),
  ]);

  const productIds = [...new Set([...prices.map((p) => p.product_id), ...stocks.map((s) => s.product_id)])];
  if (productIds.length === 0) return [];
  const byId = new Map((await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, partNumber: true } })).map((p) => [p.id, p]));

  return productIds
    .map((productId) => {
      const price = prices.find((p) => p.product_id === productId);
      const stock = stocks.find((s) => s.product_id === productId);
      return {
        productId,
        productName: byId.get(productId)?.name ?? "Unknown product",
        partNumber: byId.get(productId)?.partNumber ?? null,
        price: price ? toPrice(price) : null,
        stock: stock ? toStock(stock) : null,
        latestObservedAt: newest(price?.observed_at, stock?.observed_at),
      };
    })
    .sort((a, b) => b.latestObservedAt.getTime() - a.latestObservedAt.getTime());
}

const stockSummary = (quantity: number | null, status: string) =>
  [quantity !== null ? `${quantity} pcs` : null, status !== "UNKNOWN" ? status.replace(/_/g, " ").toLowerCase() : null].filter(Boolean).join(", ") || "stock";

export type HistoryRow = {
  id: string;
  kind: "price" | "stock";
  supplierName: string;
  summary: string;
  vatState: VatValue | null;
  observedAt: Date;
  retracted: boolean;
  retractionReason: string | null;
  retractedByName: string | null;
};

/** Every observation for a product, INCLUDING retracted ones (kept, never hidden), newest first. */
export async function listProductHistory(productId: string, limit = 200): Promise<HistoryRow[]> {
  const include = { supplier: { select: { name: true } }, retractedBy: { select: { name: true } } } as const;
  const [prices, stocks] = await Promise.all([
    db.priceObservation.findMany({ where: { productId }, orderBy: { observedAt: "desc" }, take: limit, include }),
    db.stockObservation.findMany({ where: { productId }, orderBy: { observedAt: "desc" }, take: limit, include }),
  ]);
  const rows: HistoryRow[] = [
    ...prices.map((p) => ({
      id: p.id,
      kind: "price" as const,
      supplierName: p.supplier.name,
      summary: formatMoney(p.amount, p.currencyCode),
      vatState: p.vatState,
      observedAt: p.observedAt,
      retracted: p.retractedAt !== null,
      retractionReason: p.retractionReason,
      retractedByName: p.retractedBy?.name ?? null,
    })),
    ...stocks.map((s) => ({
      id: s.id,
      kind: "stock" as const,
      supplierName: s.supplier.name,
      summary: stockSummary(s.quantity, s.status),
      vatState: null,
      observedAt: s.observedAt,
      retracted: s.retractedAt !== null,
      retractionReason: s.retractionReason,
      retractedByName: s.retractedBy?.name ?? null,
    })),
  ];
  return rows.sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime()).slice(0, limit);
}

export type RecentObservation = { id: string; kind: "price" | "stock"; productId: string; productName: string; supplierName: string; summary: string; observedAt: Date };

/** The newest non-retracted observations across the system, for the Overview. */
export async function listRecentObservations(limit = 8): Promise<RecentObservation[]> {
  const include = { supplier: { select: { name: true } }, product: { select: { id: true, name: true } } } as const;
  const [prices, stocks] = await Promise.all([
    db.priceObservation.findMany({ where: { retractedAt: null }, orderBy: { observedAt: "desc" }, take: limit, include }),
    db.stockObservation.findMany({ where: { retractedAt: null }, orderBy: { observedAt: "desc" }, take: limit, include }),
  ]);
  return [
    ...prices.map((p) => ({ id: p.id, kind: "price" as const, productId: p.product.id, productName: p.product.name, supplierName: p.supplier.name, summary: formatMoney(p.amount, p.currencyCode), observedAt: p.observedAt })),
    ...stocks.map((s) => ({ id: s.id, kind: "stock" as const, productId: s.product.id, productName: s.product.name, supplierName: s.supplier.name, summary: stockSummary(s.quantity, s.status), observedAt: s.observedAt })),
  ]
    .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime())
    .slice(0, limit);
}

/**
 * Everything behind one observation, for the evidence drawer: the values, supplier and contact, the immutable original message with its
 * source lines, the item as originally parsed vs as corrected, the linked product, and any retraction. `null` if the id is unknown.
 */
export async function getObservationEvidence(observationId: string) {
  const include = {
    supplier: { select: { id: true, name: true } },
    contact: { select: { name: true } },
    product: { select: { id: true, name: true, partNumber: true } },
    evidenceSource: { select: { id: true, kind: true, rawText: true, observedAt: true, channel: true } },
    broadcastItem: true,
    retractedBy: { select: { name: true } },
  } as const;

  const price = await db.priceObservation.findUnique({ where: { id: observationId }, include });
  const stock = price ? null : await db.stockObservation.findUnique({ where: { id: observationId }, include });
  const found = price ?? stock;
  if (!found) return null;

  const broadcast = await db.broadcast.findUnique({ where: { evidenceSourceId: found.evidenceSourceId }, select: { id: true } });
  return {
    kind: price ? ("price" as const) : ("stock" as const),
    id: found.id,
    price: price ? { amount: price.amount.toString(), currencyCode: price.currencyCode, vatState: price.vatState } : null,
    stock: stock ? { quantity: stock.quantity, status: stock.status } : null,
    observedAt: found.observedAt,
    recordedAt: found.createdAt,
    supplier: found.supplier,
    contactName: found.contact?.name ?? null,
    product: found.product,
    evidence: found.evidenceSource,
    broadcastId: broadcast?.id ?? null,
    item: found.broadcastItem,
    retraction: found.retractedAt ? { at: found.retractedAt, reason: found.retractionReason, byName: found.retractedBy?.name ?? null } : null,
  };
}

export type ObservationEvidence = NonNullable<Awaited<ReturnType<typeof getObservationEvidence>>>;
