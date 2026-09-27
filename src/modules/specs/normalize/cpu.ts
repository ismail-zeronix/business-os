import type { Hit } from "../types";

/**
 * CPU wording -> one canonical string, by rules (no catalog). "U7-256V", "Ultra7 256V" and "Intel Core Ultra 7 256V" all give
 * `intel/core-ultra/7/256V`. A tier with no SKU ("Ultra 7") gives `intel/core-ultra/7`: still a valid, less specific value.
 * Canonical forms: intel/core-ultra/<tier>[/<sku>], intel/core/i<n>[/<sku>], intel/core/<n>/<sku>, amd/ryzen/<n>[/<sku>], qualcomm/snapdragon[/x2-elite], apple/m5[/pro|max|ultra]. Ultra tiers may be X7 / X9 (lower case).
 */

export type CpuValue = { canonical: string; complete: boolean };

/** A bare number right after a tier is only a SKU when it is not really a capacity or storage word ("Ultra 7 256 SSD"). */
const NOT_A_SKU_AFTER = /^\s*(?:gb|tb|mb|ssd|hdd|nvme|ram|pcie|g\b)/i;
const CAPACITY_SUFFIX = /^\d{3,5}(?:GB|TB|MB)$/i;

function cleanSku(sku: string | undefined, after: string): string | null {
  if (!sku) return null;
  const upper = sku.toUpperCase();
  if (CAPACITY_SUFFIX.test(upper)) return null;
  if (/^\d+$/.test(upper) && NOT_A_SKU_AFTER.test(after)) return null;
  return upper;
}

type Rule = { pattern: RegExp; build: (m: RegExpExecArray, after: string) => CpuValue };

const withSku = (base: string, sku: string | null): CpuValue => ({ canonical: sku ? `${base}/${sku}` : base, complete: sku !== null });

const RULES: Rule[] = [
  { pattern: /\b(?:intel\s+)?(?:core\s*)?ultra[\s-]*([3579]|x[3579])\b(?:[\s-]*(\d{3}[A-Z]{0,2})\b)?/i, build: (m, after) => withSku(`intel/core-ultra/${m[1]!.toLowerCase()}`, cleanSku(m[2], after)) },
  { pattern: /\bu([3579])[\s-]*(\d{3}[A-Z]{0,2})\b/i, build: (m, after) => withSku(`intel/core-ultra/${m[1]}`, cleanSku(m[2], after)) },
  { pattern: /\b(?:core\s*)?c?i([3579])(?:[\s-]*(\d{4,5}(?:G\d)?[A-Z]{0,2}))?\b/i, build: (m, after) => withSku(`intel/core/i${m[1]}`, cleanSku(m[2], after)) },
  { pattern: /\bcore\s*([3579])(?!\d)(?:[\s-]*(\d{3}[A-Z]{1,2})\b)?/i, build: (m, after) => withSku(`intel/core/${m[1]}`, cleanSku(m[2], after)) },
  { pattern: /\bm([1-9])(?:\s*(pro|max|ultra))?\b(?!\s*(?:nvme|ssd|sata|pcie|slot|\.2))/i, build: (m) => ({ canonical: `apple/m${m[1]}${m[2] ? `/${m[2].toLowerCase()}` : ""}`, complete: true }) },
  { pattern: /\b(?:qualcomm\s*)?snapdragon(?:\s*(x\d?(?:\s*(?:elite|plus))?))?/i, build: (m) => ({ canonical: m[1] ? `qualcomm/snapdragon/${m[1].toLowerCase().replace(/\s+/g, "-")}` : "qualcomm/snapdragon", complete: false }) },
  { pattern: /\b(?:amd\s*)?ryzen\s*(?:ai\s*)?([3579])(?:\s*(\d{4}[A-Z]{0,2}\d?))?\b/i, build: (m, after) => withSku(`amd/ryzen/${m[1]}`, cleanSku(m[2], after)) },
  { pattern: /\br([3579])[\s-]*(\d{4}[A-Z]{0,2})\b/i, build: (m, after) => withSku(`amd/ryzen/${m[1]}`, cleanSku(m[2], after)) },
];

/** The first CPU named in the text, or null. A SKU makes it HIGH confidence; a tier or family alone is MEDIUM. */
export function parseCpu(text: string): Hit<CpuValue> | null {
  let best: Hit<CpuValue> | null = null;
  for (const rule of RULES) {
    const match = rule.pattern.exec(text);
    if (!match) continue;
    const end = match.index + match[0].length;
    if (best && best.index <= match.index) continue;
    const value = rule.build(match, text.slice(end));
    best = { value, raw: match[0].trim(), confidence: value.complete ? "HIGH" : "MEDIUM", index: match.index, end };
  }
  return best;
}

/** Canonical CPU string -> readable name ("intel/core-ultra/7/256V" -> "Intel Core Ultra 7 256V"). Unknown shapes come back unchanged. */
export function formatCpu(canonical: string): string {
  const [vendor, line, third, sku] = canonical.split("/");
  const tail = sku ? ` ${sku}` : "";
  if (vendor === "intel" && line === "core-ultra" && third) return `Intel Core Ultra ${third.toUpperCase()}${tail}`;
  if (vendor === "intel" && line === "core" && third) return third.startsWith("i") ? `Intel Core ${third}${sku ? `-${sku}` : ""}` : `Intel Core ${third}${tail}`;
  if (vendor === "amd" && line === "ryzen" && third) return `AMD Ryzen ${third}${tail}`;
  if (vendor === "apple" && line) return `Apple ${line.toUpperCase()}${third ? ` ${third.charAt(0).toUpperCase()}${third.slice(1)}` : ""}`;
  if (vendor === "qualcomm" && line === "snapdragon") return `Qualcomm Snapdragon${third ? ` ${third.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}` : ""}`;
  return canonical;
}
