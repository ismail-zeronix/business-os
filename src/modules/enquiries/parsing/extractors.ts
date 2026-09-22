import { findQuantity, type Span } from "../../broadcasts/parsing/extractors";

/**
 * Enquiry-specific field extractors. Pure functions. Each returns what it found plus the character span it used, so the parser can
 * exclude it from the description. Nothing is guessed: no match means null. Customer wording differs from supplier broadcasts
 * ("Need 200 Dell Latitude ... delivery Dubai urgently"), so these complement the broadcast extractors rather than replace them.
 */

export type { Span };

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A number followed by these is a capacity, duration or percentage, not a quantity ("require 16GB", "need 10 days"). */
const NOT_A_QUANTITY = String.raw`(?!\d)(?!\s*(?:gb|tb|mb|ghz|"|”|%|inch\b|days?\b|weeks?\b|hours?\b|months?\b))`;

const KEYWORD_QTY = new RegExp(
  String.raw`\b(?:need|needs|needed|require|requires|required|want|wanted|looking\s+for|supply(?:\s+of)?|quote\s+for|qty\.?|quantity)\s*[:=-]?\s*(\d{1,6})${NOT_A_QUANTITY}`,
  "i",
);

/**
 * The requested quantity: "Need 200", "require 50 units", "qty: 25", "200 Dell ...", "Latitude 5440 x 50", "40 pcs".
 * Order: an explicit keyword, then a number directly before a known brand, then the broadcast quantity patterns (pcs / units / x N).
 */
export function findRequestedQuantity(text: string, brands: readonly string[]): { quantity: number; span: Span; reason: string } | null {
  const accept = (raw: string | undefined) => {
    const quantity = Number(raw);
    return Number.isInteger(quantity) && quantity >= 1 && quantity <= 999_999 ? quantity : null;
  };

  const keyword = KEYWORD_QTY.exec(text);
  const keywordQty = accept(keyword?.[1]);
  if (keyword && keywordQty) return { quantity: keywordQty, span: [keyword.index, keyword.index + keyword[0].length], reason: `quantity "${keyword[0].trim()}" (stated as a requirement)` };

  const names = [...brands].filter(Boolean).sort((a, b) => b.length - a.length).map(escapeRegex);
  if (names.length) {
    const beforeBrand = new RegExp(String.raw`(?<![\w.,#/-])(\d{1,6})${NOT_A_QUANTITY}\s*(?:x|×|nos?\.?|pcs?\.?|units?)?\s+(?=(?:${names.join("|")})(?![A-Za-z0-9]))`, "i").exec(text);
    const beforeQty = accept(beforeBrand?.[1]);
    if (beforeBrand && beforeQty) return { quantity: beforeQty, span: [beforeBrand.index, beforeBrand.index + beforeBrand[0].length], reason: `quantity "${beforeBrand[0].trim()}" (number in front of the brand)` };
  }

  const generic = findQuantity(text);
  const genericQty = accept(generic ? String(generic.quantity) : undefined);
  return generic && genericQty ? { quantity: genericQty, span: generic.span, reason: `${generic.reason}` } : null;
}

const DELIVERY = /\b(?:deliver(?:y|ed|ing)?|ship(?:ping|ped)?)\s*(?:to|at|in|within|:|-)?\s*([A-Za-z][A-Za-z .'-]{1,40}?)(?=\s*[,.;\n]|\s+(?:urgent\w*|asap|by|within|before|on|and|for|with|required|needed|is|are|please|kindly)\b|\s*$)/gi;
const NOT_A_PLACE = /^(?:date|time|terms?|charges?|address|notes?|schedule|period|lead|costs?|fees?|required|needed|must|should|will|is|are|and|a|an|by|for|on|with|as|per|option|location)\b/i;

/** Where to deliver: "delivery Dubai", "deliver to Abu Dhabi". The place must start with a capital letter. Wording is kept as written. */
export function findDelivery(text: string): { value: string; span: Span; reason: string } | null {
  for (const match of text.matchAll(DELIVERY)) {
    const captured = match[1]?.replace(/^the\s+/i, "").replace(/\s+(?:and|or)$/i, "").trim();
    if (!captured || captured.length < 3 || !/^[A-Z]/.test(captured) || NOT_A_PLACE.test(captured) || captured.split(/\s+/).length > 5) continue;
    return { value: captured, span: [match.index, match.index + match[0].length], reason: `delivery "${captured}"` };
  }
  return null;
}

const URGENCY = /\b(?:urgent(?:ly)?|asap|immediately|as\s+soon\s+as\s+possible|top\s+priority)\b/i;

export function findUrgency(text: string): { span: Span; reason: string } | null {
  const match = URGENCY.exec(text);
  return match ? { span: [match.index, match.index + match[0].length], reason: `urgency "${match[0]}"` } : null;
}

const REQUIRED_BY: RegExp[] = [
  /\b(?:required|needed|deliver(?:y)?|deadline)\s+(?:by|before|within|date)\s*[:-]?\s*([^.,;\n]{2,40})/i,
  /\bwithin\s+(\d{1,3}\s*(?:hours?|days?|weeks?))\b/i,
  /\bby\s+((?:next\s+)?(?:mon|tues|wednes|thurs|fri|satur|sun)day|tomorrow|end\s+of\s+(?:the\s+)?(?:week|month)|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*)/i,
];

/** When it is needed, as written ("by Friday", "within 3 days"). It is only a hint: a person sets the real date. */
export function findRequiredByText(text: string): { value: string; span: Span; reason: string } | null {
  for (const pattern of REQUIRED_BY) {
    const match = pattern.exec(text);
    const value = match?.[1]?.trim();
    if (match && value) return { value, span: [match.index, match.index + match[0].length], reason: `required by "${value}" (wording as written)` };
  }
  return null;
}

/** A product family from the product master (e.g. "Latitude"): word-boundary, case-insensitive, earliest match, canonical spelling. */
export function findFamily(text: string, families: readonly string[]): { name: string; span: Span } | null {
  let best: { name: string; span: Span } | null = null;
  for (const name of [...families].filter(Boolean).sort((a, b) => b.length - a.length)) {
    const match = new RegExp(String.raw`(?<![A-Za-z0-9])${escapeRegex(name)}(?![A-Za-z0-9])`, "i").exec(text);
    if (match && (!best || match.index < best.span[0])) best = { name, span: [match.index, match.index + match[0].length] };
  }
  return best;
}

const CPU = /^(?:(?:core\s*)?ultra\s*[3579]|i[3579](?:[-\s]?\d|$)|ryzen|xeon|celeron|pentium|snapdragon)/i;
const OS = /^(?:free\s?dos|dos$|no\s?os|win(?:dows)?|w1[01]|ubuntu|linux|chrome\s?os)/i;
const SLASH_PAIR = /^(\d{1,3})\s*\/\s*(\d{2,4})(?:\s?(?:gb|tb))?$/i;
const CAPACITY = /^(\d{1,4})\s?(gb|tb)\b(.*)$/i;
const RAM_SIZES = new Set([4, 8, 12, 16, 24, 32, 48, 64, 96]);

/**
 * Labels spec snippets (as found by `findSpecs`) as cpu / ram / storage / os. These are HINTS shown as chips: heuristics, never a
 * source of truth. Values are the snippet text as written; a key is omitted when nothing fits. The first match per key wins.
 */
export function classifySpecHints(snippets: readonly string[]): Record<string, string> {
  const hints: Record<string, string> = {};
  for (const snippet of snippets) {
    const text = snippet.trim();
    const pair = SLASH_PAIR.exec(text);
    if (pair) {
      hints.ramStorage ??= text;
      continue;
    }
    if (CPU.test(text)) {
      hints.cpu ??= text;
      continue;
    }
    if (OS.test(text)) {
      hints.os ??= text;
      continue;
    }
    const capacity = CAPACITY.exec(text);
    if (capacity) {
      const gigabytes = Number(capacity[1]) * (capacity[2]?.toLowerCase() === "tb" ? 1024 : 1);
      const rest = capacity[3] ?? "";
      if (/ssd|hdd|nvme/i.test(rest) || gigabytes >= 120) hints.storage ??= text;
      else if (/ram|ddr/i.test(rest) || RAM_SIZES.has(gigabytes)) hints.ram ??= text;
    }
  }
  return hints;
}
