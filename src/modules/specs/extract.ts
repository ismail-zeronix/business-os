import { getAttribute } from "./registry";
import { parseCpu } from "./normalize/cpu";
import { parseMemoryAndStorage } from "./normalize/memory";
import { parseKeyboardLanguages, parseOs, parseResolution, parseScreenInches } from "./normalize/terms";
import type { Hit, ProposedRequirement, RequirementImportance, RequirementOperator } from "./types";

/**
 * Free text -> proposed structured requirements. Deterministic and pure. It only PROPOSES what the words say: no match means no
 * requirement (unknown stays unknown), and a person confirms or edits each one. Values are canonical; `rawValue` keeps the wording.
 * Reads customer wording ("at least", "up to", "preferably", "exactly") to choose the operator and importance.
 */

/** Screen sizes are matched within this many inches: 14" also accepts 14.1", but not 13.3" or 15.6". */
const SCREEN_TOLERANCE = 0.25;

const AT_LEAST = /\b(?:minimum|min\.?|at\s+least|over|above|from)\s*$/i;
const AT_MOST = /\b(?:maximum|max\.?|up\s+to|at\s+most|not\s+more\s+than|below|under)\s*$/i;
const EXACTLY = /\b(?:exactly|only|precisely)\s*$/i;
const PREFERRED = /\b(?:preferably|preferred|prefer|ideally|if\s+possible|nice\s+to\s+have|optional)\b/i;

/** Emails and links hold letters and digits that could look like specifications; trademark signs and emoji variation marks ("Ryzen™️ 5") split words. */
function sanitize(input: string): string {
  const text = input.replace(/[®™©]/g, "").normalize("NFKC").replace(/(\d)\s?(?:[’‘'′]{2}|[”“″ʺ])/g, '$1"').replace(/[​-‏‪-‮️]/g, "");
  return text.replace(/\S+@\S+/g, " ").replace(/https?:\/\/\S+|www\.\S+/gi, " ");
}

function importanceFor(defaultImportance: RequirementImportance, text: string, hit: Hit<unknown>): RequirementImportance {
  const window = `${text.slice(Math.max(0, hit.index - 30), hit.index)} ${text.slice(hit.end, hit.end + 16)}`;
  return PREFERRED.test(window) ? "NICE" : defaultImportance;
}

function numericOperator(defaultOperator: RequirementOperator, text: string, hit: Hit<unknown>): RequirementOperator {
  const before = text.slice(Math.max(0, hit.index - 20), hit.index);
  if (EXACTLY.test(before)) return "EQUALS";
  if (AT_MOST.test(before)) return "LESS_THAN_OR_EQUAL";
  if (AT_LEAST.test(before)) return "GREATER_THAN_OR_EQUAL";
  return defaultOperator;
}

function numberRequirement(key: string, hit: Hit<number>, text: string): ProposedRequirement {
  const spec = getAttribute(key)!;
  const operator = numericOperator(spec.defaultOperator, text, hit);
  const between = operator === "BETWEEN";
  return {
    attributeKey: key,
    operator,
    importance: importanceFor(spec.defaultImportance, text, hit),
    confidence: hit.confidence,
    rawValue: hit.raw,
    valueText: null,
    valueNum: between ? round(hit.value - SCREEN_TOLERANCE) : hit.value,
    valueNumMax: between ? round(hit.value + SCREEN_TOLERANCE) : null,
    valueList: null,
    unit: spec.unit,
  };
}

function textRequirement(key: string, hit: Hit<string>, text: string): ProposedRequirement {
  const spec = getAttribute(key)!;
  return { attributeKey: key, operator: spec.defaultOperator, importance: importanceFor(spec.defaultImportance, text, hit), confidence: hit.confidence, rawValue: hit.raw, valueText: hit.value, valueNum: null, valueNumMax: null, valueList: null, unit: null };
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Memory cards and USB sticks have a capacity but no RAM, storage drive, CPU or screen: the laptop attributes do not apply to them. */
const FLASH_MEDIA = /\b(?:micro\s?sd(?:hc|xc)?|sd(?:hc|xc)?\s+card|memory\s+card|flash\s+drive|usb\s+(?:drive|stick)|pen\s?drive|thumb\s+drive|ultra\s+flair|cruzer)\b/i;

export function extractRequirements(rawText: string): ProposedRequirement[] {
  const text = sanitize(rawText);
  if (FLASH_MEDIA.test(text)) return [];
  const found: ProposedRequirement[] = [];

  const cpu = parseCpu(text);
  if (cpu) found.push(textRequirement("cpu", { ...cpu, value: cpu.value.canonical }, text));

  const memory = parseMemoryAndStorage(text);
  if (memory.ram) found.push(numberRequirement("ram_gb", memory.ram, text));
  if (memory.storage) found.push(numberRequirement("storage_gb", memory.storage, text));
  if (memory.storageType) found.push(textRequirement("storage_type", memory.storageType, text));

  const screen = parseScreenInches(text);
  if (screen) found.push(numberRequirement("screen_in", screen, text));

  const resolution = parseResolution(text);
  if (resolution) found.push(textRequirement("resolution", resolution, text));

  const os = parseOs(text);
  if (os) found.push(textRequirement("os", os, text));

  const keyboard = parseKeyboardLanguages(text);
  if (keyboard) {
    const spec = getAttribute("keyboard_lang")!;
    found.push({
      attributeKey: "keyboard_lang",
      operator: spec.defaultOperator,
      importance: importanceFor(spec.defaultImportance, text, keyboard),
      confidence: keyboard.confidence,
      rawValue: keyboard.raw,
      valueText: null,
      valueNum: null,
      valueNumMax: null,
      valueList: keyboard.value,
      unit: null,
    });
  }
  return found;
}

/** The text an enquiry line is read from: its own words plus what the parser already separated out. Placeholder source text is ignored. */
export function requirementSourceText(item: { sourceText: string; description: string | null; specText: string | null }): string {
  const source = item.sourceText === "(added by hand)" ? "" : item.sourceText;
  return [source, item.description ?? "", item.specText ?? ""].filter(Boolean).join("\n");
}

/** One specification a PRODUCT has (what it is), the counterpart of a requirement (what a customer wants). */
export type ProposedAttribute = {
  attributeKey: string;
  rawValue: string;
  valueText: string | null;
  valueNum: number | null;
  valueList: string[];
  unit: string | null;
  confidence: ProposedRequirement["confidence"];
};

/**
 * The specifications a product's own words state. Same reader as requirements, so a customer's "16GB" and a product's "16GB" become the
 * same canonical value. A screen "14 inch" is the size itself (14), not a tolerance range.
 */
export function extractAttributes(rawText: string): ProposedAttribute[] {
  return extractRequirements(rawText).map((r) => ({
    attributeKey: r.attributeKey,
    rawValue: r.rawValue,
    valueText: r.valueText,
    valueNum: r.valueNum !== null && r.valueNumMax !== null ? round((r.valueNum + r.valueNumMax) / 2) : r.valueNum,
    valueList: r.valueList ?? [],
    unit: r.unit,
    confidence: r.confidence,
  }));
}

