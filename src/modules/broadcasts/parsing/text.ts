/** Text preparation for broadcast parsing. Pure functions. Original line numbers are always preserved. */

export type Line = {
  /** 1-based line number in the raw text. */
  number: number;
  /** The line exactly as pasted. */
  raw: string;
  /** The line with chat markup, bullets, emoji and message prefixes removed, for pattern matching. */
  clean: string;
};

const WHATSAPP_PREFIX = /^\[?\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s?(?:[AP]M)?\]?\s*[-–]?\s*[^:\n]{1,40}:\s+/i;
const LEADING_BULLET = /^(?:[\s>•·▪▫◦●○■□★☆✔✅❌➤➢→*\-–—]|\+(?!\d))+(?=\S)/u; // a "+" straight before a digit is a phone prefix, not a bullet

/** Inch sign written as two apostrophes (curly or straight), a curly double quote or a prime, straight after a number. A single apostrophe is left alone (feet). */
const INCH_MARK = /(\d)\s?(?:[’‘'′]{2}|[”“″])/g;

/**
 * Lists copied from a PDF or a chat lose their separators: "i7147008GB/512GBPC" is "i7-14700 8GB/512GB PC". Only shapes that cannot mean
 * anything else are split: a 5-digit Intel Core SKU followed by a RAM size, and a capacity glued to a drive word or "PC".
 */
function unglue(text: string): string {
  return text
    .replace(/\b(i[3579])(\d{5})(?=\d{1,2}\s?(?:GB|TB)\b)/gi, "$1-$2 ")
    .replace(/(\d\s?(?:GB|TB))(?=(?:PCS?|SSD|HDD)\b)/gi, "$1 ");
}

/** Removes chat formatting and decoration but keeps every character that could carry information (digits, letters, currency, +, /, #). */
export function cleanLine(raw: string): string {
  return raw
    .replace(/[®™©]/g, "") // "Intel® Core™" must not become "CoreTM" under NFKC
    .normalize("NFKC")
    .replace(/[​-‏‪-‮️]/g, "") // zero-width and direction marks, emoji variation selector
    .replace(WHATSAPP_PREFIX, "")
    .replace(INCH_MARK, '$1"') // 14’’ / 14'' / 14” -> 14"
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/[*_~`]+/g, "") // WhatsApp bold / italic / strike / monospace markers
    .replace(LEADING_BULLET, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^.*$/, unglue);
}

export function toLines(rawText: string): Line[] {
  return rawText.split(/\r\n|\r|\n/).map((raw, index) => ({ number: index + 1, raw, clean: cleanLine(raw) }));
}

/** Groups consecutive non-empty lines into blocks; a blank line ends a block. */
export function toBlocks(lines: Line[]): Line[][] {
  const blocks: Line[][] = [];
  let current: Line[] = [];
  for (const line of lines) {
    if (line.clean === "") {
      if (current.length) blocks.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);
  return blocks;
}
