import type { Hit } from "../types";

/** Screen size in inches, resolution class, operating system and keyboard languages: small closed vocabularies, parsed by rules. */

// ─────────────────────────────── screen ───────────────────────────────

/** "14 inch", "14-inch", '14"', "15.6 inches". Only sizes a display can plausibly have (10 to 100 inches). Nothing without a unit. */
export function parseScreenInches(text: string): Hit<number> | null {
  const match = /(?<![\w.])(\d{1,2}(?:\.\d{1,2})?|100)\s?-?\s?(?:"|”|″|''|inch(?:es)?\b)/i.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  if (!(value >= 10 && value <= 100)) return null;
  return { value, raw: match[0].trim(), confidence: "HIGH", index: match.index, end: match.index + match[0].length };
}

// ─────────────────────────────── resolution ───────────────────────────────

const RESOLUTION_RULES: [RegExp, string][] = [
  [/\bwuxga\b|1920\s?[x×]\s?1200/i, "wuxga"],
  [/\bwqxga\b|2560\s?[x×]\s?1600/i, "wqxga"],
  [/\bw?qhd\b|2560\s?[x×]\s?1440/i, "qhd"],
  [/\bfull\s?hd\b|\bfhd\b(?!\+)|1920\s?[x×]\s?1080/i, "fhd"],
  [/\b2\.8k\b|2880\s?[x×]\s?1800/i, "2.8k"],
  [/\buhd\b|\b4k\b|3840\s?[x×]\s?2160/i, "4k"],
];

/** WUXGA, FHD, QHD, ... The earliest one written wins. "FHD+" is not read as FHD (vendors use it for different panels). */
export function parseResolution(text: string): Hit<string> | null {
  let best: Hit<string> | null = null;
  for (const [pattern, value] of RESOLUTION_RULES) {
    const match = pattern.exec(text);
    if (match && (!best || match.index < best.index)) best = { value, raw: match[0].trim(), confidence: "HIGH", index: match.index, end: match.index + match[0].length };
  }
  return best;
}

// ─────────────────────────────── operating system ───────────────────────────────

const WINDOWS = /\b(?:windows?|win)\s?-?(10|11)(?:\s?-?(pro|professional|home))?\b|\bw(10|11)(?:\s?(pro|home))?\b/i;
const OTHER_OS: [RegExp, string][] = [
  [/\bfree\s?dos\b|\bdos\b|\bno\s?os\b|\bwithout\s+(?:an\s+)?os\b|\bno\s+operating\s+system\b/i, "dos"],
  [/\bubuntu\b/i, "ubuntu"],
  [/\blinux\b/i, "linux"],
  [/\bchrome\s?os\b/i, "chrome-os"],
  [/\bmac\s?os\b/i, "macos"],
];

/** Windows 11 Pro, Win11, W11PRO, FreeDOS, "no OS", ... The edition is part of the value: Pro and Home are different products. */
export function parseOs(text: string): Hit<string> | null {
  let best: Hit<string> | null = null;
  const consider = (match: RegExpExecArray | null, value: string) => {
    if (match && (!best || match.index < best.index)) best = { value, raw: match[0].trim(), confidence: "HIGH", index: match.index, end: match.index + match[0].length };
  };
  const windows = WINDOWS.exec(text);
  if (windows) {
    const version = windows[1] ?? windows[3];
    const edition = (windows[2] ?? windows[4])?.toLowerCase();
    consider(windows, `windows-${version}${edition ? `-${edition === "professional" ? "pro" : edition}` : ""}`);
  }
  for (const [pattern, value] of OTHER_OS) consider(pattern.exec(text), value);
  return best;
}

// ─────────────────────────────── keyboard language ───────────────────────────────

const LANGUAGE: Record<string, string> = { en: "en", eng: "en", english: "en", ar: "ar", arb: "ar", arabic: "ar" };
const WORD = "(?:english|arabic|eng|arb|en|ar)";
const PAIR = new RegExp(String.raw`(?<![A-Za-z])(${WORD})\s*(?:[/&+,-]|and)\s*(${WORD})(?![A-Za-z])`, "i");
const BEFORE_KEYBOARD = new RegExp(String.raw`(?<![A-Za-z])(english|arabic|eng|arb)\s*(?:\((?:us|uk|usa)\)\s*)?(?:(?:back\s?lit|backlight(?:ed)?|rgb)\s*)?(?:layout\s*)?(?:keyboard|keys?|kbd|kb)\b`, "i");
const AFTER_KEYBOARD = new RegExp(String.raw`\bkeyboard\s*(?:layout|language)?\s*[:=-]?\s*(english|arabic)\b`, "i");

/** "English/Arabic", "AR/EN", "Arabic keyboard" -> a sorted list of language codes. Two languages written together are HIGH; one is MEDIUM. */
export function parseKeyboardLanguages(text: string): Hit<string[]> | null {
  // Supplier shorthand: "E/A KB" = English / Arabic keyboard.
  const shorthand = /(?<![A-Za-z])(?:e\s?\/\s?a|a\s?\/\s?e)\s*(?:kb|kbd|keyboard)\b/i.exec(text);
  if (shorthand) return { value: ["ar", "en"], raw: shorthand[0].trim(), confidence: "HIGH", index: shorthand.index, end: shorthand.index + shorthand[0].length };
  const pair = PAIR.exec(text);
  if (pair) {
    const languages = [...new Set([LANGUAGE[pair[1]!.toLowerCase()]!, LANGUAGE[pair[2]!.toLowerCase()]!])].sort();
    return { value: languages, raw: pair[0].trim(), confidence: languages.length > 1 ? "HIGH" : "MEDIUM", index: pair.index, end: pair.index + pair[0].length };
  }
  const single = BEFORE_KEYBOARD.exec(text) ?? AFTER_KEYBOARD.exec(text);
  if (single) return { value: [LANGUAGE[single[1]!.toLowerCase()]!], raw: single[0].trim(), confidence: "MEDIUM", index: single.index, end: single.index + single[0].length };
  return null;
}
