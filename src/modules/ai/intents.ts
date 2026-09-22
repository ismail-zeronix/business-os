/**
 * Deterministic intent classification and search-term extraction (docs/ai-intelligence/ai-orchestrator.md). Pure functions, no I/O,
 * no model: the rules decide what a question is about; a model is only asked for search terms when these find nothing.
 */

export const INTENTS = [
  "SEARCH_PRODUCT",
  "CHECK_STOCK",
  "CHECK_LATEST_PRICE",
  "ANSWER_DATABASE_QUESTION",
  // Reserved for later modules: recognised, answered plainly as "not available yet", never improvised.
  "MATCH_SUPPLIER",
  "COMPARE_SUPPLIERS",
  "ANALYZE_ENQUIRY",
  "EXTRACT_SUPPLIER_BROADCAST",
  "NORMALIZE_PRODUCT",
  "FIND_ALTERNATIVE_PRODUCT",
  "PREPARE_PROCUREMENT_TASK",
  "DRAFT_SUPPLIER_MESSAGE",
  "DRAFT_CUSTOMER_REPLY",
  "PREPARE_QUOTATION_DRAFT",
  "ANALYZE_QUOTE_RISK",
  "FIND_FOLLOW_UP",
  "SUMMARIZE_CUSTOMER_HISTORY",
  "SUMMARIZE_SUPPLIER_HISTORY",
  "DISCOVER_HIDDEN_SUPPLIERS",
] as const;

export type Intent = (typeof INTENTS)[number];

/** Intents with a working tool path in this stage. */
export const WIRED_INTENTS: ReadonlySet<Intent> = new Set(["SEARCH_PRODUCT", "CHECK_STOCK", "CHECK_LATEST_PRICE", "ANSWER_DATABASE_QUESTION"]);

export type PageEntity = { type: "Product" | "Supplier" | "Enquiry" | "Customer" | "Broadcast" | "Quotation"; id: string };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PAGE_ROUTES: [RegExp, PageEntity["type"]][] = [
  [new RegExp(`^/products/(${UUID})(?:[/?#]|$)`, "i"), "Product"],
  [new RegExp(`^/suppliers/(${UUID})(?:[/?#]|$)`, "i"), "Supplier"],
  [new RegExp(`^/enquiries/(${UUID})(?:[/?#]|$)`, "i"), "Enquiry"],
  [new RegExp(`^/customers/(${UUID})(?:[/?#]|$)`, "i"), "Customer"],
  [new RegExp(`^/broadcasts/(${UUID})(?:[/?#]|$)`, "i"), "Broadcast"],
  [new RegExp(`^/quotations/(${UUID})(?:[/?#]|$)`, "i"), "Quotation"],
];

/** The record a page shows, decided on the server from the path: the browser never asserts what it is looking at. */
export function resolvePageEntity(path: string | null): PageEntity | null {
  if (!path) return null;
  for (const [pattern, type] of PAGE_ROUTES) {
    const match = pattern.exec(path);
    if (match?.[1]) return { type, id: match[1].toLowerCase() };
  }
  return null;
}

const has = (text: string, pattern: RegExp) => pattern.test(text);

export function classifyIntent(question: string, entity: PageEntity | null): Intent {
  const q = question.toLowerCase();

  // Work that belongs to modules not built yet. Checked first so "draft a quote for the Dell server price" is not answered as a price lookup.
  if (has(q, /\bquot(e|es|ation|ations)\b/) && has(q, /\b(draft|prepare|make|create|build|write)\b/)) return "PREPARE_QUOTATION_DRAFT";
  if (has(q, /\bquot(e|ation)\b/) && has(q, /\b(risk|margin|check)\b/)) return "ANALYZE_QUOTE_RISK";
  if (has(q, /\b(draft|write|reply|respond)\b/) && has(q, /\b(customer|client)\b/)) return "DRAFT_CUSTOMER_REPLY";
  if (has(q, /\b(draft|write|message|email)\b/) && has(q, /\bsuppliers?\b/)) return "DRAFT_SUPPLIER_MESSAGE";
  if (has(q, /\bfollow[- ]?ups?\b|\bremind(er)?s?\b/)) return "FIND_FOLLOW_UP";
  if (has(q, /\b(summar\w*|history)\b/) && has(q, /\bsuppliers?\b/)) return "SUMMARIZE_SUPPLIER_HISTORY";
  if (has(q, /\b(summar\w*|history)\b/) && has(q, /\b(customer|client)s?\b/)) return "SUMMARIZE_CUSTOMER_HISTORY";
  if (has(q, /\b(new|hidden|other|more|find)\b.*\bsuppliers?\b.*\b(discover|find|search)\b|\bdiscover\b/)) return "DISCOVER_HIDDEN_SUPPLIERS";
  if (has(q, /\b(alternatives?|equivalents?|replacements?|substitutes?|similar)\b/)) return "FIND_ALTERNATIVE_PRODUCT";
  if (has(q, /\benquir(y|ies)\b/) && has(q, /\b(analy[sz]e|extract|missing)\b/)) return "ANALYZE_ENQUIRY";

  // What this stage answers from observations. A quantity ("need 20 units") does not make a price question a stock question.
  if (has(q, /\b(stock|stocks|available|availability|in[- ]stock)\b/)) return "CHECK_STOCK";
  if (has(q, /\b(price|prices|pricing|cost|costs|rate|rates|how much|cheapest|lowest|compare|aed|usd)\b/)) return "CHECK_LATEST_PRICE";
  if (has(q, /\b(qty|quantity|units?|pcs)\b/)) return "CHECK_STOCK";
  if (entity?.type === "Product" || extractSearchTerms(question).length > 0) return "SEARCH_PRODUCT";
  return "ANSWER_DATABASE_QUESTION";
}

const STOPWORDS = new Set(
  (
    "a an the of for to in on at by with from and or but is are was were be been do does did we you i me my our us your they it this that these those " +
    "there here what whats which who whom how much many any some all please can could would should will shall may might need needs want wants looking " +
    "find show get check tell give list see search look know about latest current currently today now recent best cheapest lowest highest " +
    "stock stocks available availability qty quantity unit units pcs price prices pricing cost costs rate rates supplier suppliers vendor vendors " +
    "have has had got product products item items model part number pn sku quote quotation aed usd who's where when"
  ).split(" "),
);

const QUANTITY_WORDS = new Set(["unit", "units", "pcs", "pc", "pieces", "nos", "qty", "quantity", "x"]);

/** "has letters and digits" (21M7002XAD, E14, C9200L-24P-4G) or a long digit run: shaped like a part number or model. */
const looksLikeCode = (token: string) => token.length >= 3 && ((/[a-z]/i.test(token) && /\d/.test(token)) || /^\d{5,}$/.test(token));

/** True when the question contains something shaped like a part number or model code. */
export function hasCodeToken(question: string): boolean {
  return question.split(/[\s?!,;:()[\]{}"'`]+/).some((t) => looksLikeCode(t.replace(/^[.\-/]+|[.\-/]+$/g, "")));
}

/**
 * The words of a question that could name a product, without the question words. Returns up to three variants to search: the remaining
 * phrase, then each code-shaped token on its own (a part number is the strongest identity).
 */
export function extractSearchTerms(question: string): string[] {
  const tokens = question
    .replace(/[?!,;:()[\]{}"'`]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[.\-/]+|[.\-/]+$/g, ""))
    .filter(Boolean);
  // A number next to a unit word is a quantity ("20 units", "qty 5"), not part of a model name ("Latitude 5540" keeps its number).
  const isQuantity = (i: number) =>
    /^\d{1,5}$/.test(tokens[i]!) && (QUANTITY_WORDS.has(tokens[i + 1]?.toLowerCase() ?? "") || QUANTITY_WORDS.has(tokens[i - 1]?.toLowerCase() ?? ""));
  const meaningful = tokens.filter((t, i) => !STOPWORDS.has(t.toLowerCase()) && !isQuantity(i));
  const phrase = meaningful.join(" ").trim();
  const codes = meaningful.filter(looksLikeCode);
  const variants = [phrase, ...codes].filter((v) => v.length >= 2);
  return [...new Set(variants.map((v) => v.slice(0, 200)))].slice(0, 3);
}
