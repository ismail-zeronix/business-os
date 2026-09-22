import { formatDateTime, formatRelativeAge } from "../../../lib/format";
import { FRESHNESS_LIMITS_MS } from "../../../lib/freshness";
import { isZeroPrice } from "../confidence/score";
import type { ProductHit } from "../tools/search-products";
import type { ContextProvider, PackageEvidence, PackageProduct, PackageSupplier } from "./types";

/**
 * The context providers built in this stage. Product, price, stock and supplier facts all come from one tool result
 * (search_products), so they are one provider; business rules are another. Later modules register their own.
 */

const VAT_WORDS = { INCLUDED: "VAT included", EXCLUDED: "VAT excluded", UNKNOWN: "VAT not stated" } as const;

function matchLabel(hit: ProductHit): string {
  const m = hit.match;
  if (!m) return "found by words in its name only";
  if (m.basis === "PAGE") return "the product open on the page";
  const basis = m.basis === "PART_NUMBER" ? "part number" : m.basis === "MODEL" ? "model" : "alias";
  return `${m.strength.toLowerCase()} ${basis} match`;
}

const DAY_HOURS = FRESHNESS_LIMITS_MS.fresh / 3_600_000;
const RECENT_DAYS = FRESHNESS_LIMITS_MS.recent / 86_400_000;
const AGING_DAYS = FRESHNESS_LIMITS_MS.aging / 86_400_000;

/** Products found, the suppliers that quoted them, and every latest price and stock observation with its source. */
export const productOffersProvider: ContextProvider = {
  name: "product-offers",
  appliesTo: (input) => input.search !== null,
  async build(input, _ctx, refs) {
    const products: PackageProduct[] = [];
    const suppliers = new Map<string, PackageSupplier>();
    const evidence: PackageEvidence[] = [];

    for (const hit of input.search?.products ?? []) {
      const productRef = refs.ref("P", hit.productId);
      products.push({
        ref: productRef,
        id: hit.productId,
        name: hit.name,
        partNumber: hit.partNumber,
        brandName: hit.brandName,
        categoryName: hit.categoryName,
        isTemporary: hit.isTemporary,
        matchLabel: matchLabel(hit),
      });

      for (const offer of hit.offers) {
        const supplierRef = refs.ref("S", offer.supplierId);
        suppliers.set(offer.supplierId, { ref: supplierRef, id: offer.supplierId, name: offer.supplierName });
        const stated = (at: Date) => `stated ${formatDateTime(at)} (${formatRelativeAge(at, input.now).toLowerCase()})`;

        if (offer.price) {
          const value =
            offer.price.amount === null
              ? "price hidden (no access to supplier cost)"
              : isZeroPrice(offer)
                ? `price recorded as 0.00 ${offer.price.currencyCode}, meaning no price was given`
                : `price ${offer.price.amount} ${offer.price.currencyCode} per unit, ${VAT_WORDS[offer.price.vatState ?? "UNKNOWN"]}`;
          const ref = refs.ref("E", offer.price.observationId);
          evidence.push({
            ref,
            type: "price_observation",
            id: offer.price.observationId,
            evidenceSourceId: offer.price.evidenceSourceId,
            productRef,
            supplierRef,
            observedAt: offer.price.observedAt,
            line: `${ref}  ${productRef} · ${supplierRef} ${offer.supplierName} · ${value} · ${stated(offer.price.observedAt)}`,
            summary: `${offer.supplierName} · ${value} · ${stated(offer.price.observedAt)}`,
          });
        }
        if (offer.stock) {
          const quantity = offer.stock.quantity === null ? "quantity not stated" : `${offer.stock.quantity} units`;
          const value = `stock ${quantity}, status ${offer.stock.status}`;
          const ref = refs.ref("E", offer.stock.observationId);
          evidence.push({
            ref,
            type: "stock_observation",
            id: offer.stock.observationId,
            evidenceSourceId: offer.stock.evidenceSourceId,
            productRef,
            supplierRef,
            observedAt: offer.stock.observedAt,
            line: `${ref}  ${productRef} · ${supplierRef} ${offer.supplierName} · ${value} · ${stated(offer.stock.observedAt)}`,
            summary: `${offer.supplierName} · ${value} · ${stated(offer.stock.observedAt)}`,
          });
        }
      }
    }
    return { products, suppliers: [...suppliers.values()], evidence };
  },
};

/** Standing domain facts that decide how evidence may be read. Always included. */
export const businessRulesProvider: ContextProvider = {
  name: "business-rules",
  appliesTo: () => true,
  async build() {
    return {
      rules: [
        "Prices here are supplier costs to Zeronix, not selling prices. A selling price is set by a person on a quotation.",
        "Each price and stock line is the latest a supplier stated, confirmed by a person from the supplier's own message. Price and stock may come from different messages.",
        `Freshness is measured from when the supplier stated it: fresh under ${DAY_HOURS} hours, recent under ${RECENT_DAYS} days, aging under ${AGING_DAYS} days, stale after that.`,
        "Available stock means status IN_STOCK, LIMITED or AVAILABLE. INCOMING and ON_REQUEST are arrangements, not stock. UNKNOWN is unknown.",
        "Warranty, delivery time and payment terms are not recorded on these observations: they are unknown unless stated here.",
      ],
    };
  },
};
