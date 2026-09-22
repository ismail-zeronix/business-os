# AI intelligence architecture

Authority: `docs/plans/paused/2026-09-21-ai-intelligence-core.md` (paused while the Quotation is built; it returns to `docs/plans/active/CURRENT.md` when resumed). Decision: `docs/decisions/0007-ai-intelligence-layer.md`. This file describes the layer as a whole; the parts have their own files.

## 1. The one allowed path

```
User question or page action
  -> Orchestrator            (intent, permissions, budget)
  -> Tool registry           (predefined, zod-validated, capability-checked)
  -> Context builder         (registered context providers, redaction)
  -> Evidence package        (canonical, provider-neutral)
  -> AI provider             (adapter; only for interpretation and wording)
  -> Structured AI result    (validated against the AIResponse schema)
  -> Validation layer        (schema, evidence references, business rules)
  -> Answer on screen
  -> AiExecution log + AuditLog
```

**Never** `user -> LLM -> database`. The provider receives text, never a connection, never SQL, never a table name it can act on.

## 2. Where the code lives

As built in Stage 1:

```text
src/modules/ai/
  providers/      types.ts (AIProvider), anthropic.ts, openai.ts, gemini.ts (official SDKs), registry.ts (createProvider),
                  errors.ts (AiError codes), json-schema.ts (one strict schema for every provider)
  orchestrator/   run.ts (askAssistant), generate.ts (validated structured call + one repair), validate.ts (references, figures),
                  response.ts (AIResponse assembly), budget.ts, connection.ts (Test connection)
  intents.ts      deterministic intent, search terms, page entity (pure)
  tools/          types.ts, registry.ts (static list, runTool), search-products.ts (the only tool in this scope)
  context/        types.ts (evidence package, RefAllocator), providers.ts, registry.ts (buildEvidencePackage), render.ts
  prompts/        style.ts (the Zeronix style block, evidence rules), registry.ts (versioned prompts)
  confidence/     score.ts (pure)
  provider-info.ts  client-safe provider hints (no SDK import)
  schemas.ts      zod: settings forms, ask input, the model's answer draft
  service.ts      provider settings (audited), execution log
  queries.ts      settings rows (never the key), provider config (decrypts, server only), recent runs
  actions.ts      thin server actions, key stripped from echoed forms
  components/     Settings > AI tables and forms (the floating assistant is Stage 2)
core/permissions/capabilities.ts   capability map (ADMIN, STAFF)
```

Tables: `ai_provider_settings` (one row per provider, one active, key encrypted) and `ai_executions` (append-only run log).

Same shape as every other module, so `ctx = { actor, db }`, zod on every input, `writeAudit` in the same transaction.

## 3. Deterministic before the model

The orchestrator classifies intent with rules (keywords, the current route, the entity in context) before any provider call. Data retrieval, ranking, freshness and confidence are **pure TypeScript functions over database rows**. The provider is used only to understand a phrasing and to word the answer. If a question can be answered without it, it is.

This keeps `CLAUDE.md`'s "deterministic rules before LLM reasoning" true, and it keeps the answer identical across providers because the numbers never come from the model.

## 4. Provider independence

The contract:

```ts
interface AIProvider {
  generateText(input: AITextRequest): Promise<AITextResponse>;
  generateStructured(input: AIStructuredRequest): Promise<AIStructuredResponse>; // json: unknown, validated centrally
  generateEmbedding?(input: string[]): Promise<number[][]>;
}
```

What is decided **outside** the adapter, and therefore identical for every provider: the evidence package, the tool results, the system prompt and style block, one strict JSON Schema generated from zod, the token limit, the zod validation, the evidence and figure checks, and the single repair retry (`orchestrator/generate.ts`). An adapter only maps that request onto its own SDK and maps the reply and errors back. It adds no instructions of its own.

**No sampling parameters are sent** (no temperature): Claude Opus 5 rejects them, and so do current OpenAI reasoning models. Consistency comes from the shared prompt, the schema and the checks. For `claude-opus-5` and `claude-fable-5-1` the Anthropic adapter switches on Anthropic's server-side refusal fallback; the log records the model that actually answered.

Result: switching provider on Settings > AI changes which API is called and nothing the user can see about structure, evidence or tone.

## 5. Evidence package

Everything the model is allowed to see for one request, built by the registered context providers and redacted to the actor's capabilities. It is provider-neutral, serialisable, and carries a reference for every fact (evidence id, observation id, `observedAt`). Untrusted text (supplier and customer wording) is delimited and labelled as data, never as instructions. Details: `context-builder.md`.

## 6. Response contract

Every request returns the same validated shape: answer, intent, confidence score and level, evidence references, matched entities, warnings, missing information, recommendations, next actions, whether approval is needed, and proposed changes when a later module produces them. Details: `ai-orchestrator.md`. A response that fails validation is retried once with the errors, then fails visibly. An invented evidence id fails validation: references are checked against the package.

## 7. Extension without redesign

New tables or modules add:
1. a **context provider** to `context/registry.ts`,
2. one or more **tools** to `tools/registry.ts`,
3. a **prompt version** to `prompts/versions/`.

The orchestrator, the adapters, the response schema and the UI are untouched. That is what makes the quotation module (and everything else deferred) additive rather than a rewrite.

## 8. Boundaries

The AI does not decide or invent selling price, supplier cost, stock, delivery date, warranty, specifications, supplier credibility, customer identity, quote totals, VAT, payment terms, margin or order status. It does not create, change, approve or send anything. Those values come from services and queries, or they stay unknown. `security.md` lists what is enforced and where.
