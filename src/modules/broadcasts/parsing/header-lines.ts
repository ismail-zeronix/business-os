/**
 * "SUPPLIER : HESABI COMPUTERS" and "CONTACT : RAMSHAD": the footer lines of a supplier's WhatsApp list say who sent it. They are not products
 * (the parser skips them) and they let the broadcast form pick the supplier and contact. Pure functions, no I/O.
 */

/** Label words. One place, so the parser, the form and the @ mentions agree on what counts as a header line. */
export const SUPPLIER_LABELS = "supplier|company|vendor";
export const CONTACT_LABELS = "contact|attn|attention";

/** A line that starts with one of the labels and a colon or dash. */
export const HEADER_LINE = new RegExp(`^\\s*(?:${SUPPLIER_LABELS}|${CONTACT_LABELS})\\s*[:\\-–]`, "i");

const SUPPLIER_LINE = new RegExp(`^\\s*(?:${SUPPLIER_LABELS})\\s*[:\\-–]\\s*(.+?)\\s*$`, "i");
const CONTACT_LINE = new RegExp(`^\\s*(?:${CONTACT_LABELS})\\s*[:\\-–]\\s*(.+?)\\s*$`, "i");

export type HeaderNames = { supplier: string | null; contact: string | null };

const tidy = (value: string) => value.replace(/[\s\-–:]+$/, "").trim();

/** A value still being typed with an @ mention ("@hes"), or an email address, is not a name. */
const isName = (value: string) => tidy(value) !== "" && !value.includes("@");

/** The supplier and contact names the message declares, or null. If a label appears more than once, the last one wins (it is the footer). */
export function readHeaderNames(text: string): HeaderNames {
  let supplier: string | null = null;
  let contact: string | null = null;
  for (const line of text.split(/\r\n|\r|\n/)) {
    const s = SUPPLIER_LINE.exec(line)?.[1];
    if (s && isName(s)) supplier = tidy(s);
    const c = CONTACT_LINE.exec(line)?.[1];
    if (c && isName(c)) contact = tidy(c);
  }
  return { supplier, contact };
}

/** Company-form words that suppliers write inconsistently ("… TRADING LLC" / "… TRADING"). Only trailing ones are ignored when comparing. */
const COMPANY_SUFFIX = new Set(["llc", "ltd", "fze", "fzc", "fzco", "inc", "co", "est"]);

/** Case, punctuation, spacing and a trailing company form do not make two names different. Arabic letters are kept. */
export function normalizeForMatch(name: string): string {
  const words = name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  while (words.length > 1 && COMPANY_SUFFIX.has(words[words.length - 1] as string)) words.pop();
  return words.join(" ");
}

export type MatchResult<T> = { kind: "one"; item: T } | { kind: "none" } | { kind: "many" };

/**
 * The single record whose name (or any of its names) equals `name` once normalised. Exactly one match is a match; none or several is not:
 * nothing is guessed, and a partial name ("HESABI") never matches.
 */
export function matchExactlyOne<T>(name: string, items: readonly T[], namesOf: (item: T) => readonly (string | null | undefined)[]): MatchResult<T> {
  const wanted = normalizeForMatch(name);
  if (!wanted) return { kind: "none" };
  const found = items.filter((item) => namesOf(item).some((n) => n && normalizeForMatch(n) === wanted));
  return found.length === 1 ? { kind: "one", item: found[0] as T } : found.length === 0 ? { kind: "none" } : { kind: "many" };
}
