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
const LEADING_BULLET = /^[\s>•·▪▫◦●○■□★☆✔✅❌➤➢→*+\-–—]+(?=\S)/u;

/** Inch sign written as two apostrophes (curly or straight), a curly double quote or a prime, straight after a number. A single apostrophe is left alone (feet). */
const INCH_MARK = /(\d)\s?(?:[’‘'′]{2}|[”“″])/g;

/** Removes chat formatting and decoration but keeps every character that could carry information (digits, letters, currency, +, /, #). */
export function cleanLine(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[​-‏‪-‮️]/g, "") // zero-width and direction marks, emoji variation selector
    .replace(WHATSAPP_PREFIX, "")
    .replace(INCH_MARK, '$1"') // 14’’ / 14'' / 14” -> 14"
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/[*_~`]+/g, "") // WhatsApp bold / italic / strike / monospace markers
    .replace(LEADING_BULLET, "")
    .replace(/\s+/g, " ")
    .trim();
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
