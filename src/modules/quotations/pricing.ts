/**
 * Quotation money maths. Pure functions, no I/O, no database types: the service uses them to decide what is saved, and the line editor
 * uses the same ones to preview it, so the two always agree. Everything is worked in whole cents so nothing drifts; a result is rounded once,
 * half away from zero. There is no currency conversion anywhere: a caller only compares amounts that are in the same currency.
 */

type Money = string | number | { toString(): string };

/** The largest amount that fits DECIMAL(14,2), in cents. */
export const MAX_AMOUNT_CENTS = 99_999_999_999_999;
/** The largest markup that fits DECIMAL(7,2). The smallest is -100 (a price of zero). */
export const MAX_MARKUP = 99_999.99;
export const MIN_MARKUP = -100;

export const toCents = (value: Money): number => Math.round(Number(value.toString()) * 100);
export const centsToAmount = (cents: number): string => (cents / 100).toFixed(2);

const finite = (value: Money): number | null => {
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : null;
};

/** "-0.00" is shown as "0.00". */
const cleanZero = (text: string): string => (Number(text) === 0 ? text.replace("-", "") : text);

/**
 * The price that gives `markupPercent` on `cost`: cost + cost x markup / 100, rounded to a cent. Returns null when the result is not a valid
 * price (negative, or too large to store), so the caller can say so instead of saving nonsense.
 */
export function priceFromMarkup(cost: Money, markupPercent: Money): string | null {
  const c = finite(cost);
  const m = finite(markupPercent);
  if (c === null || m === null || c < 0 || m < MIN_MARKUP || m > MAX_MARKUP) return null;
  const cents = Math.round(toCents(c) * (1 + m / 100));
  if (cents < 0 || cents > MAX_AMOUNT_CENTS) return null;
  return centsToAmount(cents);
}

/** The markup % that turns `cost` into `price`, to two decimals. Null when it cannot be worked out (no cost, a zero cost, or out of range). */
export function markupFromPrice(cost: Money, price: Money): string | null {
  const c = finite(cost);
  const p = finite(price);
  if (c === null || p === null || c <= 0 || p < 0) return null;
  const markup = (toCents(p) / toCents(c) - 1) * 100;
  if (!Number.isFinite(markup) || markup > MAX_MARKUP || markup < MIN_MARKUP) return null;
  return cleanZero(markup.toFixed(2));
}

/** Quantity x unit price in cents, or null while either is missing. */
export function lineTotalCents(quantity: number | null, unitPrice: Money | null): number | null {
  if (quantity == null || unitPrice == null) return null;
  const price = finite(unitPrice);
  return price === null ? null : quantity * toCents(price);
}

export type PricedLine = { quantity: number | null; unitPrice: Money | null };

export type Totals = {
  /** Amounts as "1234.50". */
  subtotal: string;
  vat: string;
  total: string;
  /** Lines that are missing a quantity or a price and so are not in the totals. */
  incompleteLines: number;
};

/** Subtotal (excluding VAT), VAT and total. VAT is rounded once, on the subtotal, not per line. */
export function computeTotals(lines: readonly PricedLine[], vatPercent: Money): Totals {
  let subtotal = 0;
  let incompleteLines = 0;
  for (const line of lines) {
    const total = lineTotalCents(line.quantity, line.unitPrice);
    if (total === null) incompleteLines += 1;
    else subtotal += total;
  }
  const rate = finite(vatPercent) ?? 0;
  const vat = Math.round((subtotal * rate) / 100);
  return { subtotal: centsToAmount(subtotal), vat: centsToAmount(vat), total: centsToAmount(subtotal + vat), incompleteLines };
}

export type CostedLine = PricedLine & {
  /** The supplier's price for one unit, or null when unknown. */
  costAmount: Money | null;
  /** Whether the cost is in the quotation's currency. A cost in another currency is never mixed in. */
  costComparable: boolean;
};

export type MarginSummary = {
  /** Sums over the lines that have a quantity, a price and a comparable cost. Cents. */
  revenue: string;
  cost: string;
  margin: string;
  /** margin / revenue, one decimal, or null when there is no revenue. */
  marginPercent: string | null;
  coveredLines: number;
  totalLines: number;
};

/** Internal only. Margin over the lines where all three of quantity, price and cost are known, and how many lines that covers. */
export function summariseMargin(lines: readonly CostedLine[]): MarginSummary {
  let revenue = 0;
  let cost = 0;
  let coveredLines = 0;
  for (const line of lines) {
    const total = lineTotalCents(line.quantity, line.unitPrice);
    const unitCost = line.costAmount == null ? null : finite(line.costAmount);
    if (total === null || unitCost === null || !line.costComparable || line.quantity == null) continue;
    revenue += total;
    cost += line.quantity * toCents(unitCost);
    coveredLines += 1;
  }
  const margin = revenue - cost;
  return {
    revenue: centsToAmount(revenue),
    cost: centsToAmount(cost),
    margin: centsToAmount(margin),
    marginPercent: revenue > 0 ? cleanZero(((margin / revenue) * 100).toFixed(1)) : null,
    coveredLines,
    totalLines: lines.length,
  };
}

/** One line's profit (price - cost) x quantity, or null when any part is unknown or the cost is in another currency. */
export function lineMarginCents(line: CostedLine): number | null {
  const total = lineTotalCents(line.quantity, line.unitPrice);
  const unitCost = line.costAmount == null ? null : finite(line.costAmount);
  if (total === null || unitCost === null || !line.costComparable || line.quantity == null) return null;
  return total - line.quantity * toCents(unitCost);
}

export type PricingBasis = "MARKUP" | "PRICE";

export type LinePricing = { unitPrice: string | null; markupPercent: string | null };

/**
 * What to save for a line, given what the person edited.
 *  - MARKUP: needs a known, comparable cost. The price is worked out from it. A blank markup clears the price.
 *  - PRICE: the price is what was typed. The markup is worked out from the cost when there is a comparable one, otherwise it stays empty.
 * Returns an error message instead of a result when the input cannot be used.
 */
export function resolveLinePricing(input: {
  basis: PricingBasis;
  markupPercent: string | null;
  unitPrice: string | null;
  costAmount: Money | null;
  costComparable: boolean;
}): LinePricing | { error: string; field: "markupPercent" | "unitPrice" } {
  const cost = input.costComparable ? input.costAmount : null;

  if (input.basis === "MARKUP") {
    if (input.markupPercent === null) return { unitPrice: null, markupPercent: null };
    if (cost === null) return { error: "Markup needs a known cost in the quotation's currency. Enter the price instead.", field: "markupPercent" };
    const price = priceFromMarkup(cost, input.markupPercent);
    if (price === null) return { error: "That markup gives a price that cannot be saved.", field: "markupPercent" };
    return { unitPrice: price, markupPercent: cleanZero(Number(input.markupPercent).toFixed(2)) };
  }

  if (input.unitPrice === null) return { unitPrice: null, markupPercent: null };
  const price = centsToAmount(toCents(input.unitPrice));
  if (toCents(price) > MAX_AMOUNT_CENTS) return { error: "That price is too large.", field: "unitPrice" };
  return { unitPrice: price, markupPercent: cost === null ? null : markupFromPrice(cost, price) };
}
