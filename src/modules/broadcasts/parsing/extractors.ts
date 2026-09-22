import type { StockStatus, VatState } from "../../../generated/prisma/enums";

/** Independent, pure field extractors. Each returns what it found plus the character span it used (so later steps can exclude it). */

export type Span = [number, number];

const NUM = String.raw`\d[\d,]*(?:\.\d{1,2})?`;
const CUR = String.raw`(?:AED|DHS?|USD|US\$|EUR|GBP|SAR|INR|[$€£])`;

const CURRENCY_CODE: Record<string, string> = { AED: "AED", DH: "AED", DHS: "AED", USD: "USD", "US$": "USD", $: "USD", EUR: "EUR", "€": "EUR", GBP: "GBP", "£": "GBP", SAR: "SAR", INR: "INR" };

function parseAmount(raw: string): string | null {
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n >= 100_000_000) return null;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export type PriceMatch = { amount: string; currency: string | null; span: Span; bare: boolean; reason: string };

/**
 * Price, in priority order: currency-marked ("AED 2,450", "2450 AED"), keyword ("@ 2450", "price 2450"), trailing plus ("2450+").
 * A bare number such as a 4-digit model number is NOT a price. Currency is only reported when it is written.
 */
export function findPrice(text: string): PriceMatch | null {
  const before = new RegExp(String.raw`(${CUR})\.?\s*[:=@-]?\s*(${NUM})`, "i").exec(text);
  if (before && before[1] && before[2]) {
    const amount = parseAmount(before[2]);
    if (amount) return { amount, currency: CURRENCY_CODE[before[1].toUpperCase()] ?? null, span: [before.index, before.index + before[0].length], bare: false, reason: `price "${before[0].trim()}" (currency written before amount)` };
  }
  const after = new RegExp(String.raw`(${NUM})\s*(${CUR}|/-)`, "i").exec(text);
  if (after && after[1] && after[2]) {
    const amount = parseAmount(after[1]);
    if (amount) return { amount, currency: CURRENCY_CODE[after[2].toUpperCase()] ?? null, span: [after.index, after.index + after[0].length], bare: false, reason: `price "${after[0].trim()}" (currency written after amount)` };
  }
  const keyword = new RegExp(String.raw`(?:@|\b(?:price|rate|cost|offer)\b)\s*[:=-]?\s*(${NUM})`, "i").exec(text);
  if (keyword && keyword[1]) {
    const amount = parseAmount(keyword[1]);
    if (amount) return { amount, currency: null, span: [keyword.index, keyword.index + keyword[0].length], bare: false, reason: `price "${keyword[0].trim()}" (price keyword or @)` };
  }
  const plus = new RegExp(String.raw`(?<![\w.,])(\d[\d,]{2,}(?:\.\d{1,2})?)\s*\+`).exec(text);
  if (plus && plus[1]) {
    const amount = parseAmount(plus[1]);
    if (amount) return { amount, currency: null, span: [plus.index, plus.index + plus[0].length], bare: false, reason: `price "${plus[0].trim()}" (number with trailing plus)` };
  }
  return null;
}

/**
 * A number at the very end of a line, straight after a part-number-like token: "... 1 Yr PS NBD QCS1250U516GUAR 2644". Suppliers often put the
 * price there with no currency and no keyword. Low confidence, and the currency stays unknown: a person confirms it.
 */
export function findTrailingPrice(lastLine: string): PriceMatch | null {
  const match = /(\S{6,})\s+(\d{3,6}(?:\.\d{1,2})?)\s*$/.exec(lastLine);
  const before = match?.[1];
  const amount = match?.[2] ? parseAmount(match[2]) : null;
  if (!match || !before || !amount || !/^[A-Za-z0-9-]+$/.test(before) || !/[A-Za-z]/.test(before) || !/\d/.test(before)) return null;
  return { amount, currency: null, span: [0, 0], bare: true, reason: `price "${match[2]}" (a number after the part number at the end of the line; low confidence, no currency written)` };
}

/** A line that is only a number (optionally with a plus), e.g. the "2450" on its own last line. Low confidence: used only for the last line of an item. */
export function findBarePrice(lastLine: string): PriceMatch | null {
  const match = /^\s*(\d[\d,]{2,}(?:\.\d{1,2})?)\s*\+?\s*$/.exec(lastLine);
  const amount = match?.[1] ? parseAmount(match[1]) : null;
  return match && amount ? { amount, currency: null, span: [0, 0], bare: true, reason: `price "${match[0].trim()}" (a number alone on the last line; low confidence)` } : null;
}

const VAT_EXCLUDED = /(?:\+\s*vat|ex\.?\s*vat|excl(?:uding|usive|\.)?\s*(?:of\s*)?vat|vat\s*(?:extra|excl(?:uded|usive)?|not\s+included)|without\s*vat|\+\s*5\s*%)/i;
const VAT_INCLUDED = /(?:incl(?:uding|usive|\.)?\s*(?:of\s*)?vat|inc\.?\s*vat|with\s*vat|vat\s*(?:incl(?:uded|usive)?|inc\.?))/i;

/** VAT state. Written words win; otherwise a trailing "+" on the price means "plus VAT" (a market convention, recorded as a reason). Else UNKNOWN. */
export function findVat(text: string, price: PriceMatch | null): { state: VatState; reason: string | null } {
  if (VAT_EXCLUDED.test(text)) return { state: "EXCLUDED", reason: "VAT excluded (stated in text)" };
  if (VAT_INCLUDED.test(text)) return { state: "INCLUDED", reason: "VAT included (stated in text)" };
  if (price && !price.bare && text.slice(price.span[0], price.span[1] + 1).trimEnd().endsWith("+")) {
    return { state: "EXCLUDED", reason: 'VAT excluded (trailing "+" on the price, a market convention; please verify)' };
  }
  return { state: "UNKNOWN", reason: null };
}

const QTY_PATTERNS: RegExp[] = [
  /\b(\d{1,5})\s*(?:pcs?|pieces?|units?|nos?\.?|sets?)\b/i,
  /\bqty\.?\s*[:=-]?\s*(\d{1,5})\b/i,
  /\b(?:stock|available|avail)\s*[:=-]\s*(\d{1,5})\b/i,
  /(?:^|\s)[x×]\s*(\d{1,5})\b/i,
];

export function findQuantity(text: string, priceSpan?: Span): { quantity: number; span: Span; reason: string } | null {
  for (const pattern of QTY_PATTERNS) {
    const match = pattern.exec(text);
    if (!match || !match[1]) continue;
    const start = match.index;
    if (priceSpan && start < priceSpan[1] && start + match[0].length > priceSpan[0]) continue;
    return { quantity: Number(match[1]), span: [start, start + match[0].length], reason: `quantity "${match[0].trim()}"` };
  }
  return null;
}

const STOCK_RULES: { status: StockStatus; pattern: RegExp }[] = [
  { status: "OUT_OF_STOCK", pattern: /\b(?:out\s*of\s*stock|oos|sold\s*out|not\s*available)\b/i },
  { status: "INCOMING", pattern: /\b(?:incoming|eta|arriving|in\s*transit|expected|on\s*the\s*way)\b/i },
  { status: "ON_REQUEST", pattern: /\b(?:on\s*request|on\s*order|to\s*order|back\s*order)\b/i },
  { status: "LIMITED", pattern: /\b(?:limited|last\s*(?:few|pcs|units)|few\s*(?:pcs|units))\b/i },
  // "ready" is stock only on its own ("25pc ready"); "AI-Ready" / "AI Ready" describes a laptop's NPU, not availability.
  { status: "IN_STOCK", pattern: /\b(?:in\s*stock|instock|(?<!-)(?<!\bai\s)ready(?:\s*stock)?|uae\s*stock|local\s*stock)\b/i },
  { status: "AVAILABLE", pattern: /\b(?:available|avail)\b/i },
];

/** Stock words map to a status only when a recognised phrase is present. "UAE" alone is a market hint, not a stock status. */
export function findStockStatus(text: string): { status: StockStatus; span: Span; reason: string } | null {
  for (const rule of STOCK_RULES) {
    const match = rule.pattern.exec(text);
    if (match) return { status: rule.status, span: [match.index, match.index + match[0].length], reason: `stock status "${match[0]}"` };
  }
  return null;
}

const SPEC_PATTERNS: RegExp[] = [
  /\b(?:core\s*)?ultra[\s-]*[3579][\s-]*\d{3}[A-Z]{0,2}\b/gi, // "Ultra 7 255H", "ULTRA7-255H", "ULTRA 5-225U", "ULTRA-7 256V"
  /\bU[3579][-\s]*\d{3}[A-Z]{0,2}\b/gi, // Core Ultra shorthand in supplier lists: "U5 235", "U7-265", "U7 -265T"
  /\bi[3579][-\s]*\d{4,5}(?:G\d|[A-Z]{1,2})?\b/gi, // "i7-1355U", "I5-1135G7", and "I7- 12700" with the space some lists leave after the hyphen
  /\bi[3579]\b/gi,
  /\bryzen\s*[3579](?:\s*\d{4}[A-Z]{0,2})?\b/gi,
  /\b(?:xeon|celeron|pentium|snapdragon)[\w-]*/gi,
  /\b(?:8|12|16|24|32|48|64|96|128|256)\s*\/\s*\d{2,4}(?:\s?(?:gb|tb))?\b/gi,
  /\b\d{1,4}\s?(?:gb|tb)(?:\s?(?:ssd|hdd|nvme|ddr[345]|lpddr[45]))?\b/gi,
  /\b\d{2,4}\s?(?:ssd|hdd|nvme)\b/gi, // capacity glued to the drive type, no unit written: "512SSD", "256 SSD" (kept as written; the unit is not assumed)
  /\bddr[345]\b/gi,
  /\b\d{2}(?:\.\d)?\s?(?:"|”|inch\b)/gi,
  /\b(?:fhd|qhd|uhd|wuxga|wqhd|4k|oled|touch(?:screen)?)\b/gi,
  /\b(?:backlit(?:e|ed)?|bklt)\b/gi, // keyboard type
  /\+\s*(?:carry(?:ing)?\s*)?bag\b/gi, // "DOS+BAG": a bag included in the box
  /\b(?:rtx|gtx)\s*\d{3,4}\w*/gi,
  /\b(?:free\s?dos|dos|no\s?os|win(?:dows)?\s?(?:7|8|10|11)?(?:\s?(?:pro|home))?|w1[01](?:\s?(?:pro|home))?|ubuntu|linux|chrome\s?os)\b/gi,
];

/** CPU, RAM/storage, screen, GPU and OS snippets, in order of appearance. They make up the spec text and are excluded from the description. */
export function findSpecs(text: string): { snippets: { text: string; span: Span }[] } {
  const found: { text: string; span: Span }[] = [];
  for (const pattern of SPEC_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const span: Span = [match.index, match.index + match[0].length];
      const overlaps = found.some((f) => span[0] < f.span[1] && span[1] > f.span[0]);
      if (!overlaps) found.push({ text: match[0].replace(/\s+/g, " ").trim(), span });
    }
  }
  return { snippets: found.sort((a, b) => a.span[0] - b.span[0]) };
}

/**
 * Keyboard type and in-the-box accessories written inside a spec line ("BACKLITE", "BKLT", "DOS+BAG"). They have no typed column yet, so they are
 * kept in the item's extracted data as hints; the words themselves also stay in the spec text as written.
 */
export function findExtras(text: string): Record<string, string> {
  const hints: Record<string, string> = {};
  if (/\b(?:backlit(?:e|ed)?|bklt)\b/i.test(text)) hints.keyboard = "Backlit";
  if (/\+\s*(?:carry(?:ing)?\s*)?bag\b/i.test(text)) hints.accessories = "Bag";
  return hints;
}

const MARKET =/\b(?:uae|local(?:\s*stock)?|imported?|dubai\s*stock|sharjah\s*stock)\b/i;

/** Market hints (UAE / local / import). No typed column yet, so they are kept in the item's extracted data. */
export function findMarket(text: string): { value: string; span: Span } | null {
  const match = MARKET.exec(text);
  return match ? { value: match[0].trim(), span: [match.index, match.index + match[0].length] } : null;
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A brand from the Brand master list (word-boundary, case-insensitive). Returns the canonical master spelling and the earliest match. */
export function findBrand(text: string, brands: readonly string[]): { name: string; span: Span } | null {
  let best: { name: string; span: Span } | null = null;
  for (const name of [...brands].sort((a, b) => b.length - a.length)) {
    const match = new RegExp(String.raw`(?<![A-Za-z0-9])${escapeRegex(name)}(?![A-Za-z0-9])`, "i").exec(text);
    if (match && (!best || match.index < best.span[0])) best = { name, span: [match.index, match.index + match[0].length] };
  }
  return best;
}

/**
 * Letters-and-digits tokens that are specs, not part numbers: a screen resolution (1920x1200), an IEEE standard (802.11be), a memory layout
 * (2x16GB), a Lenovo series name with its size ("THINKBOOK14-G8", "THINKBOOK-16"), or any number with a unit (400nits, 5.4GHz, 140W, 90Wh, 13TOPS).
 */
const NOT_A_PART_NUMBER = /^(?:(?:thinkbook|thinkpad|ideapad|thinkcentre|thinkstation)-?\d[a-z0-9-]*|\d{3,4}\s?[x×]\s?\d{3,4}|802\.\d+[a-z]*|\d+\s?[x×]\s?\d+\s?(?:gb|tb|mb)|\d+(?:\.\d+)?\s?(?:nits|[kmg]?hz|wh?|mah|tops|mp|kg|mm|cm|gbps|mbps|gb|tb|mb|v|a))$/i;

/**
 * A manufacturer part number candidate: an alphanumeric token with both letters and digits, at least 6 characters, that is not already
 * explained as a CPU, capacity, price and so on. Only a candidate: a person confirms it.
 */
export function findPartNumber(text: string, excluded: readonly Span[]): { value: string; span: Span; reason: string } | null {
  const candidates: { value: string; span: Span }[] = [];
  for (const match of text.matchAll(/[A-Za-z0-9][A-Za-z0-9#\-/.]{4,23}[A-Za-z0-9]/g)) {
    const span: Span = [match.index, match.index + match[0].length];
    if (excluded.some((e) => span[0] < e[1] && span[1] > e[0])) continue;
    if (NOT_A_PART_NUMBER.test(match[0])) continue;
    const alnum = match[0].replace(/[^A-Za-z0-9]/g, "");
    if (alnum.length < 6 || !/\d/.test(alnum) || !/[A-Za-z]/.test(alnum)) continue;
    if (/^\d+(?:gb|tb|mb)/i.test(alnum)) continue;
    candidates.push({ value: match[0], span });
  }
  candidates.sort((a, b) => b.value.replace(/[^A-Za-z0-9]/g, "").length - a.value.replace(/[^A-Za-z0-9]/g, "").length);
  const best = candidates[0];
  return best ? { ...best, reason: `part number candidate "${best.value}"` } : null;
}
