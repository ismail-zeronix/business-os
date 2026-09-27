import type { ExtractionConfidence } from "../../../generated/prisma/enums";
import { findBarePrice, findBrand, findCategory, findExtras, findLeadingCode, findMarket, findPartNumber, findPrice, findQuantity, findSpecs, findStockStatus, findTrailingPrice, findVat, findWarranty, type Span } from "./extractors";
import { HEADER_LINE, readSignature } from "./header-lines";
import { readTableRows } from "./table-rows";
import { toBlocks, toLines, type Line } from "./text";
import type { BroadcastParser, ParsedItem, ParseContext } from "./types";

/**
 * Deterministic, rule-based broadcast parser. Splits the message into blocks and items, then runs independent extractors.
 * It only PROPOSES: ambiguity leaves a field null / UNKNOWN and lowers confidence, and currency is never assumed.
 * Deliberately imperfect: reviewers correct it and can add items by hand, so parsing quality never blocks the workflow.
 */
const PARSER_NAME = "rules";
const PARSER_VERSION = "6"; // 6 (2026-09-27): spec-rich pipe lines are products without a listed brand, Core Ultra X9 / Core 7 / Snapdragon CPUs, GPU memory is not RAM, colour in the spec text, "x9" is not a quantity, "SUPP :" label. 5 (2026-09-27): a signature block (company, e-mail, phone, contact name) is not a product; "512GBPC" is not 512 GBP; glued "i7147008GB/512GBPC" split; "coming next week" is INCOMING; tower / SFF / AIO give the Desktop category. 4: 4 (2026-09-23): category (leading-word + keyword match against the live Category list) and warranty (duration + type) from the real broadcasts already in the database. 3: Lenovo series names kept in the model, "512SSD", curly inch marks, Ultra CPUs, keyboard / bag hints. 2: split prices re-attached, "|" ends the name, resolutions / 802.11 not part numbers, "AI-Ready" is not stock

const inSpan = (index: number, spans: readonly Span[]) => spans.some((s) => index >= s[0] && index < s[1]);

/** A digit-bearing token (model-like) that is not already explained as a price, quantity or spec. */
function hasModelToken(clean: string, brands: readonly string[]): boolean {
  const price = findPrice(clean);
  const qty = findQuantity(clean, price?.span);
  const explained: Span[] = [price?.span, qty?.span, ...findSpecs(clean).snippets.map((s) => s.span)].filter((s): s is Span => Boolean(s));
  const brand = findBrand(clean, brands);
  for (const match of clean.matchAll(/[A-Za-z]*\d[A-Za-z0-9-]*/g)) {
    if (match[0].length < 2 || inSpan(match.index, explained)) continue;
    if (brand && match.index >= brand.span[0] && match.index < brand.span[1]) continue;
    return true;
  }
  return false;
}

/**
 * "Alienware 16 Aurora Gaming | Intel Core 7 | RTX 5050 | 16GB RAM | 512GB SSD": a product name, then at least three spec segments. A first segment that
 * is a single token ("A38B9ET#BH5 | U5-125U | 16GB | ...") is a detail line under a title, not a product of its own.
 */
const SPEC_WORD = /\b(?:core|ryzen|intel|amd|snapdragon|\d+\s?(?:gb|tb))\b/i;
/** A pipe line that starts with a CPU / size or a bare code ("Intel Core Ultra 9 | 32GB | ..."): the detail of a title above it, never a product of its own. */
const isPipeDetail = (clean: string) => {
  const segments = clean.split(/\||,\s/); // pipes, or the commas of a comma-separated spec line
  const first = (segments[0] as string).trim();
  return segments.length >= 4 && (SPEC_WORD.test(first) || !/\s/.test(first));
};
const isPipeProduct = (clean: string) => clean.split("|").length >= 4 && !isPipeDetail(clean) && findSpecs(clean).snippets.length >= 3;

/** Whether one line looks like a complete product line by itself (used to split a block into several items). */
function isItemLike(clean: string, brands: readonly string[]): boolean {
  const brand = findBrand(clean, brands) !== null;
  const price = findPrice(clean) !== null;
  const qty = findQuantity(clean) !== null;
  const model = hasModelToken(clean, brands);
  if (isPipeDetail(clean)) return false;
  if (findLeadingCode(clean)) return true;
  // A pipe-separated line ("Alienware 16 Aurora | Core 7 | RTX 5050 | 16GB RAM | 512GB SSD") is a whole product with or without a known brand.
  if (isPipeProduct(clean)) return true;
  return (brand && model) || ((price || qty) && (brand || model));
}

function trimPunctuation(value: string): string {
  return value.replace(/^[\s\-–—,;:|/]+|[\s\-–—,;:|/]+$/g, "").replace(/\s+/g, " ");
}

/**
 * A short title line ("DELL QCS1250|U5") followed by a detail line that repeats its model ("Dell Pro Slim QCS1250|U5 235|16GB|...") is ONE
 * product written twice, not two products. The title has no price, quantity, spec or stock of its own.
 */
function isTitleOf(title: Line, detail: Line, brands: readonly string[]): boolean {
  if (title.clean.length > 40 || !isItemLike(title.clean, brands)) return false;
  if (findPrice(title.clean) || findQuantity(title.clean) || findStockStatus(title.clean) || findSpecs(title.clean).snippets.length) return false;
  const modelTokens = title.clean.split(/[\s|,/]+/).filter((token) => token.length >= 3 && /\d/.test(token));
  const detailText = detail.clean.toLowerCase();
  return modelTokens.some((token) => detailText.includes(token.toLowerCase()));
}

/** Generic product-type words that end a model name ("QCT1250 DESKTOP", "M70s G6 SFF"). */
const MODEL_STOP = /^(?:desktop|laptop|notebook|workstation|tower|twr|sff|tiny|aio|mini|pc)$/i;

/** Lenovo product lines that come right before the size ("THINKBOOK 14 G8"). */
const MODEL_SERIES = /^(?:thinkbook|thinkpad|ideapad|thinkcentre|thinkstation|legion|yoga|loq|omnibook|zenbook|vivobook|expertbook)$/i;
/** Speed and standard words that follow a networking model: "AC1200", "N300", "4G+", "10/100Mbps". They are specs, not part of the model. */
const SPEED_WORD = /^(?:(?:ac|ax|be|n)\d{3,5}|\d+g\+?|[\d/]+\s?[mg]bps)$/i;

/** Words without a digit that still belong to a model name: "Gen", "IP3 SLIM", and Lenovo platform codes ("14 G6 IRL", "THINKBOOK14-G8 IAL"). */
const MODEL_WORD = /^(?:gen|slim|i(?:rl|al|ru|ap|tl|ah|rh)|a(?:bp|rp))$/i;

/**
 * The model: the first word with a digit, plus up to two following words that are themselves model-like (contain a digit, or "Gen").
 * A word repeated from the title line ("M70Q M70q") is skipped; a product-type word or anything else ends the model.
 */
function modelFrom(words: string[]): string | null {
  const parts = words.flatMap((word) => word.split(",")).filter(Boolean);
  const digitAt = parts.findIndex((word) => /\d/.test(word));
  if (digitAt < 0) return null;
  // A Lenovo series word right before the size is part of the name ("THINKBOOK 14 G8", "THINKPAD E16 G3"): it is kept, not dropped.
  // ("IdeaPad Slim 3": the series word can sit one word further back, behind "Slim".)
  const before = (offset: number) => (digitAt >= offset ? (parts[digitAt - offset] as string) : "");
  const seriesAt = MODEL_SERIES.test(before(1)) ? digitAt - 1 : /^slim$/i.test(before(1)) && MODEL_SERIES.test(before(2)) ? digitAt - 2 : digitAt;
  const model = parts.slice(seriesAt, digitAt + 1);
  for (const word of parts.slice(digitAt + 1, digitAt + 3 + (seriesAt < digitAt ? 1 : 0))) {
    if (MODEL_STOP.test(word) || SPEED_WORD.test(word)) break;
    if (model.some((m) => m.toLowerCase() === word.toLowerCase())) continue;
    if (!/\d/.test(word) && !MODEL_WORD.test(word)) break;
    model.push(word);
  }
  return model.join(" ");
}

/** "LENOVO LENOVO DESKTOP" -> "LENOVO DESKTOP": a heading line repeated at the start of the product line. */
const collapseRepeats = (text: string) =>
  text
    .split(" ")
    .filter((word, index, all) => index === 0 || word.toLowerCase() !== (all[index - 1] as string).toLowerCase())
    .join(" ");

function buildItem(lines: Line[], brands: readonly string[], categories: readonly string[], contextBrand: string | null, listLine = false): Omit<ParsedItem, "position"> | null {
  // Title + detail that names the brand itself: read the detail line (the title adds nothing). Without a brand on the detail line the title is kept.
  const detailOnly = lines.length > 1 && isTitleOf(lines[0] as Line, lines[1] as Line, brands) && findBrand((lines[1] as Line).clean, brands) !== null;
  const flat = (detailOnly ? lines.slice(1) : lines).map((l) => l.clean).join(" ");
  const lastLine = lines[lines.length - 1]?.clean ?? "";
  const reasons: string[] = [];
  const hints: Record<string, string> = {};

  const price = findPrice(flat) ?? findBarePrice(lastLine) ?? findTrailingPrice(lastLine);
  if (price) reasons.push(price.reason);
  const vat = findVat(flat, price);
  if (vat.reason) reasons.push(vat.reason);
  const qty = findQuantity(flat, price && !price.bare ? price.span : undefined);
  if (qty) reasons.push(qty.reason);
  const stock = findStockStatus(flat);
  if (stock) reasons.push(stock.reason);
  const specs = findSpecs(flat);
  const market = findMarket(flat);
  if (market) hints.market = market.value;
  Object.assign(hints, findExtras(flat));

  const foundBrand = findBrand(flat, brands);
  const brandText = foundBrand?.name ?? contextBrand;
  if (foundBrand) reasons.push(`brand "${foundBrand.name}" (from the brand list)`);
  else if (contextBrand) reasons.push(`brand "${contextBrand}" (from a heading above)`);

  const foundCategory = findCategory(flat, categories);
  if (foundCategory) reasons.push(foundCategory.reason);

  const warranty = findWarranty(flat);
  if (warranty.monthsReason) reasons.push(warranty.monthsReason);
  if (warranty.typeReason) reasons.push(warranty.typeReason);

  const explained: Span[] = [
    ...(price && !price.bare ? [price.span] : []),
    ...(qty ? [qty.span] : []),
    ...(stock ? [stock.span] : []),
    ...(market ? [market.span] : []),
    ...specs.snippets.map((s) => s.span),
  ];
  const leading = findLeadingCode(lines[0]?.clean ?? "");
  const part = leading ?? findPartNumber(flat, explained);
  if (part) {
    reasons.push(part.reason);
    explained.push(part.span);
  }

  // Description: from the brand (or the start) up to the first thing already explained as a price, quantity, spec or part number.
  const start = foundBrand ? foundBrand.span[0] : 0;
  const describe = (stopSpans: readonly Span[]) => {
    const stops = stopSpans.filter((s) => s[0] > start).map((s) => s[0]);
    const end = stops.length ? Math.min(...stops) : flat.length;
    let text = trimPunctuation(flat.slice(start, end));
    const withoutCode = (value: string) => (leading && value.startsWith(leading.value) ? trimPunctuation(value.slice(leading.value.length)) : value);
    if (start === 0) text = withoutCode(text);
    if (text.length < 3) text = withoutCode(trimPunctuation(lines[0]?.clean ?? "")).slice(0, 120);
    // A "|" ends the product name once a model-like token has come before it ("Lenovo P16v G3| Intel Core ..."): what follows is spec text.
    const bar = text.indexOf("|");
    if (bar > 0 && /\d/.test(text.slice(0, bar))) text = trimPunctuation(text.slice(0, bar));
    text = collapseRepeats(text);
    const words = text.split(" ").filter(Boolean);
    return { text, model: modelFrom(foundBrand ? words.slice(1) : words) };
  };
  let named = describe(explained);
  // The part number can be the model itself, straight after the brand ("DELL QCT1250 DESKTOP ..."): then the name runs on past it.
  if (!named.model && part) named = describe(explained.filter((span) => span !== part.span));
  // A part number that comes right after the name and before any specification belongs to the name ("ASUS TUF A16 FA607NUG GAMING"): otherwise
  // four different ASUS variants would all be called "ASUS TUF A16".
  else if (part && !leading && !listLine && part.span[0] > start && part.span[1] <= (lines[0]?.clean.length ?? 0) && !explained.some((span) => span !== part.span && span[0] > start && span[0] < part.span[0])) {
    named = describe(explained.filter((span) => span !== part.span));
  }
  const oneLine = price && !price.bare ? flat.slice(0, price.span[0]).replace(/[@\s]+$/, "") : flat;
  const description = listLine ? trimPunctuation(part && oneLine.includes(part.value) ? oneLine.replace(part.value, "") : oneLine) : named.text; // a one-line product keeps its whole line as the name ("SANDISK Ultra Go microSD 64GB")
  const modelText = named.model;

  const hasIdentity = Boolean(brandText || modelText || part);
  const pipeProduct = lines.length === 1 && isPipeProduct(flat); // a spec-rich pipe line is a product even when its brand is not in the list
  if (!price && !qty && !(brandText && modelText) && !part && !pipeProduct && !listLine) return null; // chatter, not a product line

  const confidence: ExtractionConfidence =
    price && !price.bare && (brandText || part) && (modelText || part) ? "HIGH" : (price || qty) && hasIdentity ? "MEDIUM" : "LOW";

  return {
    sourceText: lines.map((l) => l.raw).join("\n"),
    sourceLineStart: lines[0]?.number ?? 1,
    sourceLineEnd: lines[lines.length - 1]?.number ?? 1,
    confidence,
    description: description || null,
    brandText,
    modelText,
    partNumber: part?.value ?? null,
    specText: specs.snippets.length ? specs.snippets.map((s) => s.text).join(" · ") : null,
    quantity: qty?.quantity ?? null,
    priceAmount: price?.amount ?? null,
    currencyCode: price?.currency ?? null, // only when written; never assumed
    vatState: vat.state,
    stockStatus: stock?.status ?? "UNKNOWN",
    categoryText: foundCategory?.name ?? null,
    warrantyMonths: warranty.months,
    warrantyType: warranty.type,
    extractedData: { parser: PARSER_NAME, version: PARSER_VERSION, reasons, hints },
  };
}

/** A heading like "Dell:" or "HP laptops" (a brand and no digits) gives following lines a default brand. */
function headingBrand(line: Line, brands: readonly string[]): string | null {
  if (/\d/.test(line.clean) || line.clean.length > 40) return null;
  return findBrand(line.clean, brands)?.name ?? null;
}

function itemsFromBlock(block: Line[], brands: readonly string[], categories: readonly string[]): Omit<ParsedItem, "position">[] {
  // Title lines belong to the detail line that follows them: they never start an item of their own.
  const titles = new Set(block.flatMap((line, i) => (i + 1 < block.length && isTitleOf(line, block[i + 1] as Line, brands) ? [i] : [])));
  const likeIndexes = block.map((line, i) => (!titles.has(i) && isItemLike(line.clean, brands) ? i : -1)).filter((i) => i >= 0);
  const startOf = (index: number) => (titles.has(index - 1) ? index - 1 : index);

  // A product heading with one variant per line ("Kingston A400 2.5" Internal SATA SSD" / "240GB - SA400S37/240G" / "480GB - SA400S37/480G"): each
  // variant line is one product, named by the heading plus its own capacity and code.
  const VARIANT_LINE = /^(?:\d+(?:\.\d+)?\s?(?:gb|tb|mb))\s*[-–:]\s*[A-Za-z0-9][A-Za-z0-9#/.-]{3,}$/i;
  const heading = block[0] as Line;
  if (block.length >= 2 && !VARIANT_LINE.test(heading.clean) && block.slice(1).every((line) => VARIANT_LINE.test(line.clean))) {
    return block.slice(1).flatMap((line) => buildItem([heading, line], brands, categories, null, true) ?? []);
  }

  // A plain list: every line names one product on its own and none has a price or quantity to hold it to its neighbours
  // ("Tp-Link W8961N ADSL2+ Modem Router" / "TD-W9960", "SANDISK Ultra Go microSD 64GB"): one product per line, even when the brand is not in
  // the list. A line names a product with a model-like token, or with a capacity when it starts with a real word (and is not a comma / pipe
  // detail line). Blocks of one or two lines need the stricter form: a title and its detail line look alike.
  const hasCapacity = (line: Line) => /\d\s?(?:gb|tb)\b/i.test(line.clean);
  const startsWithWord = (line: Line) => /^[A-Za-z]{4,}/.test(line.clean.replace(/^[^A-Za-z]+/, ""));
  const bare = (line: Line) => !findPrice(line.clean) && !findQuantity(line.clean) && !isPipeDetail(line.clean);
  const strict = (line: Line) => bare(line) && startsWithWord(line) && (hasModelToken(line.clean, brands) || hasCapacity(line));
  // A priced list ("My passport 1tb @325+vat" / "Seagate expansion 1tb @295+vat"): every line has its own price, so every line is its own product.
  const priced = block.length >= 2 && block.every((line) => findPrice(line.clean) !== null && /^[A-Za-z]{2}/.test(line.clean));
  const unpriced =
    block.length >= 3
      ? block.every((line) => bare(line) && (hasModelToken(line.clean, brands) || (startsWithWord(line) && hasCapacity(line))))
      : block.length === 2
        ? block.every(strict)
        : hasCapacity(block[0] as Line) && strict(block[0] as Line);
  const plain = priced || unpriced;
  if (plain && !block.some((line) => line.clean.includes("|"))) {
    return block.flatMap((line) => buildItem([line], brands, categories, null, true) ?? []);
  }

  // Zero or one product-like line: the whole block is one item (e.g. the six-line "Dell 5440 / i7 16/512 / DOS / 25pc ready / 2450+ / UAE").
  if (likeIndexes.length < 2) {
    const item = buildItem(block, brands, categories, null);
    return item ? [item] : [];
  }

  // Several product-like lines: one item per such line, with the lines that follow it (specs, price, quantity) attached.
  let contextBrand: string | null = null;
  for (const line of block.slice(0, likeIndexes[0])) contextBrand = headingBrand(line, brands) ?? contextBrand;

  const items: Omit<ParsedItem, "position">[] = [];
  likeIndexes.forEach((likeIndex, k) => {
    const next = likeIndexes[k + 1];
    const endIndex = (next === undefined ? block.length : startOf(next)) - 1;
    const item = buildItem(block.slice(startOf(likeIndex), endIndex + 1), brands, categories, contextBrand);
    if (item) items.push(item);
  });
  return items;
}

type DraftItem = Omit<ParsedItem, "position">;

/** An item that is only a price: no brand, part number, spec or quantity, and no stock words (for example the "AED 14900" line on its own). */
const isPriceOnly = (item: DraftItem) => item.priceAmount !== null && !item.brandText && !item.partNumber && !item.specText && item.quantity === null && item.stockStatus === "UNKNOWN";

/**
 * A blank line between a product and its price makes a separate block, so the price would become an item of its own with no product.
 * A price-only item that directly follows an item with no price (only blank lines between) is that item's price: it is moved onto it.
 * An item that already has a price is never touched.
 */
function attachSplitPrices(items: DraftItem[], lines: Line[]): DraftItem[] {
  const result: DraftItem[] = [];
  for (const item of items) {
    const previous = result[result.length - 1];
    const identified = previous && (previous.brandText || previous.modelText || previous.partNumber);
    const onlyBlankBetween = previous ? lines.slice(previous.sourceLineEnd, item.sourceLineStart - 1).every((line) => line.clean === "") : false;
    if (previous && identified && previous.priceAmount === null && isPriceOnly(item) && onlyBlankBetween) {
      previous.priceAmount = item.priceAmount;
      previous.currencyCode = item.currencyCode; // still only when written
      previous.vatState = item.vatState;
      previous.sourceLineEnd = item.sourceLineEnd;
      previous.sourceText = lines.slice(previous.sourceLineStart - 1, item.sourceLineEnd).map((line) => line.raw).join("\n");
      previous.confidence = previous.brandText && (previous.modelText || previous.partNumber) && item.currencyCode ? "HIGH" : "MEDIUM";
      previous.extractedData = { ...previous.extractedData, reasons: [...previous.extractedData.reasons, ...item.extractedData.reasons, "price taken from the line after a blank line (it had no product of its own)"] };
      continue;
    }
    result.push({ ...item });
  }
  return result;
}

export const rulesParser: BroadcastParser = {
  name: PARSER_NAME,
  version: PARSER_VERSION,
  parse(rawText: string, context: ParseContext): ParsedItem[] {
    // "SUPPLIER : ..." / "CONTACT : ..." lines say who sent it, not what is for sale: they are read as blank lines (line numbers stay).
    const read = toLines(rawText).map((line) => (HEADER_LINE.test(line.clean) ? { ...line, clean: "" } : line));
    // The sender's signature at the end says who sent it, not what is for sale: it is read as blank lines too (see `readSignature`).
    const skip = new Set(readSignature(read)?.lineNumbers ?? []);
    const notSignature = read.map((line) => (skip.has(line.number) ? { ...line, clean: "" } : line));
    // A spreadsheet price list (a header row names the columns) is read by column; its lines are then not read again as free text.
    const table = readTableRows(notSignature, context, { parser: PARSER_NAME, version: PARSER_VERSION });
    const lines = notSignature.map((line) => (table.consumed.has(line.number) ? { ...line, clean: "" } : line));
    const items = attachSplitPrices(toBlocks(lines).flatMap((block) => itemsFromBlock(block, context.brands, context.categories)), lines);
    const all = [...items, ...table.items].sort((a, b) => a.sourceLineStart - b.sourceLineStart);
    return all.map((item, index) => ({ ...item, position: index + 1 }));
  },
};
