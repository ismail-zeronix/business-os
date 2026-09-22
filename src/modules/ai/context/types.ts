import type { ServiceContext } from "../../../core/database/tx";
import type { Confidence } from "../confidence/score";
import type { Intent, PageEntity } from "../intents";
import type { ProductSearchOutput } from "../tools/search-products";

/**
 * The evidence package: everything the model may see for one request, and nothing else (docs/ai-intelligence/context-builder.md).
 * Every fact has a short reference (P1 product, S1 supplier, E1 evidence) that the model cites and the validator checks. Short
 * references, not UUIDs: models copy them reliably.
 */

export type PackageProduct = {
  ref: string;
  id: string;
  name: string;
  partNumber: string | null;
  brandName: string | null;
  categoryName: string | null;
  isTemporary: boolean;
  /** How it was found, in words: "exact part-number match", "words in the name only"... */
  matchLabel: string;
};

export type PackageSupplier = { ref: string; id: string; name: string };

export type PackageEvidence = {
  ref: string;
  type: "price_observation" | "stock_observation";
  /** The observation id. */
  id: string;
  /** The immutable message it came from (opens in the evidence drawer). */
  evidenceSourceId: string;
  productRef: string;
  supplierRef: string;
  observedAt: Date;
  /** One line describing the fact, exactly as the model sees it (with references, product named once in the Products section). */
  line: string;
  /** The same fact for a person: supplier, value, when. */
  summary: string;
};

export type EvidencePackage = {
  question: string;
  intent: Intent;
  entity: PageEntity | null;
  /** The search terms that were run, in order. */
  searched: string[];
  totalFound: number;
  costVisible: boolean;
  products: PackageProduct[];
  suppliers: PackageSupplier[];
  evidence: PackageEvidence[];
  /** Standing domain facts the answer depends on (freshness bands, what counts as stock...). */
  rules: string[];
  /** Deterministic confidence, warnings and missing information, computed before any model call. */
  checks: Confidence;
};

/** What the orchestrator gathered before building context: the tool results for this request. */
export type ContextInput = {
  intent: Intent;
  question: string;
  entity: PageEntity | null;
  searched: string[];
  search: ProductSearchOutput | null;
  now: Date;
};

export type ContextFragment = Partial<Pick<EvidencePackage, "products" | "suppliers" | "evidence" | "rules">>;

/** Hands out P1, P2, S1... Asking twice for the same key returns the same reference, so one supplier has one reference everywhere. */
export class RefAllocator {
  private counters = new Map<string, number>();
  private byKey = new Map<string, string>();

  ref(prefix: string, key: string): string {
    const existing = this.byKey.get(`${prefix}:${key}`);
    if (existing) return existing;
    const next = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, next);
    const ref = `${prefix}${next}`;
    this.byKey.set(`${prefix}:${key}`, ref);
    return ref;
  }
}

/**
 * A source of context. New modules (enquiries, customers, quotations) add a provider to the registry; the orchestrator, adapters and
 * response schema do not change.
 */
export type ContextProvider = {
  name: string;
  appliesTo(input: ContextInput): boolean;
  build(input: ContextInput, ctx: ServiceContext, refs: RefAllocator): Promise<ContextFragment>;
};
