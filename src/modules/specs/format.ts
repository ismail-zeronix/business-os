import { formatCpu } from "./normalize/cpu";
import { ATTRIBUTES, getAttribute, optionLabel } from "./registry";
import type { RequirementImportance, RequirementOperator } from "./types";

/** Requirement -> readable label and value for the UI ("RAM", ">= 16 GB"). Pure; the same wording everywhere. */

export type RequirementValues = {
  attributeKey: string;
  operator: RequirementOperator;
  valueText: string | null;
  valueNum: number | null;
  valueNumMax: number | null;
  valueList: string[];
  unit: string | null;
};

const trimNumber = (value: number) => String(Math.round(value * 100) / 100);

function formatAmount(key: string, value: number, unit: string | null): string {
  if (key === "storage_gb" && value >= 1000 && value % 1000 === 0) return `${value / 1000} TB`;
  return unit ? `${trimNumber(value)} ${unit}` : trimNumber(value);
}

export function requirementLabel(attributeKey: string): string {
  return getAttribute(attributeKey)?.label ?? attributeKey;
}

export function requirementValue(r: RequirementValues): string {
  const spec = getAttribute(r.attributeKey);
  if (r.valueList.length) return r.valueList.map((v) => (spec ? optionLabel(spec, v) : v)).join(" + ");
  if (r.valueText !== null) return r.attributeKey === "cpu" ? formatCpu(r.valueText) : spec ? optionLabel(spec, r.valueText) : r.valueText;
  if (r.valueNum === null) return "";
  const first = formatAmount(r.attributeKey, r.valueNum, r.unit);
  switch (r.operator) {
    case "GREATER_THAN_OR_EQUAL":
      return `at least ${first}`;
    case "LESS_THAN_OR_EQUAL":
      return `at most ${first}`;
    case "BETWEEN":
      return r.valueNumMax === null ? first : `about ${trimNumber((r.valueNum + r.valueNumMax) / 2)}${r.unit ? ` ${r.unit}` : ""}`;
    default:
      return first;
  }
}

export const IMPORTANCE_LABEL: Record<RequirementImportance, string> = { MUST: "Must have", SHOULD: "Should have", NICE: "Nice to have" };

/** A product attribute's value on its own ("16 GB", "Intel Core Ultra 7 256V", "Arabic + English"). */
export function attributeValue(a: { attributeKey: string; valueText: string | null; valueNum: number | null; valueList: string[]; unit: string | null }): string {
  const spec = getAttribute(a.attributeKey);
  if (a.valueList.length) return a.valueList.map((v) => (spec ? optionLabel(spec, v) : v)).join(" + ");
  if (a.valueText !== null) return a.attributeKey === "cpu" ? formatCpu(a.valueText) : spec ? optionLabel(spec, a.valueText) : a.valueText;
  return a.valueNum === null ? "" : formatAmount(a.attributeKey, a.valueNum, a.unit);
}


/** A product's active attributes as short "Label: value" phrases in the registry's order ("RAM: 16 GB", "Storage: 512 GB"). Empty when none is known. */
export function describeAttributes(rows: readonly { attributeKey: string; valueText: string | null; valueNum: number | null; valueList: string[]; unit: string | null }[]): string[] {
  const order = new Map(ATTRIBUTES.map((a, index) => [a.key, index]));
  return [...rows]
    .sort((a, b) => (order.get(a.attributeKey) ?? 99) - (order.get(b.attributeKey) ?? 99))
    .flatMap((row) => {
      const value = attributeValue(row);
      return value === "" ? [] : [`${requirementLabel(row.attributeKey)}: ${value}`];
    });
}
