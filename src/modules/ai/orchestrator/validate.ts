import type { EvidencePackage } from "../context/types";
import type { AnswerDraft } from "../schemas";

/**
 * Checks a model draft against the evidence package it was given (docs/ai-intelligence/ai-orchestrator.md, "Rules the validator
 * enforces"). Returns problems in plain words; the orchestrator shows them to the model once as a repair request, then fails.
 * Pure functions.
 */

/** Every plain number in a text, normalised ("3,250.00" -> 3250). Digits inside codes such as 21M7002XAD are split out too. */
export function numbersIn(text: string): number[] {
  return text
    .split(/[^0-9.,]+/)
    .map((token) => token.replace(/^[.,]+|[.,]+$/g, "").replace(/,/g, ""))
    .filter((token) => /^\d+(\.\d+)?$/.test(token))
    .map(Number);
}

/**
 * Numbers in the answer that appear nowhere in the evidence or the question. Small whole numbers (counts such as "two suppliers",
 * "1 of 3") are allowed; anything else, a price above all, must be copied from the evidence.
 */
export function unsupportedFigures(answer: string, allowedText: string): number[] {
  const allowed = new Set(numbersIn(allowedText));
  return [...new Set(numbersIn(answer))].filter((n) => !(Number.isInteger(n) && n <= 20) && !allowed.has(n));
}

export function checkDraft(draft: AnswerDraft, pkg: EvidencePackage, allowedText: string): string[] {
  const problems: string[] = [];
  const evidenceRefs = new Set(pkg.evidence.map((e) => e.ref));
  const productRefs = new Set(pkg.products.map((p) => p.ref));
  const supplierRefs = new Set(pkg.suppliers.map((s) => s.ref));

  const unknownEvidence = draft.evidenceRefs.filter((ref) => !evidenceRefs.has(ref));
  if (unknownEvidence.length > 0) problems.push(`evidenceRefs contains ${unknownEvidence.join(", ")}, which ${unknownEvidence.length === 1 ? "is" : "are"} not in the evidence package.`);
  if (pkg.evidence.length > 0 && draft.evidenceRefs.length === 0) problems.push("evidenceRefs is empty. List the evidence (E1, E2...) the answer relies on.");

  for (const action of draft.nextActions) {
    if (action.type === "OPEN_PRODUCT" && !(action.ref && productRefs.has(action.ref))) problems.push(`nextActions: OPEN_PRODUCT needs a product reference from the package (P1...), not ${action.ref ?? "null"}.`);
    if (action.type === "OPEN_SUPPLIER" && !(action.ref && supplierRefs.has(action.ref))) problems.push(`nextActions: OPEN_SUPPLIER needs a supplier reference from the package (S1...), not ${action.ref ?? "null"}.`);
    if (action.type === "REQUEST_STOCK_CONFIRMATION" && action.ref !== null && !supplierRefs.has(action.ref) && !productRefs.has(action.ref)) {
      problems.push(`nextActions: ${action.ref} is not a supplier or product reference in the package.`);
    }
  }

  const figures = unsupportedFigures(draft.answer, allowedText);
  if (figures.length > 0) problems.push(`The answer mentions ${figures.join(", ")}, which ${figures.length === 1 ? "does" : "do"} not appear in the evidence. Use only figures from the evidence package.`);

  return problems;
}
