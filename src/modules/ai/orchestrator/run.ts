import { DomainError, ForbiddenError } from "../../../core/errors";
import type { ServiceContext } from "../../../core/database/tx";
import { assertCapability } from "../../../core/permissions/capabilities";
import { buildEvidencePackage } from "../context/registry";
import { renderPackage } from "../context/render";
import { classifyIntent, extractSearchTerms, hasCodeToken, resolvePageEntity, WIRED_INTENTS, type Intent, type PageEntity } from "../intents";
import { AiError } from "../providers/errors";
import { createProvider } from "../providers/registry";
import type { AIProvider, ProviderConfig } from "../providers/types";
import { answerPrompt, interpretPrompt } from "../prompts/registry";
import { loadActiveProviderConfig } from "../queries";
import { answerDraftSchema, askSchema, searchTermsSchema, type AskInput } from "../schemas";
import { recordExecution } from "../service";
import { runTool } from "../tools/registry";
import { MAX_TOOL_PRODUCTS, searchProductsTool, type ProductHit, type ProductSearchOutput } from "../tools/search-products";
import { Budget, MAX_TOOL_CALLS } from "./budget";
import type { CallMeter } from "./generate";
import { generateValidated } from "./generate";
import { assembleResponse, rulesOnlyResponse, type AIResponse, type AIResponseBody } from "./response";
import { checkDraft } from "./validate";

/**
 * The orchestrator (docs/ai-intelligence/ai-orchestrator.md): question -> deterministic intent -> capability check -> tools -> evidence
 * package with deterministic checks -> provider (only for interpretation and wording) -> validation -> response -> execution log.
 * Read-only: it creates and changes no business record and sends nothing.
 */

const NOT_AVAILABLE_YET: Partial<Record<Intent, string>> = {
  PREPARE_QUOTATION_DRAFT: "preparing quotation drafts",
  ANALYZE_QUOTE_RISK: "checking quotations for risk",
  DRAFT_CUSTOMER_REPLY: "drafting customer replies",
  DRAFT_SUPPLIER_MESSAGE: "drafting supplier messages",
  FIND_FOLLOW_UP: "finding follow-ups",
  SUMMARIZE_SUPPLIER_HISTORY: "summarising supplier history",
  SUMMARIZE_CUSTOMER_HISTORY: "summarising customer history",
  DISCOVER_HIDDEN_SUPPLIERS: "discovering new suppliers",
  FIND_ALTERNATIVE_PRODUCT: "finding alternative or equivalent products",
  ANALYZE_ENQUIRY: "analysing enquiries",
};

const STRENGTH_RANK = { EXACT: 3, PROBABLE: 2, POSSIBLE: 1 } as const;
const rank = (hit: ProductHit) => (hit.match ? STRENGTH_RANK[hit.match.strength] : 0);

/** Several searches merged: one row per product, strongest match kept, exact matches first, capped. */
function mergeSearches(outputs: ProductSearchOutput[]): ProductSearchOutput | null {
  if (outputs.length === 0) return null;
  const byId = new Map<string, ProductHit>();
  for (const output of outputs) {
    for (const hit of output.products) {
      const existing = byId.get(hit.productId);
      if (!existing || rank(hit) > rank(existing)) byId.set(hit.productId, hit);
    }
  }
  const ordered = [...byId.values()].sort((a, b) => rank(b) - rank(a));
  const total = Math.max(byId.size, ...outputs.map((o) => o.total));
  return { query: outputs.map((o) => o.query).filter(Boolean).join(" | ") || null, products: ordered.slice(0, MAX_TOOL_PRODUCTS), total, costVisible: outputs.every((o) => o.costVisible) };
}

type RunState = {
  budget: Budget;
  config: ProviderConfig | null;
  promptVersion: string | null;
  repairAttempted: boolean;
  evidenceCount: number;
  confidence: number | null;
  outputSummary: string | null;
};

async function answerQuestion(ctx: ServiceContext, question: string, intent: Intent, entity: PageEntity | null, state: RunState): Promise<AIResponseBody> {
  const now = new Date();

  const scope = NOT_AVAILABLE_YET[intent];
  if (!WIRED_INTENTS.has(intent) || scope) {
    state.outputSummary = "not available yet";
    return rulesOnlyResponse({
      intent,
      answer: `The assistant cannot help with ${scope ?? "this"} yet. For now it looks up products with their latest supplier prices and stock, and shows the evidence behind each answer.`,
      nextActions: [{ type: "REFINE_QUESTION", label: "Ask about a product, its price or stock", entity: null }],
    });
  }

  state.config = await loadActiveProviderConfig();
  if (!state.config) throw new AiError("NO_PROVIDER");
  const provider: AIProvider = createProvider(state.config);
  const meter: CallMeter = { beforeCall: () => state.budget.useProvider(), afterCall: (usage, model) => state.budget.meter(usage, model) };

  // 1. Deterministic search. On a product page, a question that names no code and says "this"/"it" (or names nothing) is about that
  //    product; otherwise the words and codes of the question are searched, and the page's product is the fallback.
  const terms = extractSearchTerms(question);
  const pageProductId = entity?.type === "Product" ? entity.id : null;
  const aboutPage = pageProductId !== null && !hasCodeToken(question) && (terms.length === 0 || /\b(this|it|its)\b/i.test(question));
  const searched: string[] = [];
  const outputs: ProductSearchOutput[] = [];
  const found = () => outputs.some((o) => o.products.length > 0);
  const search = async (term: string) => {
    searched.push(term);
    outputs.push(await runTool(searchProductsTool, { query: term, productId: null }, ctx, state.budget));
  };
  const searchPage = async () => outputs.push(await runTool(searchProductsTool, { query: null, productId: pageProductId }, ctx, state.budget));

  if (aboutPage) await searchPage();
  else for (const term of terms.slice(0, 2)) await search(term);
  if (!found() && pageProductId && !aboutPage) await searchPage();

  // 2. Only when the rules searched and found nothing: ask the model for search terms, and search them like typed text.
  //    A question that names nothing gets "which product?" from the rules, without a model call.
  if (!found() && terms.length > 0) {
    const interpret = interpretPrompt(question);
    state.promptVersion = interpret.version;
    const interpreted = await generateValidated(provider, interpret, searchTermsSchema, { schemaName: "search_terms", allowRepair: false, meter });
    for (const term of interpreted.value.searchTerms.filter((t) => !searched.includes(t))) {
      if (state.budget.toolCalls >= MAX_TOOL_CALLS) break;
      await search(term);
    }
  }

  const merged = mergeSearches(outputs);
  const pkg = await buildEvidencePackage({ intent, question, entity, searched, search: merged, now }, ctx);
  state.confidence = pkg.checks.score;
  state.evidenceCount = pkg.evidence.length;

  if (pkg.products.length === 0) {
    state.outputSummary = searched.length > 0 ? "no product matched" : "no product named";
    return rulesOnlyResponse({
      intent,
      answer:
        searched.length > 0
          ? `No product in the database matches this question. I searched for ${searched.map((s) => `"${s}"`).join(", ")}. Try the exact part number or model name.`
          : "Which product do you mean? Give its part number or model name, or ask from the product's page.",
      pkg,
      nextActions: [{ type: "REFINE_QUESTION", label: "Ask again with the part number", entity: null }],
    });
  }

  // 3. The model words the answer from the rendered package; the validator checks every reference and figure against it.
  const evidenceText = renderPackage(pkg, now);
  const prompt = answerPrompt({ question, evidence: evidenceText });
  state.promptVersion = prompt.version;
  const draft = await generateValidated(provider, prompt, answerDraftSchema, {
    schemaName: "answer",
    check: (value) => checkDraft(value, pkg, `${evidenceText}\n${question}`),
    allowRepair: state.budget.roomForRepair(),
    meter,
  });
  state.repairAttempted = draft.repairAttempted;
  state.outputSummary = `${pkg.products.length} products, ${pkg.evidence.length} evidence, ${draft.value.evidenceRefs.length} cited`;

  return assembleResponse(pkg, draft.value, { provider: state.config.provider, model: draft.model, promptVersion: prompt.version });
}

/** Ask the assistant a question. Every run, successful or not, is written to the execution log. */
export async function askAssistant(ctx: ServiceContext, rawInput: AskInput): Promise<AIResponse> {
  const started = Date.now();
  const input = askSchema.parse(rawInput);
  const entity = resolvePageEntity(input.path);
  const intent = classifyIntent(input.question, entity);
  const state: RunState = { budget: new Budget(), config: null, promptVersion: null, repairAttempted: false, evidenceCount: 0, confidence: null, outputSummary: null };

  const record = (status: "SUCCEEDED" | "FAILED", errorCode: string | null) => {
    const called = state.budget.providerCalls > 0 && state.config !== null;
    return recordExecution(ctx, {
      intent,
      status,
      errorCode,
      provider: called ? state.config!.provider : null,
      model: called ? (state.budget.servedModel ?? state.config!.model) : null,
      promptVersion: called ? state.promptVersion : null,
      entity,
      question: input.question,
      outputSummary: state.outputSummary,
      confidenceScore: state.confidence,
      toolCalls: state.budget.toolCalls,
      providerCalls: state.budget.providerCalls,
      evidenceCount: state.evidenceCount,
      repairAttempted: state.repairAttempted,
      inputTokens: state.budget.inputTokens,
      outputTokens: state.budget.outputTokens,
      cacheReadTokens: state.budget.cacheReadTokens,
      cacheWriteTokens: state.budget.cacheWriteTokens,
      latencyMs: Date.now() - started,
    });
  };

  try {
    assertCapability(ctx, "ai.use", "You do not have access to the assistant.");
    const body = await answerQuestion(ctx, input.question, intent, entity, state);
    const execution = await record("SUCCEEDED", null);
    return { executionId: execution.id, ...body };
  } catch (error) {
    const code = error instanceof AiError ? error.aiCode : error instanceof ForbiddenError ? "FORBIDDEN" : "UNKNOWN";
    try {
      await record("FAILED", code);
    } catch (logError) {
      console.error("[ai] could not record a failed execution:", logError);
    }
    if (error instanceof DomainError) throw error;
    console.error("[ai] unexpected error while answering:", error);
    throw new AiError("UNKNOWN");
  }
}
