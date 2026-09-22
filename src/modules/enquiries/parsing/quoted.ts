/**
 * Quoted reply detection. A reply email quotes the earlier conversation; that text is not the customer's new request, so the parser and
 * the email scorer ignore it. The evidence itself is never altered: this only decides how many leading lines count as "visible".
 * Pure functions, no I/O. Line numbers are always those of the original text.
 */

const QUOTE_MARKERS: RegExp[] = [
  /^\s*>/, // "> quoted line"
  /^\s*On .{5,120} wrote:\s*$/i, // "On Mon, 12 Oct 2026, Ahmed wrote:"
  /^\s*-{2,}\s*Original Message\s*-{2,}/i, // "----- Original Message -----"
  /^\s*_{5,}\s*$/, // Outlook divider
];

const OUTLOOK_HEADER = /^\s*From:\s.+/i;
const OUTLOOK_FOLLOW = /^\s*(?:Sent|Date):\s.+/i;

/** Number of leading lines before the quoted part begins (the total when nothing is quoted). Search starts at `startAt` (0-based). */
export function visibleLineCount(rawText: string, startAt = 0): number {
  const lines = rawText.split(/\r\n|\r|\n/);
  for (let i = Math.max(0, startAt); i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (QUOTE_MARKERS.some((marker) => marker.test(line))) return i;
    if (OUTLOOK_HEADER.test(line) && lines.slice(i + 1, i + 4).some((next) => OUTLOOK_FOLLOW.test(next))) return i;
  }
  return lines.length;
}

/**
 * Line count of the header block that an email's evidence text starts with (From / To / Cc / Date / Subject, then a blank line),
 * or 0 when the text does not start with one. Used to keep header lines out of requirement parsing.
 */
export function emailHeaderLineCount(rawText: string): number {
  const lines = rawText.split(/\r\n|\r|\n/);
  if (!/^From:\s/.test(lines[0] ?? "")) return 0;
  const blank = lines.findIndex((line) => line.trim() === "");
  return blank === -1 ? 0 : blank + 1;
}

/** 0-based index of the "Subject:" line inside an email evidence header, or -1. Lets the parser fall back to the subject alone. */
export function emailSubjectLineIndex(rawText: string): number {
  const header = emailHeaderLineCount(rawText);
  if (header === 0) return -1;
  return rawText.split(/\r\n|\r|\n/).slice(0, header).findIndex((line) => /^Subject:\s/i.test(line));
}
