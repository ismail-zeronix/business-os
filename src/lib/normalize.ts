/**
 * Normalisation used for uniqueness and matching. Pure functions, no I/O.
 * Rules are documented in docs/architecture/DATA_MODEL.md (section 4) and docs/modules/PRODUCTS.md.
 */

/** For names (brand, category, supplier): NFKC, trim, collapse whitespace, lower-case. "  ABC   Computers " -> "abc computers". */
export function normalizeName(input: string): string {
  return input.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** For codes (part number, model, alias): NFKC, upper-case, strip everything except letters and digits. "83a100-suak" -> "83A100SUAK". */
export function normalizeCode(input: string): string {
  return input
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** Like normalizeCode, but returns null for missing or empty-after-normalisation input (unknown stays unknown). */
export function normalizeCodeOrNull(input: string | null | undefined): string | null {
  if (input == null) return null;
  const normalized = normalizeCode(input);
  return normalized === "" ? null : normalized;
}
