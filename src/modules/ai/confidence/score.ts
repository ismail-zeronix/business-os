import { formatRelativeAge } from "../../../lib/format";
import { getFreshnessBand, type FreshnessBand } from "../../../lib/freshness";
import type { StockValue } from "../../observations/procurement-queries";
import type { OfferFact, ProductHit } from "../tools/search-products";

/**
 * Confidence in an answer = quality of the evidence and certainty of the match (docs/ai-intelligence/confidence-scoring.md). It is not
 * a promise that the answer is right. Pure and deterministic: the same data gives the same score on every provider, and the model
 * never produces it. Warnings are listed whatever the score.
 */

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
export type Confidence = { score: number; level: ConfidenceLevel; reasons: string[]; warnings: string[]; missing: string[] };

export function levelOf(score: number): ConfidenceLevel {
  if (score >= 0.85) return "HIGH";
  if (score >= 0.6) return "MEDIUM";
  return "LOW";
}

/** Only these count as stock a supplier can deliver now. INCOMING and ON_REQUEST are arrangements, not stock (an offer is not stock). */
export const AVAILABLE_STOCK: ReadonlySet<StockValue> = new Set(["IN_STOCK", "LIMITED", "AVAILABLE"]);

const STOCK_WORDS: Record<StockValue, string> = {
  IN_STOCK: "in stock",
  LIMITED: "limited stock",
  AVAILABLE: "available",
  INCOMING: "incoming, not in stock yet",
  ON_REQUEST: "on request only",
  OUT_OF_STOCK: "out of stock",
  UNKNOWN: "stock status not stated",
};

const FRESHNESS_POINTS: Record<FreshnessBand, number> = { fresh: 0.2, recent: 0.14, aging: 0.07, stale: 0.02 };
const FRESHNESS_REASON: Record<FreshnessBand, string> = {
  fresh: "The newest evidence is less than a day old",
  recent: "The newest evidence is less than a week old",
  aging: "The newest evidence is one to two weeks old",
  stale: "The newest evidence is more than two weeks old",
};

const newestOf = (offer: OfferFact): Date => new Date(Math.max(offer.price?.observedAt.getTime() ?? 0, offer.stock?.observedAt.getTime() ?? 0));

/** A recorded price of zero almost always means "no price given" (price on request), never a free product. */
export const isZeroPrice = (offer: OfferFact) => offer.price?.amount !== null && offer.price?.amount !== undefined && Number(offer.price.amount) === 0;
const hasUsablePrice = (offer: OfferFact) => offer.price !== null && !isZeroPrice(offer);
const hasAvailableStock = (offer: OfferFact) => offer.stock !== null && AVAILABLE_STOCK.has(offer.stock.status);

/** Warnings name products, and some product names are a whole specification. */
export const shortName = (name: string) => (name.length > 60 ? `${name.slice(0, 57).trimEnd()}...` : name);

export function scoreEvidence(input: { products: ProductHit[]; questionHasCode: boolean; mentionsWarranty: boolean; costVisible: boolean; now?: Date }): Confidence {
  const now = input.now ?? new Date();
  const reasons: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  const top = input.products[0];

  if (!top) {
    return { score: 0, level: "LOW", reasons: ["No product in the database matches the question"], warnings, missing: ["The exact part number or model"] };
  }

  let score = 0;

  // Identity of the product the answer is about.
  const strength = top.match?.strength ?? null;
  if (top.match?.basis === "PAGE") {
    score += 0.4;
    reasons.push("The product open on this page");
  } else if (strength === "EXACT") {
    score += 0.4;
    reasons.push(top.match?.basis === "PART_NUMBER" ? "Exact part-number match" : "Exact model match");
  } else if (strength === "PROBABLE") {
    score += 0.28;
    reasons.push(top.match?.basis === "ALIAS" ? "Matched through a known alias" : "Model match");
  } else if (strength === "POSSIBLE") {
    score += 0.2;
    reasons.push("Possible match on part number or model");
  } else {
    score += 0.15;
    reasons.push("Matched by words in the product name only");
    warnings.push("The product was found by words in its name, not by part number or model. Confirm it is the product meant.");
  }
  if (!input.questionHasCode && top.match?.basis !== "PAGE" && strength !== "EXACT") missing.push("The exact part number");

  const others = input.products.length - 1;
  if (others > 0 && strength !== "EXACT" && top.match?.basis !== "PAGE") {
    score -= 0.1;
    warnings.push(`${input.products.length} products match. Check which one is meant before relying on the answer.`);
  }
  if (top.isTemporary) {
    score -= 0.05;
    warnings.push(`${shortName(top.name)} is a temporary product: its details have not been verified.`);
  }

  // Evidence behind it. Only a real price or available stock counts as usable evidence.
  const offers = top.offers;
  if (offers.length === 0) {
    missing.push(`Any supplier price or stock for ${shortName(top.name)}`);
  } else {
    const usable = offers.filter((o) => hasUsablePrice(o) || hasAvailableStock(o)).length;
    if (usable > 0) {
      score += 0.25;
      reasons.push(`${usable} ${usable === 1 ? "supplier has" : "suppliers have"} stated a usable price or available stock`);
    } else {
      score += 0.1;
      reasons.push("Suppliers answered, but none with a usable price or available stock");
    }
    score += 0.1;
    reasons.push("Every observation was confirmed by a person from the supplier's own message");

    const newest = new Date(Math.max(...offers.map((o) => newestOf(o).getTime())));
    const band = getFreshnessBand(newest, now);
    score += FRESHNESS_POINTS[band];
    reasons.push(FRESHNESS_REASON[band]);

    if (offers.some(hasAvailableStock)) {
      score += 0.05;
      reasons.push("At least one supplier stated available stock");
    } else {
      warnings.push("No supplier has stated available stock for this product.");
    }

    for (const offer of offers) {
      const age = formatRelativeAge(newestOf(offer), now);
      const offerBand = getFreshnessBand(newestOf(offer), now);
      if (offerBand === "aging" || offerBand === "stale") warnings.push(`${offer.supplierName}: the latest evidence is from ${age.toLowerCase()}. Reconfirm before relying on it.`);
      if (isZeroPrice(offer)) warnings.push(`${offer.supplierName}: the price is recorded as 0.00, which means no price was given. Ask for a price.`);
      if (offer.price && !offer.stock) warnings.push(`${offer.supplierName} stated a price but no stock.`);
      if (offer.stock && !AVAILABLE_STOCK.has(offer.stock.status)) warnings.push(`${offer.supplierName}: ${STOCK_WORDS[offer.stock.status]}. This is not available stock.`);
      if (offer.price && !isZeroPrice(offer) && input.costVisible && offer.price.vatState === "UNKNOWN") warnings.push(`${offer.supplierName}: the price does not say whether VAT is included.`);
    }

    const currencies = new Set(offers.flatMap((o) => (o.price?.currencyCode ? [o.price.currencyCode] : [])));
    if (currencies.size > 1) warnings.push(`Prices are in different currencies (${[...currencies].join(", ")}). Compare them with care.`);
    if (!input.costVisible) warnings.push("Supplier prices are hidden for your role.");
  }

  if (input.mentionsWarranty) missing.push("Warranty: it is not recorded for these offers");

  const clamped = Math.max(0, Math.min(1, Math.round(score * 100) / 100));
  return { score: clamped, level: levelOf(clamped), reasons, warnings: [...new Set(warnings)].slice(0, 10), missing: [...new Set(missing)] };
}
