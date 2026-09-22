import { visibleLineCount } from "../enquiries/parsing/quoted";

/**
 * Text helpers for email bodies. Pure functions, no I/O. The original message is never altered by these: they only produce the clean
 * text used for reading, scoring and requirement parsing.
 */

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  bull: "•",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
  pound: "£",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith("#")) {
      const code = body[1]?.toLowerCase() === "x" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * HTML to readable plain text: scripts, styles and comments are dropped, block elements become line breaks, table cells become tabs,
 * remaining tags are stripped and entities decoded. Not a sanitiser: the output is text and is only ever rendered as text.
 */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style|head)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "\n- ")
    .replace(/<\/\s*(?:p|div|tr|li|h[1-6]|table|ul|ol|blockquote)\s*>/gi, "\n")
    .replace(/<\s*(?:p|div|tr|h[1-6]|blockquote)\b[^>]*>/gi, "\n")
    .replace(/<\/\s*(?:td|th)\s*>/gi, "\t")
    .replace(/<[^>]*>/g, "");
  return decodeEntities(text)
    .replace(/\r\n?/g, "\n")
    .replace(/[  ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The part of a body that is new: everything before a quoted reply. Used for scoring, so a quoted old thread does not raise the score. */
export function stripQuotedForScoring(text: string): string {
  const lines = text.split(/\r\n|\r|\n/);
  return lines.slice(0, visibleLineCount(text)).join("\n");
}
