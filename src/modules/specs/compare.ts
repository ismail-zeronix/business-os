/**
 * Does a product's known specification contradict another reading of the same product (for example a supplier's line)? Pure.
 * Used to stop two configurations of one model, or two lines that share a platform code such as Dell's "FCT2250", from being
 * treated as one product. Only attributes BOTH sides state are compared: a missing one is unknown, never a conflict.
 */

export type ComparableAttribute = { attributeKey: string; valueText: string | null; valueNum: number | null; valueList: string[] };

/** Attributes where a shorter value is a less specific form of a longer one (CPU tier vs tier + SKU, "windows-11" vs "windows-11-pro"). */
const PREFIX_KEYS = new Set(["cpu", "os"]);

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((v) => b.includes(v));

function agree(key: string, a: ComparableAttribute, b: ComparableAttribute): boolean {
  if (a.valueList.length || b.valueList.length) return sameSet(a.valueList, b.valueList);
  if (a.valueNum !== null || b.valueNum !== null) return a.valueNum !== null && b.valueNum !== null && Math.abs(a.valueNum - b.valueNum) < 0.5;
  const x = a.valueText ?? "";
  const y = b.valueText ?? "";
  if (PREFIX_KEYS.has(key)) return x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`) || x.startsWith(`${y}-`) || y.startsWith(`${x}-`);
  return x === y;
}

export type AttributeComparison = { conflicts: string[]; agreements: string[] };

export function compareAttributes(a: readonly ComparableAttribute[], b: readonly ComparableAttribute[]): AttributeComparison {
  const byKey = new Map(b.map((x) => [x.attributeKey, x]));
  const conflicts: string[] = [];
  const agreements: string[] = [];
  for (const x of a) {
    const y = byKey.get(x.attributeKey);
    if (!y) continue;
    (agree(x.attributeKey, x, y) ? agreements : conflicts).push(x.attributeKey);
  }
  return { conflicts, agreements };
}
