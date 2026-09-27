import { findBrand, findCategory, findWarranty } from "./extractors";
import type { Line } from "./text";
import type { ParsedItem } from "./types";

/**
 * A price list pasted from a spreadsheet: a header row names the columns ("AED | Model | Description | Others", tab- or pipe-separated) and every
 * row after it is one product. The header decides what each cell means, so nothing about a row's text is guessed: the price column is the price
 * (its currency is the header's when the header is a currency code, or the row's own when written), the model column is the manufacturer model and
 * part number, the description and others columns are the name and the specification text. Pure; the values are proposals for a person to confirm.
 */

type Draft = Omit<ParsedItem, "position">;

const CURRENCY = /^(?:AED|USD|EUR|GBP|SAR|INR)$/i;
const PRICE_HEADER = /^(?:price|rate|cost|unit\s*price|aed|usd|eur|gbp|sar|inr)$/i;
const MODEL_HEADER = /^(?:model|model\s*(?:no|number)|part\s*(?:no|number)?|pn|sku|item\s*(?:code|no))$/i;
const DESCRIPTION_HEADER = /^(?:description|desc|product|item|item\s*name|name)$/i;
const OTHERS_HEADER = /^(?:others?|details?|specs?|specification|remarks?|notes?)$/i;

const cellsOf = (raw: string) => raw.split(/\t|\|/).map((cell) => cell.replace(/\s+/g, " ").trim());

type Columns = { price: number; model: number; description: number; others: number; currency: string | null; width: number };

/** The header row's column layout, or null when the line is not a header (it needs a price column and a model column). */
function readHeader(raw: string): Columns | null {
  const cells = cellsOf(raw);
  if (cells.length < 3) return null;
  const price = cells.findIndex((c) => PRICE_HEADER.test(c));
  const model = cells.findIndex((c) => MODEL_HEADER.test(c));
  if (price < 0 || model < 0) return null;
  const currencyCell = cells[price] as string;
  return {
    price,
    model,
    description: cells.findIndex((c) => DESCRIPTION_HEADER.test(c)),
    others: cells.findIndex((c) => OTHERS_HEADER.test(c)),
    currency: CURRENCY.test(currencyCell) ? currencyCell.toUpperCase() : null,
    width: cells.length,
  };
}

/** "1,035.00" / "AED 615.00" -> the amount and the currency the cell itself writes (if any). */
function readPrice(cell: string): { amount: string; currency: string | null } | null {
  const match = /^(?:(AED|USD|EUR|GBP|SAR|INR)\s*)?(\d[\d,]*(?:\.\d{1,2})?)(?:\s*(AED|USD|EUR|GBP|SAR|INR))?$/i.exec(cell.trim());
  if (!match?.[2]) return null;
  const n = Number(match[2].replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n >= 100_000_000) return null;
  return { amount: Number.isInteger(n) ? String(n) : n.toFixed(2), currency: (match[1] ?? match[3])?.toUpperCase() ?? null };
}

export function readTableRows(
  lines: readonly Line[],
  context: { brands: readonly string[]; categories: readonly string[] },
  meta: { parser: string; version: string },
): { items: Draft[]; consumed: Set<number> } {
  const items: Draft[] = [];
  const consumed = new Set<number>();
  let columns: Columns | null = null;

  for (const line of lines) {
    if (line.raw.trim() === "") continue;
    const header = readHeader(line.raw);
    if (header) {
      columns = header;
      consumed.add(line.number);
      continue;
    }
    if (!columns) continue;

    const cells = cellsOf(line.raw);
    if (cells.length < columns.width - 1 || cells.length > columns.width + 1) continue; // a different shape (a signature, a note): left to the normal reader
    const cell = (index: number) => (index >= 0 ? cells[index] ?? "" : "");
    const price = readPrice(cell(columns.price));
    const model = cell(columns.model);
    if (!price || model === "") continue; // not a product row

    const descriptionCell = cell(columns.description);
    const others = cell(columns.others);
    const brand = findBrand(`${others} ${descriptionCell}`, context.brands as string[]);
    const category = findCategory(descriptionCell || others, context.categories as string[]);
    const warranty = findWarranty(`${descriptionCell} ${others}`);
    const currency = price.currency ?? columns.currency;
    const description = [brand?.name, descriptionCell, model].filter(Boolean).join(" ");

    consumed.add(line.number);
    items.push({
      sourceText: line.raw,
      sourceLineStart: line.number,
      sourceLineEnd: line.number,
      confidence: "HIGH",
      description,
      brandText: brand?.name ?? null,
      modelText: model,
      partNumber: model,
      specText: others || null,
      quantity: null,
      priceAmount: price.amount,
      currencyCode: currency, // written in the header or in the row; never assumed
      vatState: "UNKNOWN",
      stockStatus: "UNKNOWN",
      categoryText: category?.name ?? null,
      warrantyMonths: warranty.months,
      warrantyType: warranty.type,
      extractedData: {
        parser: meta.parser,
        version: meta.version,
        reasons: [
          `spreadsheet row: price "${cell(columns.price)}" from the price column${currency ? `, currency ${currency} ${price.currency ? "written in the cell" : "from the column header"}` : ""}`,
          `model / part number "${model}" from the model column`,
          ...(brand ? [`brand "${brand.name}" (from the brand list)`] : []),
          ...(category ? [category.reason] : []),
        ],
        hints: {},
      },
    });
  }

  // A row that names no brand takes the brand its table names everywhere else, but only when every row that names one names the same brand.
  const named = new Set(items.map((item) => item.brandText).filter((b): b is string => b !== null));
  const only = named.size === 1 ? [...named][0] : undefined;
  if (only) {
    for (const item of items) {
      if (item.brandText !== null) continue;
      item.brandText = only;
      item.description = `${only} ${item.description ?? ""}`.trim();
      item.extractedData.reasons.push(`brand "${only}" taken from the other rows of this table (every row that names a brand names ${only}); please verify`);
    }
  }
  return { items, consumed };
}
