# AI Intelligence, Stage 1 (core) — tasks

**Goal:** a provider-independent, evidence-first AI core. An admin chooses the provider, model and key on Settings > AI. A question about a product, its price or its stock is answered from real observations, with deterministic confidence and warnings, and every run is logged.

**Plan:** `2026-09-21-ai-intelligence-core.md` (this folder). **Design:** `docs/ai-intelligence/`. **Decision:** ADR 0007.

**Approved by the user 2026-09-21:** the Stage 1 tables; sending customer data to the chosen provider with a person in the loop.

## Global constraints

- `CLAUDE.md` applies. No new tests (verify by hand: typecheck, lint, the screen, a script against the project database, anything created labelled `TEST`).
- The official SDKs: `@anthropic-ai/sdk`, `openai`, `@google/genai`. Nothing else new.
- **No temperature is sent to any provider.** Claude Opus 5 rejects sampling parameters, and current OpenAI reasoning models do too. Consistency comes from the shared prompt and schema.
- Default Anthropic model `claude-opus-5`, with server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) only for `claude-opus-5` and `claude-fable-5-1`. OpenAI and Gemini models are typed by the admin.
- `max_tokens` 16000 for non-streaming calls (Opus 5 thinks by default).
- One JSON schema per request, generated centrally from zod (`z.toJSONSchema`), made strict (every object `additionalProperties: false`, every property required, optional values nullable, no min/max keywords). Output is validated centrally with zod.
- The model never produces the confidence number, the evidence list or any commercial value. It writes the answer and cites evidence ids from the package; the validator rejects ids, entities or figures that are not in the package.
- Keys: `secret-box`, write-only, never returned by a query except the one that builds a provider, never in audit, logs, errors or a form echo.
- Execution log stores the question (max 500 characters), counts and codes. Never prices, keys or raw supplier text.
- The Quotation work is editing shared files at the same time. Re-read `schema.prisma`, `audit/types.ts`, `audit/describe.ts`, `labels.ts` and `settings-navigation.ts` immediately before editing them, and keep those edits minimal. Re-run the schema/database diff before creating the migration.

## Files

```text
prisma/schema.prisma                                  enums AiProvider, AiExecutionStatus; models AiProviderSetting, AiExecution; User back-relations
prisma/migrations/<ts>_ai_core/migration.sql          generated + CHECKs, one-active partial unique index, append-only trigger on ai_executions
src/core/permissions/capabilities.ts                  Capability, ROLE_CAPABILITIES, hasCapability, assertCapability
src/modules/audit/types.ts, describe.ts               AiProviderSetting entity; ai_provider.created|updated|key_changed|activated
src/lib/labels.ts                                     AI_PROVIDER_LABEL
src/config/settings-navigation.ts                     Settings > AI
src/modules/ai/
  providers/types.ts        AIProvider, requests/responses, ProviderConfig
  providers/errors.ts       AiProviderError (code), userMessage()
  providers/json-schema.ts  toStrictJsonSchema(zod)
  providers/anthropic.ts    createAnthropicProvider
  providers/openai.ts       createOpenAIProvider
  providers/gemini.ts       createGeminiProvider
  providers/registry.ts     PROVIDERS metadata, createProvider(config)
  schemas.ts                settings form schemas, askSchema, modelDraftSchema, aiResponseSchema, types
  intents.ts                INTENTS, WIRED_INTENTS, classifyIntent(), extractSearchTerms()
  tools/types.ts            AIToolDefinition, ToolResult
  tools/search-products.ts  searchProductsTool (wraps searchProcurement / getProductIntelligence)
  tools/registry.ts         TOOLS, getTool(), runTool()
  context/types.ts          ContextProvider, ContextFragment, EvidencePackage, Fact
  context/providers.ts      productOffersProvider, businessRulesProvider
  context/registry.ts       CONTEXT_PROVIDERS, buildEvidencePackage()
  context/render.ts         renderPackage() -> delimited text for the prompt
  confidence/score.ts       scoreEvidence() -> { score, level, reasons, warnings, missing }
  prompts/style.ts          ZERONIX_STYLE (the one style block)
  prompts/registry.ts       PROMPTS: answer-v1, interpret-v1, test-v1
  orchestrator/validate.ts  validateDraft(), unsupportedFigures()
  orchestrator/run.ts       askAssistant(ctx, input) -> AIResponse
  service.ts                createProviderSetting, updateProviderSetting, activateProviderSetting, recordExecution
  queries.ts                listProviderSettings, getActiveProviderConfig (server only, decrypts), getProviderConfig, listRecentExecutions
  actions.ts                thin actions: create, update, activate, test connection
  components/               provider-form.tsx, providers-table.tsx, executions-table.tsx
src/app/(workspace)/settings/ai/page.tsx              admin only
```

## Status (2026-09-21)

Tasks 1-7 and 9 done; task 8 done except a real answer from a provider, which needs an admin to enter a key.

**Verified:**
- `tsc`: zero errors across the whole project. ESLint is clean on every file touched.
- Migration `20260921130000_ai_core` applied with `migrate deploy`. The schema matches the database. In transactions that were rolled back, the database refused an update to `ai_executions` and a FAILED row without an error code.
- The script against the project database (scratchpad, not in the repo) checked:
  - Intents, search terms, page entity, the figure check and the strict schema (all objects closed, all properties required, no length keywords).
  - `search_products` and the evidence package on real products.
  - A request for a module that isn't built yet: answered by the rules and logged.
  - No provider set up: fails as `NO_PROVIDER` and is logged.
  - All three SDKs against the live APIs with an invalid key: each maps to `AUTH`.
  - Staff refused by the settings service.
- The real data exposed two faults, both fixed: a 0.00 supplier price scored 90% High, and a price question with "units" in it was classed as a stock question.
- `/settings/ai` compiles and redirects to `/login` without a session.

**First real provider (2026-09-21):**
- The user saved OpenAI with model `gpt-5.6-sol`. The key is stored encrypted and the change is audited.
- OpenAI refused the call with "no credits remaining", a 429 status. It sends the same status for rate limits, so the app wrongly said "busy, try again in a minute".
- Fixed with a new `QUOTA` error code, mapped for all three providers: OpenAI `insufficient_quota`, Anthropic `billing_error` or "credit balance", and Gemini billing wording.
- A real answer still needs credit on the account.

**Left behind:** three `TEST` rows in `ai_executions`. The log is append-only, so they stay. No provider settings were created.

**Not verified yet:**
- Settings > AI in a browser as admin: add, edit, replace the key, switch, switch off, test connection with a bad key and a good key.
- A real answer end to end, and switching provider on the same question.
- `next build`. Not run, because the dev server was running and the Quotation work was still changing.

## Tasks

- [ ] **1. Dependencies.** `npm install @anthropic-ai/sdk openai @google/genai`. Read each package's type definitions for the call, usage and error types before writing its adapter.
- [ ] **2. Schema and migration.** Re-read `schema.prisma` and re-run the diff (must be empty). Add the enums and models and the User back-relations. `prisma migrate dev --create-only --name ai_core`, append the SQL (CHECKs: model not blank, latency and tokens not negative, `(status = 'FAILED') = (error_code IS NOT NULL)`; partial unique index `WHERE is_active`; `ai_executions` append-only with the existing `forbid_mutation()`), inspect it contains only AI objects, then `prisma migrate dev` and `db:generate`.
- [ ] **3. Capabilities, audit types, labels, navigation.** Small edits to shared files after re-reading them.
- [ ] **4. Providers.** Interface, errors, strict JSON schema, three adapters, registry. Each adapter maps its SDK's errors to `AiProviderError` codes: `AUTH`, `RATE_LIMITED`, `UNAVAILABLE`, `BAD_REQUEST`, `REFUSED`, `TRUNCATED`, `INVALID_OUTPUT`, `UNKNOWN`. No adapter adds instructions or sampling parameters.
- [ ] **5. Settings slice.** Schemas, service (admin via `assertCapability(ctx, "ai.settings.manage")`, encrypt key, audit in the same transaction, one active provider), queries (key never selected except in the provider-building query), actions (strip `apiKey` from the echoed form, like `withoutPassword`), Test connection (a `test-v1` structured call that stores nothing), page with providers table, form drawer, and the recent executions table. Empty, error and missing-`APP_SECRET_KEY` states.
- [ ] **6. Tool, context, confidence.** `search_products` input `{ query } | { productId }`, capability `product.read`, amounts dropped without `supplier.cost.read`, evidence source id per observation. Context providers build the package; every fact carries a ref. Confidence: identity (exact / probable / words / none), evidence present, freshness band of the newest observation, person-confirmed observations, ambiguity penalty; warnings for stale evidence, price without stock, stock not available, VAT unknown, temporary product, words-only match.
- [ ] **7. Prompts and orchestrator.** Deterministic intent; unwired intents and no-match answers return without a provider call. Deterministic search terms first; `interpret-v1` asks the model for up to three search terms only when that finds nothing. `answer-v1` gets the rendered package. Validate, one repair retry with the errors, then a typed failure. Budget: 4 tool calls, 3 provider calls. Write one `AiExecution` row per run, success or failure.
- [ ] **8. Verify.** `npm run typecheck`, `npm run lint`, `prisma migrate status`. In the browser: Settings > AI as admin (add, edit, replace key, activate, test connection with a bad key and a good key), as Staff (refused). A scratch script (in the session scratchpad, not the repo) runs `askAssistant` against the project database: a known part number, a model name in a sentence, a word that matches nothing, a quotation question (not wired), with no provider, and after switching provider. Check each execution row. Nothing is created except `TEST`-labelled settings and log rows.
- [ ] **9. Docs.** Update `docs/ai-intelligence/*` where the build differs from the design (table names, context providers actually built, no temperature), the plan status, and `.env.example` note if any.
