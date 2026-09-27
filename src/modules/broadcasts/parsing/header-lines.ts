import { toLines } from "./text";

/**
 * "SUPPLIER : HESABI COMPUTERS" and "CONTACT : RAMSHAD": the footer lines of a supplier's WhatsApp list say who sent it. They are not products
 * (the parser skips them) and they let the broadcast form pick the supplier and contact. Pure functions, no I/O.
 */

/** Label words. One place, so the parser, the form and the @ mentions agree on what counts as a header line. */
export const SUPPLIER_LABELS = "supplier|supp|company|vendor";
export const CONTACT_LABELS = "contact|person|attn|attention";

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

// ─────────────────────────────── signature block ───────────────────────────────

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const COMPANY_WORD = /\b(?:llc|l\.l\.c|ltd|fze|fzc|fzco|est|trading|computers?|technolog(?:y|ies)|systems?|solutions?|electronics|enterprises?)\b/i;

/** A phone number: 8 to 15 digits with only spaces, dashes, dots, brackets and a leading + or 00 around them. */
function phoneIn(line: string): string | null {
  const match = /(?:\+|00)?\d[\d\s().-]{6,18}\d/.exec(line);
  if (!match) return null;
  const digits = match[0].replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? match[0].trim() : null;
}

const isCompanyLine = (line: string) => COMPANY_WORD.test(line) && !/\d/.test(line) && !line.includes("@");
/** A person's name: two to four words of letters (and dots), nothing else on the line. */
const isNameLine = (line: string) => /^[\p{L}][\p{L}.'-]*(?:\s+[\p{L}][\p{L}.'-]*){1,3}$/u.test(line) && !COMPANY_WORD.test(line);

export type Signature = { company: string | null; contact: string | null; email: string | null; phone: string | null };

/**
 * The sender's signature at the end of a list: a last block made ONLY of a company line, an e-mail, a phone number and a person's name
 * (the message has no label words). Any other line in that block means it is not a signature and nothing is read. Returns the block's
 * 1-based line numbers so the product parser can skip them. Pure; the values are proposals for a person to confirm.
 */
export function readSignature(lines: readonly { number: number; clean: string }[]): { signature: Signature; lineNumbers: number[] } | null {
  const blocks: { number: number; clean: string }[][] = [];
  let current: { number: number; clean: string }[] = [];
  for (const line of lines) {
    if (line.clean === "") {
      if (current.length) blocks.push(current);
      current = [];
    } else current.push(line);
  }
  if (current.length) blocks.push(current);
  // The signature is the last block ("RED DATA ..." footer) or the first one (a banner: company, contact, phone, "W.T.S").
  for (const block of [blocks[blocks.length - 1], blocks[0]]) {
    const read = block ? readSignatureBlock(block, lines) : null;
    if (read) return read;
  }
  return null;
}

const EMPTY_LABEL = new RegExp(`^(?:${SUPPLIER_LABELS}|${CONTACT_LABELS})\\s*[:\\-–]\\s*$`, "i");
/** "Samir - +971 50 726 8421": a first name and a number on one line. */
const NAME_AND_PHONE = /^([\p{L}][\p{L}.' ]{1,40}?)\s*[-–:]\s*(\+?[\d\s().-]{8,20})$/u;

/** Decoration that wraps a banner line: "|| Lapcom Technologies LLC ||", and "W.T.S" (want to sell). */
const bannerText = (clean: string) => clean.replace(/^[\s|]+|[\s|]+$/g, "");
const isWantToSell = (text: string) => /^w\.?t\.?s\.?$/i.test(text);

function readSignatureBlock(last: { number: number; clean: string }[], lines: readonly { number: number; clean: string }[]): { signature: Signature; lineNumbers: number[] } | null {
  const signature: Signature = { company: null, contact: null, email: null, phone: null };
  for (const line of last) {
    const text = bannerText(line.clean);
    if (text === "" || isWantToSell(text)) continue;
    if (EMPTY_LABEL.test(text)) continue; // "SUPP :" with the name on the next line
    if (/^category\s*[:\-–]/i.test(text)) continue; // "CATEGORY : NETWORKING" describes the list, it is not a name
    if (/^[-–—_=~*.]+$/.test(text)) continue; // a rule line under the company name
    if (/^(?:website|web|site|www\.|https?:)/i.test(text)) continue; // the company's web address
    const call = /^(?:call|contact\s*(?:no|number)?|tel|telephone|phone|mobile|mob|whatsapp|wa)\b[\s:.@-]*(.*)$/i.exec(text)?.[1];
    if (call !== undefined && phoneIn(call)) { signature.phone ??= phoneIn(call); continue; }
    if (/^(?:call|whatsapp|contact\s+us|dm)\b/i.test(text) && !/\d/.test(text)) continue; // "Call or WhatsApp for Special Price": a promotion, not a name
    const labelled = SUPPLIER_LINE.exec(text)?.[1];
    if (labelled && isName(labelled)) { signature.company ??= tidy(labelled); continue; }
    const person = CONTACT_LINE.exec(text)?.[1];
    if (person && isName(person)) { signature.contact ??= tidy(person); continue; }
    const email = EMAIL.exec(text)?.[0];
    if (email && text.replace(email, "").trim() === "") signature.email ??= email.toLowerCase();
    else if (phoneIn(text) && text.replace(/[\d\s().+-]/g, "") === "") signature.phone ??= phoneIn(text);
    else if (isCompanyLine(text)) signature.company ??= text;
    else if (NAME_AND_PHONE.test(text)) {
      const [, name, phone] = NAME_AND_PHONE.exec(text) as RegExpExecArray;
      if (phoneIn(phone as string)) {
        signature.contact ??= (name as string).trim();
        signature.phone ??= phoneIn(phone as string);
      } else return null;
    } else if (isNameLine(text)) signature.contact ??= text;
    else return null; // a line that is none of these: this is product text, not a signature
  }
  if (!signature.email && !signature.phone) return null;

  // The company also heads the message ("RED DATA COMPUTER TRADING LLC" on the first line); the header spelling is preferred over the footer's.
  const first = lines.find((l) => l.clean !== "");
  if (first && isCompanyLine(bannerText(first.clean)) && !last.includes(first)) signature.company = bannerText(first.clean);
  return { signature, lineNumbers: last.map((l) => l.number) };
}

export type SenderNames = HeaderNames & { source: "label" | "signature" | null; email: string | null; phone: string | null };

/**
 * Who sent the list: the labelled "SUPPLIER :" / "CONTACT :" lines when there are any, otherwise the signature block at the end.
 * Proposals only; the form matches them against existing records and never creates anything.
 */
export function readSenderNames(text: string): SenderNames {
  const labelled = readHeaderNames(text);
  const signature = readSignature(toLines(text))?.signature ?? null;
  const source = labelled.supplier || labelled.contact ? "label" : signature ? "signature" : null;
  // Labels win; the signature block fills what they leave out (a "SUPP :" line with the contact name and phone written under it).
  return {
    supplier: labelled.supplier ?? signature?.company ?? null,
    contact: labelled.contact ?? signature?.contact ?? null,
    source,
    email: signature?.email ?? null,
    phone: signature?.phone ?? null,
  };
}
