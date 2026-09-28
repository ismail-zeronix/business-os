import type { Prisma } from "../../generated/prisma/client";
import type { RequirementImportance, RequirementOperator } from "./types";

/**
 * How well a product's own specification (`product_attributes`: what it IS, no operator or importance) satisfies one customer
 * requirement (`enquiry_requirements`: what they asked for, with an operator and MUST/SHOULD/NICE). The counterpart of
 * `compare.ts`'s `compareAttributes` (which only checks whether two flat attribute sets agree, with no operator or direction) —
 * this module is operator-aware and direction-aware, so "at least 16GB, product has 32GB" reads UPGRADE, not just "agree".
 *
 * EXACT = satisfies the requirement precisely. UPGRADE = satisfies it and exceeds it (more RAM/storage than asked, a lower
 * price/weight ceiling than the maximum asked). COMPATIBLE = satisfies it via a looser match (a more specific CPU/OS edition
 * than asked, or a BETWEEN value just outside the stated range). PARTIAL = satisfies some but not all of a multi-value
 * requirement (some but not all requested keyboard languages), or the product is a broader family than the specific thing
 * asked for. MISMATCH = contradicts the requirement. UNKNOWN = the product has no value on record for that attribute.
 */

export type SpecVerdict = "EXACT" | "COMPATIBLE" | "UPGRADE" | "PARTIAL" | "MISMATCH" | "UNKNOWN";

/** Best to worst, used both to rank candidates and to decide the worst verdict among a set (e.g. every MUST requirement). */
export const SPEC_VERDICT_SEVERITY: Record<SpecVerdict, number> = {
  UPGRADE: 5,
  EXACT: 4,
  COMPATIBLE: 3,
  PARTIAL: 2,
  UNKNOWN: 1,
  MISMATCH: 0,
};

/** One `enquiry_requirements` row's comparable shape (Decimal fields already converted to plain numbers by the caller). */
export type RequirementInput = {
  attributeKey: string;
  operator: RequirementOperator;
  importance: RequirementImportance;
  valueText: string | null;
  valueNum: number | null;
  valueNumMax: number | null;
  valueList: string[] | null;
};

/** One `product_attributes` row's comparable shape. */
export type AttributeInput = { attributeKey: string; valueText: string | null; valueNum: number | null; valueList: string[] };

export type RequirementVerdict = { attributeKey: string; importance: RequirementImportance; verdict: SpecVerdict };

/** The raw Prisma shape of an active `EnquiryRequirement` row (valueNum/valueNumMax as Decimal), for `toRequirementInput`. */
export type PersistedRequirement = {
  attributeKey: string;
  operator: RequirementOperator;
  importance: RequirementImportance;
  valueText: string | null;
  valueNum: Prisma.Decimal | null;
  valueNumMax: Prisma.Decimal | null;
  valueList: string[];
};

export function toRequirementInput(r: PersistedRequirement): RequirementInput {
  return {
    attributeKey: r.attributeKey,
    operator: r.operator,
    importance: r.importance,
    valueText: r.valueText,
    valueNum: r.valueNum === null ? null : Number(r.valueNum),
    valueNumMax: r.valueNumMax === null ? null : Number(r.valueNumMax),
    valueList: r.valueList,
  };
}

/** Numeric equality tolerance, matching `compare.ts`'s existing epsilon for the same reason (rounding in stored decimals). */
const NUMBER_TOLERANCE = 0.5;

/** Attributes where a shorter value is a less specific form of a longer one — same constant/logic as `compare.ts`. */
const PREFIX_KEYS = new Set(["cpu", "os"]);

type TextRelation = "equal" | "attribute-more-specific" | "attribute-broader" | "different";

function textRelation(requirementValue: string, attributeValue: string): TextRelation {
  if (requirementValue === attributeValue) return "equal";
  if (attributeValue.startsWith(`${requirementValue}/`) || attributeValue.startsWith(`${requirementValue}-`)) return "attribute-more-specific";
  if (requirementValue.startsWith(`${attributeValue}/`) || requirementValue.startsWith(`${attributeValue}-`)) return "attribute-broader";
  return "different";
}

/** One requirement against one candidate's attribute (or `null` when the product has no value for that key: always UNKNOWN). */
export function verdictForRequirement(requirement: RequirementInput, attribute: AttributeInput | null): SpecVerdict {
  if (!attribute) return "UNKNOWN";

  switch (requirement.operator) {
    case "EQUALS": {
      if (requirement.valueNum !== null) {
        if (attribute.valueNum === null) return "UNKNOWN";
        return Math.abs(attribute.valueNum - requirement.valueNum) < NUMBER_TOLERANCE ? "EXACT" : "MISMATCH";
      }
      if (requirement.valueText !== null) {
        if (attribute.valueText === null) return "UNKNOWN";
        if (!PREFIX_KEYS.has(requirement.attributeKey)) return requirement.valueText === attribute.valueText ? "EXACT" : "MISMATCH";
        const relation = textRelation(requirement.valueText, attribute.valueText);
        if (relation === "equal") return "EXACT";
        if (relation === "attribute-more-specific") return "COMPATIBLE"; // e.g. asked "windows-11", product states "windows-11-pro"
        if (relation === "attribute-broader") return "PARTIAL"; // e.g. asked "windows-11-pro", product only states "windows-11"
        return "MISMATCH";
      }
      return "UNKNOWN";
    }
    case "GREATER_THAN_OR_EQUAL": {
      if (requirement.valueNum === null || attribute.valueNum === null) return "UNKNOWN";
      if (attribute.valueNum > requirement.valueNum + NUMBER_TOLERANCE) return "UPGRADE";
      if (attribute.valueNum >= requirement.valueNum - NUMBER_TOLERANCE) return "EXACT";
      return "MISMATCH";
    }
    case "LESS_THAN_OR_EQUAL": {
      if (requirement.valueNum === null || attribute.valueNum === null) return "UNKNOWN";
      if (attribute.valueNum < requirement.valueNum - NUMBER_TOLERANCE) return "UPGRADE";
      if (attribute.valueNum <= requirement.valueNum + NUMBER_TOLERANCE) return "EXACT";
      return "MISMATCH";
    }
    case "BETWEEN": {
      if (requirement.valueNum === null || requirement.valueNumMax === null || attribute.valueNum === null) return "UNKNOWN";
      const lower = requirement.valueNum;
      const upper = requirement.valueNumMax;
      if (attribute.valueNum >= lower - NUMBER_TOLERANCE && attribute.valueNum <= upper + NUMBER_TOLERANCE) return "EXACT";
      // A near miss within one requested span's width beyond either edge (floored at 0.1 so a degenerate zero-width
      // range still has a real near-miss band) is worth a person's look, on top of the rounding tolerance above.
      const nearMiss = Math.max(upper - lower, 0.1);
      if (attribute.valueNum >= lower - NUMBER_TOLERANCE - nearMiss && attribute.valueNum <= upper + NUMBER_TOLERANCE + nearMiss) return "COMPATIBLE";
      return "MISMATCH";
    }
    case "IN": {
      const wanted = requirement.valueList ?? [];
      if (wanted.length === 0 || attribute.valueList.length === 0) return "UNKNOWN";
      const have = new Set(attribute.valueList);
      const covered = wanted.filter((v) => have.has(v));
      if (covered.length === wanted.length) return "EXACT";
      if (covered.length > 0) return "PARTIAL";
      return "MISMATCH";
    }
    case "CONTAINS": {
      if (requirement.valueText === null || attribute.valueText === null) return "UNKNOWN";
      return attribute.valueText.toLowerCase().includes(requirement.valueText.toLowerCase()) ? "EXACT" : "MISMATCH";
    }
  }
}

/** Every active requirement against one candidate product's active attributes. Missing attributes yield UNKNOWN, never skipped. */
export function compareRequirementsToProduct(requirements: readonly RequirementInput[], attributes: readonly AttributeInput[]): RequirementVerdict[] {
  const byKey = new Map(attributes.map((a) => [a.attributeKey, a]));
  return requirements.map((r) => ({ attributeKey: r.attributeKey, importance: r.importance, verdict: verdictForRequirement(r, byKey.get(r.attributeKey) ?? null) }));
}

/**
 * One verdict for a candidate: the worst verdict among its MUST requirements (a SHOULD/NICE mismatch never blocks or drags down
 * the headline verdict). Falls back to the worst among all requirements only when there are no MUST rows at all.
 */
export function overallVerdict(perRequirement: readonly { importance: RequirementImportance; verdict: SpecVerdict }[]): SpecVerdict {
  const musts = perRequirement.filter((p) => p.importance === "MUST");
  const pool = musts.length > 0 ? musts : perRequirement;
  if (pool.length === 0) return "UNKNOWN";
  return pool.reduce((worst, p) => (SPEC_VERDICT_SEVERITY[p.verdict] < SPEC_VERDICT_SEVERITY[worst] ? p.verdict : worst), pool[0]!.verdict);
}
