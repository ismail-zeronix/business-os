import { formatDateTime } from "../../../lib/format";
import type { EvidencePackage } from "./types";

/**
 * The evidence package as the text every provider receives: the same bytes whichever provider is active. Names come from the database;
 * the package as a whole is data, and the prompt says so.
 */
export function renderPackage(pkg: EvidencePackage, now: Date): string {
  const lines: string[] = ["<evidence_package>", `Checked: ${formatDateTime(now)} (Asia/Dubai time)`];

  if (pkg.entity) lines.push(`The colleague is looking at a ${pkg.entity.type.toLowerCase()} page.`);
  if (pkg.searched.length > 0) lines.push(`Searched for: ${pkg.searched.map((s) => `"${s}"`).join(", ")}`);
  lines.push(`Products found: ${pkg.totalFound}${pkg.totalFound > pkg.products.length ? ` (the first ${pkg.products.length} are listed)` : ""}`);

  if (pkg.products.length > 0) {
    lines.push("", "Products:");
    for (const p of pkg.products) {
      const facts = [
        p.partNumber ? `part number ${p.partNumber}` : "part number not recorded",
        p.brandName ? `brand ${p.brandName}` : null,
        p.categoryName ? `category ${p.categoryName}` : null,
        p.matchLabel,
        p.isTemporary ? "TEMPORARY product, details not verified" : null,
      ].filter(Boolean);
      lines.push(`${p.ref}  ${p.name} | ${facts.join(" | ")}`);
    }
  }

  if (pkg.suppliers.length > 0) {
    lines.push("", "Suppliers:");
    for (const s of pkg.suppliers) lines.push(`${s.ref}  ${s.name}`);
  }

  lines.push("", "Supplier evidence (latest per supplier and product):");
  if (pkg.evidence.length === 0) lines.push("None. No supplier has stated a price or stock for these products.");
  for (const e of pkg.evidence) lines.push(e.line);

  lines.push("", "System checks (computed separately and always shown to the user):", `Confidence: ${Math.round(pkg.checks.score * 100)}% (${pkg.checks.level})`);
  for (const w of pkg.checks.warnings) lines.push(`- warning: ${w}`);
  for (const m of pkg.checks.missing) lines.push(`- missing: ${m}`);

  if (pkg.rules.length > 0) {
    lines.push("", "Domain facts:");
    for (const r of pkg.rules) lines.push(`- ${r}`);
  }

  lines.push("</evidence_package>");
  return lines.join("\n");
}
