/**
 * Shared vocabulary of the specification layer (pure, no I/O). The string values mirror the Prisma enums `RequirementOperator`,
 * `RequirementImportance`, `RequirementSource` and `ExtractionConfidence`, so a proposal can be written to the database as is.
 */

export const REQUIREMENT_OPERATORS = ["EQUALS", "GREATER_THAN_OR_EQUAL", "LESS_THAN_OR_EQUAL", "IN", "BETWEEN", "CONTAINS"] as const;
export type RequirementOperator = (typeof REQUIREMENT_OPERATORS)[number];

/** How much the customer's wording matters. "Preferred" is an importance (NICE), not a comparison. */
export const REQUIREMENT_IMPORTANCES = ["MUST", "SHOULD", "NICE"] as const;
export type RequirementImportance = (typeof REQUIREMENT_IMPORTANCES)[number];

export type SpecConfidence = "HIGH" | "MEDIUM" | "LOW";

/** One thing a normalizer found in free text: the canonical value, the words as written, and where they were. */
export type Hit<V> = { value: V; raw: string; confidence: SpecConfidence; index: number; end: number };

/** A structured requirement proposed from text. Nothing is defaulted: only what the text says. A person confirms it. */
export type ProposedRequirement = {
  attributeKey: string;
  operator: RequirementOperator;
  importance: RequirementImportance;
  confidence: SpecConfidence;
  /** The words as written ("512GB SSD"). */
  rawValue: string;
  valueText: string | null;
  valueNum: number | null;
  valueNumMax: number | null;
  valueList: string[] | null;
  unit: string | null;
};
