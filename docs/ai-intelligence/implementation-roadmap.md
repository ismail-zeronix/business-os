# Implementation roadmap

Authority: `docs/plans/paused/2026-09-21-ai-intelligence-core.md` (paused while the customer Quotation is built; it returns to `docs/plans/active/CURRENT.md` when resumed). A stage starts only when the previous one is verified and the user has approved any migration.

**Stage 0 complete. Stage 1 built 2026-09-21** at the user's go-ahead, alongside the last steps of the Quotation (tasks: `docs/plans/paused/2026-09-21-ai-intelligence-core-tasks.md`). The one check still open is a real answer from a provider, which needs an admin to enter a key in Settings > AI. Stage 2 (floating assistant) has not started.

## Stage 0 — Audit and architecture (complete)

Documents only. No application code, no migration, no dependency.

| File | Purpose |
|---|---|
| `existing-system-audit.md` | What exists, what is reused, what is missing |
| `architecture.md` | The layer as a whole |
| `ai-orchestrator.md` | Request flow, intents, response contract |
| `context-builder.md` | Evidence package and context providers |
| `tool-registry.md` | Tool contract and limits |
| `agents.md` | Planned agents, not built |
| `confidence-scoring.md` | Factors, levels, display |
| `evidence-model.md` | Citing the existing evidence model |
| `security.md` | Permissions, injection, secrets, data sharing |
| `floating-chat-ui.md` | Assistant button and panel |
| `implementation-roadmap.md` | This file |
| `test-plan.md` | What to test in the stabilization phase |

Also: `docs/decisions/0007-ai-intelligence-layer.md`, a new `CURRENT.md` (sign-in plan archived), and doc-drift fixes in `README.md`, `OVERVIEW.md`, `AGENTS.md` and `ROADMAP.md`.

**Done when** the documents match the approved plan and every path they cite exists.

## Stage 1 — Core

Provider interface and the Anthropic, OpenAI and Gemini adapters behind a registry. `AiSetting` and Settings > AI (admin only, encrypted write-only keys, test-connection). `AiExecution` logging. Tool registry with `search_products`. Capability map in `core/permissions`. Context-provider registry with the product, price, stock, supplier and business-rule providers. Prompt registry with the shared Zeronix style block. `AIResponse` zod schema. Orchestrator: intent, permissions, context, deterministic rules, provider call, validation, one repair retry, audit.

Database: `AiProviderSetting` (`ai_provider_settings`), `AiExecution` (`ai_executions`), migration `20260921130000_ai_core`. Additive. SDKs: `@anthropic-ai/sdk`, `openai`, `@google/genai`.
**Gate:** migration approval, and the user's confirmation of the data-sharing decision in ADR 0007 before the first real provider call.
**Done when** an admin can configure a provider, a question returns a validated structured response with evidence, every execution is logged, and switching provider changes nothing but the provider and model in the log.

## Stage 2 — Floating assistant

Assistant button and chat panel, conversation history, streaming route handler, page context and suggested prompts, answer blocks (answer, confidence, evidence, warnings, next actions), copy, regenerate, feedback, mobile layout, reduced motion, loading and error states.

Database: `AiConversation`, `AiMessage`, `AiFeedback`. Additive.
**Gate:** migration approval.
**Done when** the assistant answers a real product, price or stock question from the project database with evidence and confidence, says "unknown" where evidence is missing, creates no record, sends nothing, and works on a narrow screen.

## Later, each with its own plan and approval

| Stage | Scope | Blocked by |
|---|---|---|
| A | More read-only tools: supplier, stock and price comparison, history | Nothing |
| B | Enquiry intelligence as PENDING suggestions | `AiSuggestion` |
| C | Broadcast intelligence: LLM extractor behind `BroadcastParser`, warranty fields | Warranty migration |
| D | Supplier matching: ranking, freshness exclusion, exact against equivalent, supplier discovery states | Discovery migration |
| E | Quote and email copilot | **A quotation module, which does not exist** |
| F | Accuracy reports, confidence calibration, prompt-version tracking, reviewable rule changes | Feedback history |

## Process for every stage

Before: state the objective, the files, and the database, API, UI and security impact. Wait for approval when it is architectural or high-risk.
After: `npm run typecheck`, `npm run lint`, migration status, a manual smoke test on the project database with anything created labelled `TEST`, updated documents, then a report of what was done, what was left and what is next.
