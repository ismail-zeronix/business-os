# AI orchestrator

One service that turns a request into a validated, audited answer. `src/modules/ai/orchestrator/`.

## Steps

1. **Receive** a question plus page context (route, entity type, entity id) and the actor from `getServiceContext()`.
2. **Classify intent** with deterministic rules: keywords, the route, the entity in context. Unrecognised text falls back to `ANSWER_DATABASE_QUESTION`. No provider call is needed to classify.
3. **Check permissions**: the intent's required capabilities against the actor's. A refusal is a typed error, never a silent empty answer.
4. **Select tools** registered for that intent.
5. **Build context**: run the tools, then the registered context providers, redact, and assemble the evidence package.
6. **Apply deterministic rules**: freshness, exclusions, ranking, confidence. These produce numbers and warnings before any model sees anything.
7. **Call the provider** only if interpretation or wording is needed, with the shared style block and the response schema.
8. **Validate** the result: schema, every evidence reference present in the package, no commercial value that did not come from step 6. One repair retry with the errors, then a typed error.
9. **Return** the structured response.
10. **Record** an `AiExecution` row (provider, model, prompt version, intent, entity, summaries, status, latency, tokens) and, when a later module changes data, an `AuditLog` row in the same transaction.

## Intents

In this scope only the read-only ones are wired: `SEARCH_PRODUCT`, `CHECK_STOCK`, `CHECK_LATEST_PRICE`, `ANSWER_DATABASE_QUESTION`.

Reserved for later modules, listed so the classifier and the registry are designed for them: `MATCH_SUPPLIER`, `COMPARE_SUPPLIERS`, `ANALYZE_ENQUIRY`, `EXTRACT_SUPPLIER_BROADCAST`, `NORMALIZE_PRODUCT`, `FIND_ALTERNATIVE_PRODUCT`, `PREPARE_PROCUREMENT_TASK`, `DRAFT_SUPPLIER_MESSAGE`, `DRAFT_CUSTOMER_REPLY`, `PREPARE_QUOTATION_DRAFT`, `ANALYZE_QUOTE_RISK`, `FIND_FOLLOW_UP`, `SUMMARIZE_CUSTOMER_HISTORY`, `SUMMARIZE_SUPPLIER_HISTORY`, `DISCOVER_HIDDEN_SUPPLIERS`.

An intent that is not wired yet answers plainly that it is not available, and does not improvise.

## As built in Stage 1 (`orchestrator/run.ts`)

- **Intent** is decided by rules (`intents.ts`). Requests for modules not built yet (quotation drafts, customer replies, follow-ups, alternatives...) get a plain "not available yet" answer from the rules, with no provider call.
- **Search**: on a product page, a question that names no code and says "this"/"it" is about that product. Otherwise up to two deterministic terms are searched (the remaining phrase, then a code-shaped token). Only if they find nothing is the model asked for up to three search terms (`interpret-v1`). A question that names nothing gets "Which product do you mean?" without a model call.
- **Answer**: the evidence package is rendered as text (`answer-v1`), the model returns a draft, and `validate.ts` rejects unknown references and any figure (above 20) that is not in the evidence or the question. One repair retry, then `INVALID_OUTPUT`.
- **Budget**: at most 4 tool calls and 3 provider calls per request.
- **Log**: one `ai_executions` row per run, success or failure, with provider, served model, prompt version, counts, tokens and latency.

## Response shape

```ts
type AIResponse = {
  executionId: string;                     // the ai_executions row
  intent: Intent;
  answer: string;
  confidenceScore: number;                 // 0..1, from confidence/score.ts, never from the model
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  confidenceReasons: string[];
  evidence: EvidenceReference[];           // the cited observations, with evidenceSourceId to open the original
  matchedEntities: EntityReference[];      // products and suppliers in the package, with links
  warnings: string[];                      // deterministic first, then any the model added
  missingInformation: string[];
  recommendations: { title: string; reason: string }[];
  nextActions: { type: "OPEN_PRODUCT" | "OPEN_SUPPLIER" | "REQUEST_STOCK_CONFIRMATION" | "REFINE_QUESTION"; label: string; entity: EntityReference | null }[];
  requiresApproval: false;                 // nothing in this stage proposes a change
  proposedChanges: [];
  answeredBy: { provider; model; promptVersion } | null;  // null when the rules answered alone
};
```

The model only produces the draft (`schemas.ts` `answerDraftSchema`): answer text, cited references, extra warnings, missing information, recommendations and next actions with references. Everything else is assembled from the package.

Rules the validator enforces:
- Every `evidence[].id` exists in the package. An invented reference fails.
- `confidenceScore` comes from the deterministic scorer, not from the model.
- Warnings are never dropped because confidence is high.
- `requiresApproval` is true whenever `proposedChanges` is non-empty.
- `proposedChanges` must be empty until a proposing module exists.

## Budget and failure

A per-request cap on tokens and tool calls. Failures are typed and visible: no provider configured, no key, provider unreachable, rate limited, invalid output after the repair retry, permission refused, no evidence. Each is a clear sentence on screen, and each is recorded in `AiExecution` with its status. A failure never produces a confident-looking answer.
