import type { Hit } from "../types";

/**
 * RAM, storage capacity and storage type from free text. Capacities are stored in GB (1 TB = 1000 GB, the marketing size).
 * "16GB RAM", "16G", "16 GB DDR5" -> RAM 16; "512GB SSD", "512G NVMe", "512 PCIe SSD", "1TB" -> storage; "16/512" -> RAM 16 + storage 512.
 * A bare capacity with no keyword is classified by size (a RAM-sized number is RAM, 120 GB and up is storage) and is only MEDIUM confidence.
 */

export type MemoryResult = { ram: Hit<number> | null; storage: Hit<number> | null; storageType: Hit<string> | null };

const RAM_SIZES = new Set([4, 8, 12, 16, 24, 32, 48, 64, 96, 128]);
const STORAGE_SIZES = new Set([32, 64, 120, 128, 240, 250, 256, 480, 500, 512, 960, 1000, 1024, 2000, 2048]);

const RAM_AFTER = /^\s*(?:ram|memory|ddr|lpddr|so-?dimm)/i;
const RAM_BEFORE = /(?:ram|memory)\s*[:=-]?\s*$/i;
const STORAGE_AFTER = /^\s*(?:ssd|hdd|nvme|pcie|m\.?2|emmc|storage|hard\s*disk|sata)/i;
const STORAGE_BEFORE = /(?:ssd|hdd|nvme|storage)\s*[:=-]?\s*$/i;

const toGb = (value: number, unit: string): number => (unit.toLowerCase() === "tb" ? Math.round(value * 1000) : value);

/** The storage type written next to a capacity: nvme / pcie / m.2 are all SSD. Found in a small window so a neighbouring item is not read. */
function storageTypeNear(text: string, start: number, end: number): Hit<string> | null {
  const from = Math.max(0, start - 10);
  const window = text.slice(from, end + 14);
  const rules: [RegExp, string][] = [
    [/ssd|nvme|pcie|m\.?2/i, "ssd"],
    [/hdd|hard\s*disk/i, "hdd"],
    [/emmc/i, "emmc"],
  ];
  for (const [pattern, value] of rules) {
    const match = pattern.exec(window);
    if (match) return { value, raw: match[0], confidence: "HIGH", index: from + match.index, end: from + match.index + match[0].length };
  }
  return null;
}

/** Graphics memory ("RTX 5050 8GB GDDR7") is neither RAM nor storage: blanked out, same length, so the other positions still line up. */
const GPU_MEMORY = /\b(?:rtx|gtx|rx|arc)\s*[\w-]*\s+\d{1,2}\s?gb(?:\s*gddr\d\w*)?/gi;

export function parseMemoryAndStorage(input: string): MemoryResult {
  const text = input.replace(GPU_MEMORY, (m) => " ".repeat(m.length));
  let ram: Hit<number> | null = null;
  let storage: Hit<number> | null = null;

  // "16/512" (RAM/storage). The second number must be a real storage size (or carry a unit) so a date such as 12/2025 is never read.
  for (const match of text.matchAll(/(?<![\d/.,])(\d{1,3})\s*\/\s*(\d{2,4})(?:\s?(gb|tb|g|t))?(?![\d/])/gi)) {
    const first = Number(match[1]);
    const secondRaw = Number(match[2]);
    const unit = match[3];
    const second = unit ? toGb(secondRaw, unit.length === 1 ? `${unit}b` : unit) : secondRaw;
    if (!RAM_SIZES.has(first) || !STORAGE_SIZES.has(second)) continue;
    const index = match.index;
    const end = index + match[0].length;
    ram = { value: first, raw: match[0].trim(), confidence: "MEDIUM", index, end };
    storage = { value: second, raw: match[0].trim(), confidence: "MEDIUM", index, end };
    break;
  }

  // Capacities with a unit: "16GB", "512G", "1TB", including a glued type such as "1TBSSD".
  const capacity = /(?<![\w.])(\d{1,4}(?:\.\d)?)\s?(gb|tb|g)(?=$|[^a-z0-9]|ssd|hdd|nvme|ram|ddr|lpddr)/gi;
  for (const match of text.matchAll(capacity)) {
    if (ram && storage) break;
    const value = Number(match[1]);
    const unit = match[2]!;
    const gb = toGb(value, unit);
    const index = match.index;
    const end = index + match[0].length;
    const before = text.slice(Math.max(0, index - 14), index);
    const after = text.slice(end, end + 14);
    // A word right after the number outranks one before it: in "8GB Memory - 256GB SSD" the "Memory" before 256GB belongs to the 8GB.
    const isRam = RAM_AFTER.test(after) || (RAM_BEFORE.test(before) && !STORAGE_AFTER.test(after));
    const isStorage = STORAGE_AFTER.test(after) || (STORAGE_BEFORE.test(before) && !RAM_AFTER.test(after));
    const keyword = isRam || isStorage;
    const short = unit.toLowerCase() === "g";
    if (short && !keyword && value < 8) continue; // "4G", "5G" are networks, not memory

    const hit = (confidence: "HIGH" | "MEDIUM"): Hit<number> => ({ value: gb, raw: match[0].trim(), confidence, index, end });
    if (isRam && !ram) ram = hit("HIGH");
    else if (isStorage && !isRam && !storage) storage = hit("HIGH");
    else if (!keyword) {
      if (gb === 128 && /\d\s?tb/i.test(text) && !ram) ram = hit("MEDIUM"); // "128GB, 2TB": a Mac configuration, the 128GB is memory
      else if (unit.toLowerCase() === "tb" && !storage) storage = hit("MEDIUM");
      else if (RAM_SIZES.has(gb) && gb <= 96 && !ram) ram = hit("MEDIUM");
      else if (gb >= 120 && !storage) storage = hit("MEDIUM");
    }
  }

  // "512SSD": a capacity glued to a drive word with no unit. GB is the only sensible reading, but it is marked MEDIUM.
  if (!storage) {
    const bare = /(?<![\w.])(\d{2,4})\s?(ssd|hdd|nvme)\b/i.exec(text);
    if (bare && (STORAGE_SIZES.has(Number(bare[1])) || Number(bare[1]) >= 64)) {
      storage = { value: Number(bare[1]), raw: bare[0].trim(), confidence: "MEDIUM", index: bare.index, end: bare.index + bare[0].length };
    }
  }

  const storageType = storage ? storageTypeNear(text, storage.index, storage.end) : null;
  return { ram, storage, storageType };
}
