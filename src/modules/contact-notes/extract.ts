/**
 * Proposes contact details from a pasted supplier message. Pure rules, no AI: it only reads what the text says, and a field it cannot
 * find stays empty (unknown stays unknown). A person reviews and corrects the result before anything is saved.
 */
export type ExtractedContact = { contactName: string | null; company: string | null; phones: string[]; emails: string[] };

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
/** Digits with spaces, dots, dashes and brackets inside, not glued to letters (so a part number like 5CG12345678 is not a phone). */
const PHONE_RE = /(?<![A-Za-z0-9])(?:\+|00)?\d[\d ().\-\t]{6,}\d(?![A-Za-z0-9])/g;
const DATE_RE = /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/;

const NAME_LABEL_RE = /^\s*(?:name|contact(?:\s+person)?|person|attn|attention|sales(?:\s+rep)?|rep)\s*[:\-]\s*(.+?)\s*$/im;
const COMPANY_LABEL_RE = /^\s*(?:company|co|firm|supplier|organi[sz]ation|business)\s*[:\-]\s*(.+?)\s*$/im;
const COMPANY_WORD_RE = /\b(?:LLC|L\.L\.C\.?|FZE|FZ-?LLC|FZCO|LTD|LIMITED|INC|TRADING|COMPUTERS?|TECHNOLOGIES|ELECTRONICS|DISTRIBUTION|EST\.?)\b/i;
const PHONE_LABEL_WORDS = new Set(["tel", "telephone", "mobile", "mob", "phone", "whatsapp", "wa", "call", "cell", "office", "fax", "contact", "no", "number", "ph"]);

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

function findEmails(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.match(EMAIL_RE) ?? []) seen.add(match.toLowerCase());
  return [...seen];
}

type PhoneHit = { display: string; index: number; line: string };

function findPhones(text: string): PhoneHit[] {
  const withoutEmails = text.replace(EMAIL_RE, (m) => " ".repeat(m.length)); // keep offsets, hide digits inside addresses
  const hits: PhoneHit[] = [];
  const seenDigits = new Set<string>();
  for (const match of withoutEmails.matchAll(PHONE_RE)) {
    const raw = match[0].trim();
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15 || DATE_RE.test(raw) || seenDigits.has(digits)) continue;
    seenDigits.add(digits);
    const index = match.index ?? 0;
    const lineStart = withoutEmails.lastIndexOf("\n", index) + 1;
    const lineEnd = withoutEmails.indexOf("\n", index);
    hits.push({ display: clean(raw), index: index - lineStart, line: withoutEmails.slice(lineStart, lineEnd === -1 ? undefined : lineEnd) });
  }
  return hits;
}

const looksLikeName = (value: string) => /^[A-Za-z][A-Za-z .'-]{1,40}$/.test(value) && value.split(" ").length <= 4;
const looksLikeCompany = (value: string) => COMPANY_WORD_RE.test(value) && !/@/.test(value) && value.length <= 80 && !/\d{6,}/.test(value);

/** The words in front of a phone number on its own line ("Ali - 050 123 4567" -> "Ali"), when they read like a name or a company. */
function beforePhone(hit: PhoneHit): string | null {
  const lead = clean(hit.line.slice(0, hit.index).replace(/[\s\-–:,|]+$/, ""));
  const words = lead.split(" ").filter((w) => !PHONE_LABEL_WORDS.has(w.toLowerCase().replace(/[.:]/g, "")));
  const value = words.join(" ");
  return value ? value : null;
}

export function extractContact(text: string): ExtractedContact {
  const emails = findEmails(text);
  const phoneHits = findPhones(text);
  const phones = phoneHits.map((h) => h.display);

  let contactName: string | null = null;
  let company: string | null = null;

  const labelledName = text.match(NAME_LABEL_RE)?.[1];
  if (labelledName && !/@|\d{4,}/.test(labelledName) && labelledName.length <= 60) contactName = clean(labelledName);

  const labelledCompany = text.match(COMPANY_LABEL_RE)?.[1];
  if (labelledCompany && !/@/.test(labelledCompany) && labelledCompany.length <= 80) company = clean(labelledCompany);

  for (const hit of phoneHits) {
    if (contactName && company) break;
    const lead = beforePhone(hit);
    if (!lead) continue;
    if (!company && looksLikeCompany(lead)) company = lead;
    else if (!contactName && looksLikeName(lead) && !looksLikeCompany(lead)) contactName = lead;
  }

  if (!company) {
    const line = text.split("\n").map(clean).find((l) => l && looksLikeCompany(l));
    if (line) company = line;
  }
  if (contactName && company && contactName.toLowerCase() === company.toLowerCase()) contactName = null;

  return { contactName, company, phones, emails };
}
