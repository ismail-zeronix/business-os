import type { AiProvider } from "../../../generated/prisma/enums";
import type { ConfidenceLevel } from "../confidence/score";
import type { EvidencePackage } from "../context/types";
import type { Intent } from "../intents";
import type { AnswerDraft, NextActionType } from "../schemas";

/**
 * The response every assistant request returns, whatever the provider (docs/ai-intelligence/ai-orchestrator.md). It is assembled here
 * from the deterministic checks and the validated model draft: confidence, evidence and entities come from the package, never from
 * the model. Dates are ISO strings so the object can be sent to the browser as JSON.
 */

export type EvidenceReference = {
  ref: string;
  type: "price_observation" | "stock_observation";
  id: string;
  evidenceSourceId: string;
  productName: string;
  supplierName: string;
  observedAt: string;
  /** The fact in words for a person: supplier, value, when. */
  summary: string;
};

export type EntityReference = { ref: string; type: "Product" | "Supplier"; id: string; name: string; href: string };

export type AIResponse = {
  executionId: string;
  intent: Intent;
  answer: string;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  confidenceReasons: string[];
  evidence: EvidenceReference[];
  matchedEntities: EntityReference[];
  warnings: string[];
  missingInformation: string[];
  recommendations: { title: string; reason: string }[];
  nextActions: { type: NextActionType; label: string; entity: EntityReference | null }[];
  /** Always false in this stage: nothing here proposes a change. */
  requiresApproval: false;
  proposedChanges: [];
  /** NULL when the rules answered alone (no provider call). */
  answeredBy: { provider: AiProvider; model: string; promptVersion: string } | null;
};

export type AIResponseBody = Omit<AIResponse, "executionId">;

export function entitiesOf(pkg: EvidencePackage): EntityReference[] {
  return [
    ...pkg.products.map((p): EntityReference => ({ ref: p.ref, type: "Product", id: p.id, name: p.name, href: `/products/${p.id}` })),
    ...pkg.suppliers.map((s): EntityReference => ({ ref: s.ref, type: "Supplier", id: s.id, name: s.name, href: `/suppliers/${s.id}` })),
  ];
}

const dedupe = (items: string[]) => [...new Map(items.map((item) => [item.trim().toLowerCase(), item.trim()])).values()];

/** Combines the package (facts, checks) with the validated draft (wording, citations). Deterministic warnings always come first. */
export function assembleResponse(pkg: EvidencePackage, draft: AnswerDraft, answeredBy: NonNullable<AIResponse["answeredBy"]>): AIResponseBody {
  const entities = entitiesOf(pkg);
  const entityByRef = new Map(entities.map((e) => [e.ref, e]));
  const productName = new Map(pkg.products.map((p) => [p.ref, p.name]));
  const supplierName = new Map(pkg.suppliers.map((s) => [s.ref, s.name]));
  const cited = new Set(draft.evidenceRefs);

  return {
    intent: pkg.intent,
    answer: draft.answer,
    confidenceScore: pkg.checks.score,
    confidenceLevel: pkg.checks.level,
    confidenceReasons: pkg.checks.reasons,
    evidence: pkg.evidence
      .filter((e) => cited.has(e.ref))
      .map((e) => ({
        ref: e.ref,
        type: e.type,
        id: e.id,
        evidenceSourceId: e.evidenceSourceId,
        productName: productName.get(e.productRef) ?? "",
        supplierName: supplierName.get(e.supplierRef) ?? "",
        observedAt: e.observedAt.toISOString(),
        summary: e.summary,
      })),
    matchedEntities: entities,
    warnings: dedupe([...pkg.checks.warnings, ...draft.warnings]),
    missingInformation: dedupe([...pkg.checks.missing, ...draft.missingInformation]),
    recommendations: draft.recommendations,
    nextActions: draft.nextActions.map((a) => ({ type: a.type, label: a.label, entity: a.ref ? (entityByRef.get(a.ref) ?? null) : null })),
    requiresApproval: false,
    proposedChanges: [],
    answeredBy,
  };
}

/** An answer the rules give alone (nothing found, or a request this stage cannot do). No provider is called. */
export function rulesOnlyResponse(input: {
  intent: Intent;
  answer: string;
  pkg?: EvidencePackage;
  missing?: string[];
  nextActions?: AIResponse["nextActions"];
}): AIResponseBody {
  return {
    intent: input.intent,
    answer: input.answer,
    confidenceScore: input.pkg?.checks.score ?? 0,
    confidenceLevel: input.pkg?.checks.level ?? "LOW",
    confidenceReasons: input.pkg?.checks.reasons ?? [],
    evidence: [],
    matchedEntities: input.pkg ? entitiesOf(input.pkg) : [],
    warnings: input.pkg?.checks.warnings ?? [],
    missingInformation: dedupe([...(input.pkg?.checks.missing ?? []), ...(input.missing ?? [])]),
    recommendations: [],
    nextActions: input.nextActions ?? [],
    requiresApproval: false,
    proposedChanges: [],
    answeredBy: null,
  };
}
