import type { ExtractionConfidence } from "../../../generated/prisma/enums";
import { findBrand, findPartNumber, findSpecs } from "../../broadcasts/parsing/extractors";
import { toLines, type Line } from "../../broadcasts/parsing/text";
import { classifySpecHints, findDelivery, findFamily, findRequestedQuantity, findRequiredByText, findUrgency, type Span } from "./extractors";
import { visibleLineCount } from "./quoted";
import type { EnquiryHeaderProposal, EnquiryParseContext, EnquiryParseResult, EnquiryParser, ParsedEnquiryItem } from "./types";

/**
 * Deterministic, rule-based requirement parser for customer enquiries. It splits the visible text into blocks, finds the lines that
 * describe a product, and runs independent extractors on them. It only PROPOSES: ambiguity leaves a field null and lowers confidence,
 * and nothing is defaulted or normalised. Deliberately imperfect: reviewers correct it and can add items by hand.
 */
const PARSER_NAME = "enquiry-rules";
const PARSER_VERSION = "1";

const inSpan = (index: number, spans: readonly Span[]) => spans.some((s) => index >= s[0] && index < s[1]);

/** Email addresses and links are removed before analysis: they contain letters+digits that would look like part numbers. */
function sanitize(clean: string): string {
  return clean.replace(/\S+@\S+/g, " ").replace(/https?:\/\/\S+|www\.\S+/gi, " ").replace(/\s+/g, " ").trim();
}

const TRAILING_CONNECTOR = /\s+(?:with|and|for|in|on|at|of|to|x|nos?|pcs?|units?)$/i;

/** Trims punctuation and dangling connector words ("... Gen 5 with") from both ends of a description. */
function trimPunctuation(value: string): string {
  let result = value.replace(/^[\s\-–,;:|/]+|[\s\-–,;:|/.]+$/g, "").replace(/\s+/g, " ");
  while (TRAILING_CONNECTOR.test(result)) result = result.replace(TRAILING_CONNECTOR, "").replace(/[\s\-–,;:|/.]+$/g, "");
  return result;
}

/**
 * The model wording after the brand: the first digit-bearing token, plus up to two following tokens that still look like part of a
 * model (contain a digit, are a short all-caps code such as "IRU", or are "Gen"). "Cisco Catalyst 9200 switches" gives "9200".
 */
function modelFrom(afterBrand: string[]): string | null {
  const first = afterBrand.findIndex((t) => /\d/.test(t));
  if (first < 0) return null;
  const parts = [afterBrand[first]!];
  for (const token of afterBrand.slice(first + 1, first + 3)) {
    if (/\d/.test(token) || /^[A-Z]{2,4}$/.test(token) || /^gen(?:eration)?$/i.test(token)) parts.push(token);
    else break;
  }
  return parts.join(" ");
}

type WorkLine = { number: number; raw: string; text: string };

const toWorkLine = (line: Line): WorkLine => ({ number: line.number, raw: line.raw, text: sanitize(line.clean) });

type Signals = {
  brand: { name: string; span: Span } | null;
  family: { name: string; span: Span } | null;
  quantity: ReturnType<typeof findRequestedQuantity>;
  specs: { text: string; span: Span }[];
  part: ReturnType<typeof findPartNumber>;
  model: boolean;
};

/** A digit-bearing token (model-like) that is not already explained as a quantity, spec or brand. */
function hasModelToken(text: string, explained: readonly Span[]): boolean {
  for (const match of text.matchAll(/[A-Za-z]*\d[A-Za-z0-9-]*/g)) {
    if (match[0].length < 2 || inSpan(match.index, explained)) continue;
    return true;
  }
  return false;
}

function signalsOf(text: string, context: EnquiryParseContext, contextBrand: string | null): Signals {
  const brand = findBrand(text, context.brands) ?? (contextBrand ? { name: contextBrand, span: [0, 0] as Span } : null);
  const family = findFamily(text, context.families);
  const quantity = findRequestedQuantity(text, context.brands);
  const specs = findSpecs(text).snippets;
  const explained: Span[] = [...(quantity ? [quantity.span] : []), ...specs.map((s) => s.span), ...(brand && brand.span[1] > 0 ? [brand.span] : []), ...(family ? [family.span] : [])];
  const part = findPartNumber(text, explained);
  return { brand, family, quantity, specs, part, model: hasModelToken(text, explained) };
}

/** Whether one line describes a product by itself (used to start a new item). */
function isItemLike(s: Signals): boolean {
  if (s.brand || s.family) return Boolean(s.quantity || s.specs.length || s.model || s.part);
  return Boolean((s.part && (s.quantity || s.specs.length)) || (s.quantity && s.model && s.specs.length));
}

/** A heading like "Dell:" or "HP laptops" (a brand and no digits) gives following lines a default brand. */
function headingBrand(line: WorkLine, brands: readonly string[]): string | null {
  if (/\d/.test(line.text) || line.text.length > 40) return null;
  return findBrand(line.text, brands)?.name ?? null;
}

function buildItem(lines: WorkLine[], context: EnquiryParseContext, contextBrand: string | null): Omit<ParsedEnquiryItem, "position"> | null {
  const flat = lines.map((l) => l.text).join(" ");
  const reasons: string[] = [];

  const quantity = findRequestedQuantity(flat, context.brands);
  if (quantity) reasons.push(quantity.reason);
  const foundBrand = findBrand(flat, context.brands);
  const brandText = foundBrand?.name ?? contextBrand;
  if (foundBrand) reasons.push(`brand "${foundBrand.name}" (from the brand list)`);
  else if (contextBrand) reasons.push(`brand "${contextBrand}" (from a heading above)`);
  const family = findFamily(flat, context.families);
  if (family) reasons.push(`family "${family.name}" (from the product master)`);
  const specs = findSpecs(flat);
  const delivery = findDelivery(flat);
  const urgency = findUrgency(flat);
  const required = findRequiredByText(flat);

  const explained: Span[] = [
    ...(quantity ? [quantity.span] : []),
    ...specs.snippets.map((s) => s.span),
    ...(delivery ? [delivery.span] : []),
    ...(urgency ? [urgency.span] : []),
    ...(required ? [required.span] : []),
  ];
  const part = findPartNumber(flat, [...explained, ...(foundBrand ? [foundBrand.span] : []), ...(family ? [family.span] : [])]);
  if (part) {
    reasons.push(part.reason);
    explained.push(part.span);
  }

  // Description: from the brand (else the family, else the start) up to the first later thing already explained (quantity, spec, ...).
  const start = foundBrand ? foundBrand.span[0] : family ? family.span[0] : 0;
  const stops = explained.filter((s) => s[0] > start).map((s) => s[0]);
  const end = stops.length ? Math.min(...stops) : flat.length;
  let description = trimPunctuation(flat.slice(start, end));
  if (description.length < 3) description = trimPunctuation(lines[0]?.text ?? "").slice(0, 120);

  const tokens = description.split(" ").filter(Boolean);
  const afterBrand = foundBrand ? tokens.slice(1) : tokens;
  const modelText = modelFrom(afterBrand);

  if (!(brandText || family || part) && !quantity) return null; // chatter, not a requirement line

  const strongIdentity = Boolean((brandText || family) && (modelText || part));
  const confidence: ExtractionConfidence = strongIdentity && quantity ? "HIGH" : (brandText || family) && (quantity || specs.snippets.length) ? "MEDIUM" : "LOW";

  return {
    sourceText: lines.map((l) => l.raw).join("\n"),
    sourceLineStart: lines[0]?.number ?? 1,
    sourceLineEnd: lines[lines.length - 1]?.number ?? 1,
    confidence,
    description: description || null,
    brandText,
    familyText: family?.name ?? null,
    modelText,
    partNumber: part?.value ?? null,
    specText: specs.snippets.length ? specs.snippets.map((s) => s.text).join(" · ") : null,
    quantity: quantity?.quantity ?? null,
    extractedData: { parser: PARSER_NAME, version: PARSER_VERSION, reasons, hints: classifySpecHints(specs.snippets.map((s) => s.text)) },
  };
}

function itemsFromBlock(block: WorkLine[], context: EnquiryParseContext): Omit<ParsedEnquiryItem, "position">[] {
  // A leading heading line ("Dell:") gives the following lines a default brand.
  const contextBrand = block.length > 1 ? headingBrand(block[0]!, context.brands) : null;
  const likeIndexes = block.map((line, i) => (isItemLike(signalsOf(line.text, context, i === 0 ? null : contextBrand)) ? i : -1)).filter((i) => i >= 0);
  if (likeIndexes.length === 0) return [];

  const items: Omit<ParsedEnquiryItem, "position">[] = [];
  likeIndexes.forEach((startIndex, k) => {
    const endIndex = (likeIndexes[k + 1] ?? block.length) - 1;
    const item = buildItem(block.slice(startIndex, endIndex + 1), context, startIndex === 0 ? null : contextBrand);
    if (item) items.push(item);
  });
  return items;
}

function headerFrom(text: string): EnquiryHeaderProposal {
  const reasons: string[] = [];
  const delivery = findDelivery(text);
  if (delivery) reasons.push(delivery.reason);
  const urgency = findUrgency(text);
  if (urgency) reasons.push(urgency.reason);
  const required = findRequiredByText(text);
  if (required) reasons.push(required.reason);
  return { deliveryLocation: delivery?.value ?? null, priority: urgency ? "URGENT" : null, requiredByText: required?.value ?? null, reasons };
}

export const enquiryRulesParser: EnquiryParser = {
  name: PARSER_NAME,
  version: PARSER_VERSION,
  parse(rawText: string, context: EnquiryParseContext): EnquiryParseResult {
    const skip = Math.max(0, context.skipLeadingLines ?? 0);
    const cutoff = visibleLineCount(rawText, skip);
    const visible = toLines(rawText).slice(skip, cutoff).map(toWorkLine);
    const header = headerFrom(visible.map((l) => l.text).filter(Boolean).join(" "));

    // Blocks are built here (not with the broadcast `toBlocks`) because a line that is only an email address becomes "" after sanitising.
    const workBlocks: WorkLine[][] = [];
    let current: WorkLine[] = [];
    for (const line of visible) {
      if (line.text === "") {
        if (current.length) workBlocks.push(current);
        current = [];
      } else current.push(line);
    }
    if (current.length) workBlocks.push(current);

    const items = workBlocks.flatMap((block) => itemsFromBlock(block, context)).map((item, index) => ({ ...item, position: index + 1 }));
    return { header, items };
  },
};
