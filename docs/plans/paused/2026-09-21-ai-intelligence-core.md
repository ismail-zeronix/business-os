# Current Development Plan

## Project

**Zeronix Intelligence**

## Active Milestone

**AI Intelligence: core and floating assistant** (roadmap: the platform part of Phases 6-7, without the agents). Customer **Quotation** (Phase 9) is still the next business milestone and is not started.

## Status

**Stage 0 done. Stage 1 (core) built 2026-09-21** at the user's go-ahead, in parallel with the last steps of the Quotation (still the active plan in `docs/plans/active/CURRENT.md`). This file stays here until the Quotation plan is archived, then moves to `docs/plans/active/CURRENT.md` for Stage 2. Tasks and what was verified: `2026-09-21-ai-intelligence-core-tasks.md`.

The user approved the Stage 1 tables and confirmed that customer data may be sent to the chosen provider with a person in the loop (ADR 0007, points 6 and 8).

Earlier status: paused at the user's request so the Quotation could be built first; the plan itself was approved on 2026-09-21. Sign-in and roles (ADR 0006) are built and verified; that plan is archived in `docs/plans/completed/2026-09-21-sign-in-and-roles.md` and its rules stay in force.

Earlier milestones are archived in `docs/plans/completed/`: Supplier & Broadcast Intelligence MVP, Enquiry Intelligence MVP, Procurement Search, Sourcing Requests, Compare and Choose Supplier, Sign-in and Roles.

## Purpose

Add an evidence-based AI layer between PostgreSQL and the screens, so the team can ask questions in plain language and get answers that cite their own supplier evidence. The AI explains and drafts. It never becomes the source of commercial truth: prices, stock, suppliers and customers come from validated services and queries. Design and rules are in `docs/ai-intelligence/` and ADR 0007.

## Decisions (2026-09-21)

1. **Scope now is docs, the AI core and the floating UI.** Domain modules and agents (enquiry, broadcast, matching, quote, follow-up) come later, each with its own plan.
2. **One module, `src/modules/ai/`,** with providers, orchestrator, tools, context providers, prompts, confidence. Same shape as the other modules (`actions.ts` thin, `service.ts`, `queries.ts`).
3. **Several LLM providers behind one interface** (Anthropic, OpenAI, Gemini), chosen on **Settings > AI** (admin only). This is the user's explicit request and is the reason for the exception to the "multiple LLM providers" line in `CLAUDE.md`. **Changing provider must not change the context, the tools, the response schema or the response style**: those are built before any provider is called and validated after.
4. **Keys** are stored with the existing `secret-box` (AES-256-GCM, ADR 0005): write-only in the UI, never sent to the browser, never in logs.
5. **The AI never writes business records** and never sends anything. It answers, cites evidence and drafts text for copy and paste.
6. **One read-only tool** in this scope: search products with latest supplier price and stock and evidence, wrapping `searchProcurement`. More tools arrive with later modules.
7. **Roles stay ADMIN and STAFF.** A capability map in `core/permissions` is the seam for cost and margin visibility. Both roles hold every capability today.
8. **UI follows the current v3 tokens** (`docs/design/UI_SYSTEM.md`). No re-skin.
9. **Testing stays deferred** (`CLAUDE.md`). `docs/ai-intelligence/test-plan.md` is written now, the tests come in the stabilization phase. Code is pure and testable.
10. **Sending business text to an external provider is a data-sharing decision.** It is recorded in ADR 0007 and needs the user's explicit confirmation before Stage 1 code runs against a real provider.

## Stages

| Stage | Scope | Gate |
|---|---|---|
| 0 | Docs in `docs/ai-intelligence/`, ADR 0007, this plan, doc-drift fixes | Done when the docs match the plan |
| 1 | **Core:** provider interface and adapters, `AiSetting` and Settings > AI, `AiExecution` log, tool registry, capability map, context-provider registry (no domain providers yet), prompt registry with the Zeronix style block, `AIResponse` schema, orchestrator, audit | Migration approval and data-sharing confirmation |
| 2 | **Floating UI:** assistant button and chat panel, `AiConversation` / `AiMessage` / `AiFeedback`, streaming route handler, page context, suggested prompts, evidence / confidence / warning blocks, copy, regenerate, feedback, mobile layout, reduced motion, loading and error states | Migration approval |

Each stage starts with the objective, files, database, API, UI and security impact, and ends with typecheck, lint on changed files, a manual smoke test on the project database (anything created is labelled `TEST`) and updated docs.

## Out of scope

Agents, the enquiry / broadcast / matching / quote modules, supplier discovery, warranty fields, `AiSuggestion` with approve and reject, sending any message, a quotation module, new roles, vector search, full-text or trigram search, a job queue, streaming through server actions, provider fine-tuning or learning. Ideas go to `docs/ideas/BACKLOG.md`.

## Definition of Done (stages 1 and 2)

1. `src/modules/ai/**` exists with typed, zod-validated inputs and outputs; typecheck, lint and `next build` are clean.
2. Migrations are additive and applied with `prisma migrate` only. Nothing existing is renamed or removed.
3. An admin can choose provider and model on Settings > AI and store a key. Staff cannot. The key never reaches the browser.
4. Switching provider keeps the same answer structure, evidence and style block. Every execution is logged with provider, model, prompt version, latency and status.
5. The assistant answers a product / stock / price question from real evidence, shows confidence, warnings and sources, and says "unknown" when evidence is missing.
6. It creates and changes no business record and sends nothing.
7. It appears on every signed-in page and not on `/login` or `/setup`, works on a narrow screen, respects reduced motion, and shows loading and error states.
8. Docs in `docs/ai-intelligence/` match what was built.

## Documentation

`docs/ai-intelligence/*` (twelve files, see its `implementation-roadmap.md`), `docs/decisions/0007-ai-intelligence-layer.md`, and updates to `OVERVIEW.md`, `AGENTS.md`, `ROADMAP.md`, `README.md`.
