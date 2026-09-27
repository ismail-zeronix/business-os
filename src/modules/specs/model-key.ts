import { parseCpu } from "./normalize/cpu";

/**
 * A canonical model identity, so the same model written two ways gets one key: "E14 Gen 7" and "E14 G7" both give `E14G7`.
 * Specification words that leak into model text ("T14 G4 CI5", "7440 Ci5-1335U", "V15 16GB") are removed first, because a CPU or a
 * capacity says which VARIANT it is, not which model. Returns null when nothing is left (unknown stays unknown). Pure.
 */
export function canonicalModelKey(model: string | null | undefined): string | null {
  if (!model) return null;
  let text = model.normalize("NFKC");

  // A CPU named inside the model text is a specification, not part of the model.
  const cpu = parseCpu(text);
  if (cpu) text = `${text.slice(0, cpu.index)} ${text.slice(cpu.end)}`;

  const key = text
    .toUpperCase()
    .replace(/\b\d{1,4}\s?(?:GB|TB)\b(?:\s?(?:SSD|HDD|NVME|RAM|DDR\d))?/g, " ") // capacities
    .replace(/\bGEN(?:ERATION)?\s?(\d{1,2})\b/g, "G$1") // "Gen 7" = "G7"
    .replace(/[^\p{L}\p{N}]/gu, "");
  return key === "" ? null : key;
}
