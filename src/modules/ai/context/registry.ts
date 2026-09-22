import type { ServiceContext } from "../../../core/database/tx";
import { scoreEvidence } from "../confidence/score";
import { hasCodeToken } from "../intents";
import { businessRulesProvider, productOffersProvider } from "./providers";
import { RefAllocator, type ContextInput, type ContextProvider, type EvidencePackage } from "./types";

/** Registered context providers, in the order their sections appear. A new module adds its provider here and nothing else changes. */
export const CONTEXT_PROVIDERS: readonly ContextProvider[] = [productOffersProvider, businessRulesProvider];

/**
 * Builds the evidence package for one request: runs every provider that applies, merges their sections, and computes the deterministic
 * checks (confidence, warnings, missing information) before any model is involved. Redaction already happened in the tools.
 */
export async function buildEvidencePackage(input: ContextInput, ctx: ServiceContext): Promise<EvidencePackage> {
  const refs = new RefAllocator();
  const pkg: EvidencePackage = {
    question: input.question,
    intent: input.intent,
    entity: input.entity,
    searched: input.searched,
    totalFound: input.search?.total ?? 0,
    costVisible: input.search?.costVisible ?? true,
    products: [],
    suppliers: [],
    evidence: [],
    rules: [],
    checks: { score: 0, level: "LOW", reasons: [], warnings: [], missing: [] },
  };

  for (const provider of CONTEXT_PROVIDERS) {
    if (!provider.appliesTo(input)) continue;
    const fragment = await provider.build(input, ctx, refs);
    pkg.products.push(...(fragment.products ?? []));
    pkg.suppliers.push(...(fragment.suppliers ?? []));
    pkg.evidence.push(...(fragment.evidence ?? []));
    pkg.rules.push(...(fragment.rules ?? []));
  }

  pkg.checks = scoreEvidence({
    products: input.search?.products ?? [],
    questionHasCode: hasCodeToken(input.question),
    mentionsWarranty: /\bwarrant(y|ies)\b/i.test(input.question),
    costVisible: pkg.costVisible,
    now: input.now,
  });
  return pkg;
}
