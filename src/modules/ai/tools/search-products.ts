import { z } from "zod";
import { db } from "../../../core/database/client";
import { hasCapability } from "../../../core/permissions/capabilities";
import type { RecordStatus } from "../../../generated/prisma/enums";
import { getProductIntelligence, type StockValue, type VatValue } from "../../observations/procurement-queries";
import type { MatchCandidate } from "../../products/matching";
import { searchProcurement } from "../../search/queries";
import type { AIToolDefinition } from "./types";

/**
 * search_products: products with what every supplier most recently said about each (latest price and stock, retracted rows excluded).
 * It wraps the same queries as /search, adds the evidence source of every observation, and drops price amounts when the actor may not
 * see supplier cost. It adds no business logic, so the assistant and the search page can never disagree.
 */

/** Products passed on to the context. More than this and the question should be narrowed, not summarised. */
export const MAX_TOOL_PRODUCTS = 6;

export type PriceFact = { observationId: string; evidenceSourceId: string; amount: string | null; currencyCode: string | null; vatState: VatValue | null; observedAt: Date };
export type StockFact = { observationId: string; evidenceSourceId: string; quantity: number | null; status: StockValue; observedAt: Date };
export type OfferFact = { supplierId: string; supplierName: string; price: PriceFact | null; stock: StockFact | null };

export type ProductHit = {
  productId: string;
  name: string;
  partNumber: string | null;
  brandName: string | null;
  categoryName: string | null;
  isTemporary: boolean;
  status: RecordStatus;
  /** How the product was found: an exact matcher hit, the product open on the page, or only words of its name. */
  match: Pick<MatchCandidate, "basis" | "strength"> | { basis: "PAGE"; strength: "EXACT" } | null;
  offers: OfferFact[];
};

export type ProductSearchOutput = { query: string | null; products: ProductHit[]; total: number; costVisible: boolean };

const inputSchema = z
  .object({ query: z.string().trim().min(2).max(200).nullable(), productId: z.uuid().nullable() })
  .refine((v) => (v.query === null) !== (v.productId === null), "Give either a query or a product id");

export type SearchProductsInput = z.output<typeof inputSchema>;

async function loadProduct(productId: string) {
  const p = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, partNumber: true, isTemporary: true, status: true, brand: { select: { name: true } }, category: { select: { name: true } } },
  });
  if (!p) return null;
  return { id: p.id, name: p.name, partNumber: p.partNumber, brandName: p.brand?.name ?? null, categoryName: p.category?.name ?? null, isTemporary: p.isTemporary, status: p.status };
}

export const searchProductsTool: AIToolDefinition<SearchProductsInput, ProductSearchOutput> = {
  name: "search_products",
  description: "Find products by part number, model or name, with each supplier's latest price and stock observation and its evidence.",
  inputSchema,
  requiredCapabilities: ["product.read", "supplier.read"],
  async execute(input, ctx) {
    const costVisible = hasCapability(ctx.actor, "supplier.cost.read");

    let hits: Omit<ProductHit, "offers">[] = [];
    let supplierRows = new Map<string, Awaited<ReturnType<typeof getProductIntelligence>>>();
    let total = 0;

    if (input.productId) {
      const product = await loadProduct(input.productId);
      if (product) {
        hits = [{ productId: product.id, name: product.name, partNumber: product.partNumber, brandName: product.brandName, categoryName: product.categoryName, isTemporary: product.isTemporary, status: product.status, match: { basis: "PAGE", strength: "EXACT" } }];
        supplierRows = new Map([[product.id, await getProductIntelligence(product.id)]]);
        total = 1;
      }
    } else if (input.query) {
      const search = await searchProcurement(input.query);
      total = search.total;
      const shown = search.results.filter((r) => r.status !== "ARCHIVED").slice(0, MAX_TOOL_PRODUCTS);
      hits = shown.map((r) => ({ productId: r.id, name: r.name, partNumber: r.partNumber, brandName: r.brandName, categoryName: r.categoryName, isTemporary: r.isTemporary, status: r.status, match: r.match }));
      supplierRows = new Map(shown.map((r) => [r.id, r.suppliers]));
    }

    // The evidence behind every observation, so each fact can be opened at its source.
    const priceIds = [...supplierRows.values()].flat().flatMap((s) => (s.price ? [s.price.id] : []));
    const stockIds = [...supplierRows.values()].flat().flatMap((s) => (s.stock ? [s.stock.id] : []));
    const [prices, stocks] = await Promise.all([
      priceIds.length ? db.priceObservation.findMany({ where: { id: { in: priceIds } }, select: { id: true, evidenceSourceId: true } }) : [],
      stockIds.length ? db.stockObservation.findMany({ where: { id: { in: stockIds } }, select: { id: true, evidenceSourceId: true } }) : [],
    ]);
    const evidenceOf = new Map([...prices, ...stocks].map((o) => [o.id, o.evidenceSourceId]));

    const products: ProductHit[] = hits.map((hit) => ({
      ...hit,
      offers: (supplierRows.get(hit.productId) ?? []).flatMap((s): OfferFact[] => {
        const priceEvidence = s.price ? evidenceOf.get(s.price.id) : undefined;
        const stockEvidence = s.stock ? evidenceOf.get(s.stock.id) : undefined;
        const price: PriceFact | null =
          s.price && priceEvidence
            ? {
                observationId: s.price.id,
                evidenceSourceId: priceEvidence,
                amount: costVisible ? s.price.amount : null,
                currencyCode: costVisible ? s.price.currencyCode : null,
                vatState: costVisible ? s.price.vatState : null,
                observedAt: s.price.observedAt,
              }
            : null;
        const stock: StockFact | null =
          s.stock && stockEvidence ? { observationId: s.stock.id, evidenceSourceId: stockEvidence, quantity: s.stock.quantity, status: s.stock.status, observedAt: s.stock.observedAt } : null;
        return price || stock ? [{ supplierId: s.supplierId, supplierName: s.supplierName, price, stock }] : [];
      }),
    }));

    return { query: input.query, products, total, costVisible };
  },
};
