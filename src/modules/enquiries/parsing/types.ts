import type { ExtractionConfidence } from "../../../generated/prisma/enums";

/**
 * One customer requirement line proposed by the parser. Everything here is a PROPOSAL for a person to review; nothing is truth until
 * confirmed. A field the parser could not determine is null. It is never guessed, defaulted or "normalised" (e.g. "U7" stays "U7").
 */
export type ParsedEnquiryItem = {
  position: number;
  /** The original raw lines this item came from, exactly as written. */
  sourceText: string;
  /** 1-based, inclusive line numbers in the raw text (the evidence's own numbering). */
  sourceLineStart: number;
  sourceLineEnd: number;
  confidence: ExtractionConfidence;
  description: string | null;
  brandText: string | null;
  familyText: string | null;
  modelText: string | null;
  partNumber: string | null;
  specText: string | null;
  quantity: number | null;
  /** Why the parser decided what it did, plus detected attributes (cpu, ram, storage, os). Stored write-once with the item. */
  extractedData: {
    parser: string;
    version: string;
    reasons: string[];
    hints: Record<string, string>;
  };
};

/** Suggestions for the enquiry header. Shown with an Apply button; never saved until a person applies them. */
export type EnquiryHeaderProposal = {
  deliveryLocation: string | null;
  /** Only ever URGENT, and only when the text says so ("urgent", "asap"...). Otherwise null (no opinion). */
  priority: "URGENT" | null;
  /** The wording as written ("by Friday", "within 3 days"). A person sets the real date. */
  requiredByText: string | null;
  reasons: string[];
};

export type EnquiryParseContext = {
  /** Brand names from the Brand master list. Only these are recognised as brands. */
  brands: string[];
  /** Distinct product family names from the product master (e.g. "Latitude"). Only these are recognised as families. */
  families: string[];
  /** Leading lines to ignore (an email's rendered header block). Line numbers are still those of the full text. Default 0. */
  skipLeadingLines?: number;
};

export type EnquiryParseResult = { header: EnquiryHeaderProposal; items: ParsedEnquiryItem[] };

/**
 * Parser interface. The rules-based parser is the first implementation; an LLM extractor could later implement the same interface as an
 * OPTIONAL aid. Either way the output is a proposal that a person must confirm.
 */
export interface EnquiryParser {
  readonly name: string;
  readonly version: string;
  parse(rawText: string, context: EnquiryParseContext): EnquiryParseResult;
}
