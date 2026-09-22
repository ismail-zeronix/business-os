import type { ExtractionConfidence, StockStatus, VatState } from "../../../generated/prisma/enums";

/**
 * One product line proposed by a parser. Everything here is a PROPOSAL for a human to review; nothing is truth until confirmed.
 * A field the parser could not determine is null / UNKNOWN. It is never guessed and never defaulted (in particular, currency is only
 * set when it is written in the text).
 */
export type ParsedItem = {
  position: number;
  /** The original raw lines this item came from, exactly as written. */
  sourceText: string;
  /** 1-based, inclusive line numbers in the raw broadcast. */
  sourceLineStart: number;
  sourceLineEnd: number;
  confidence: ExtractionConfidence;
  description: string | null;
  brandText: string | null;
  modelText: string | null;
  partNumber: string | null;
  specText: string | null;
  quantity: number | null;
  /** Decimal string ("2450" or "2450.50"), or null. */
  priceAmount: string | null;
  /** ISO code, only when written in the text. */
  currencyCode: string | null;
  vatState: VatState;
  stockStatus: StockStatus;
  /** Why the parser decided what it did, plus hints that have no typed column yet (e.g. market). Stored write-once. */
  extractedData: {
    parser: string;
    version: string;
    reasons: string[];
    hints: Record<string, string>;
  };
};

export type ParseContext = {
  /** Brand names from the Brand master list (e.g. "Dell", "HP"). Only these are recognised as brands. */
  brands: string[];
};

/**
 * Parser interface. The rules-based parser is the first implementation; an LLM extractor could later implement the same interface as an
 * OPTIONAL aid. Either way the output is a proposal that a person must confirm.
 */
export interface BroadcastParser {
  readonly name: string;
  readonly version: string;
  parse(rawText: string, context: ParseContext): ParsedItem[];
}
