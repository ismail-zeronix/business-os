# Module: Agents and Second Brain — FUTURE, NOT ACTIVE

> **Do not implement.** Conceptual notes only, from `PROJECT_PLAN.MD` (sections 33-52), kept so current choices do not block them. Nothing here is built until `docs/plans/active/CURRENT.md` says so.
>
> **Update 2026-09-21:** the *platform* part of this is designed as the AI intelligence layer (ADR 0007, `docs/ai-intelligence/`): the provider interface, tool registry, context builder, confidence scoring and a read-only floating assistant. That milestone is **paused after its documentation stage** (`docs/plans/paused/`), so none of it is built. **Agents themselves, memory classes, skills, learning and pgvector are further out still** — see `docs/ai-intelligence/agents.md` for the bounded-agent shape planned on top of that layer.

## Idea
Zeronix will eventually run several specialised AI agents (procurement, product specialist, enquiry analyst, quotation assistant...). The LLM is a **replaceable, stateless provider**. Zeronix's competitive asset is its structured evidence, memory, workflows and learned skills, all in PostgreSQL.

## Conceptual architecture

```
User message -> Agent router -> Context builder -> Second Brain retrieval
   -> relevant evidence + agent memories + skill instructions -> selected LLM -> response / tool actions
   -> memory learning pipeline -> PostgreSQL
```

- **Agent definition** (persisted): role, instructions, skills, allowed tools, data scope, default provider/model, approvals.
- **Business Constitution**: shared rules every agent inherits (evidence before intelligence, never fabricate, unknown is valid, supplier prices are time-sensitive, do not overwrite history, important external actions need authorisation).
- **Skills** are versioned packages; **learning** is controlled (low-risk facts learned automatically, procedural changes proposed for admin approval).
- **Tools, not tables**: agents call typed capabilities (`searchProducts`, `getLatestPrices`, `getStockEvidence`, `parseBroadcast`, ...) with schema validation, permission checks and audit. An agent never has more authority than the user invoking it.
- **LLM provider interface** (`generateText`, `generateStructured`, `embed`, `stream`, `toolCall`); provider secrets in encrypted storage.
- **Second Brain**: PostgreSQL structured records + full-text search + pgvector when semantic retrieval is needed; memory classes (source evidence, structured facts, episodic, semantic, procedural, preferences), each with provenance. Never rely on a provider's chat history.

## What the current design already does to stay compatible
- Services are `fn(ctx, input)` with typed zod input/output and an `actor`: they can be wrapped as tools without rewriting business logic.
- Audit rows record the actor and reasons; an actor type (user/agent) is an additive column later.
- Evidence and observations carry provenance, which is what memory records will cite.
- No provider-specific state is stored anywhere.
- pgvector is not installed. The Debian `postgres:17` image allows a later switch to `pgvector/pgvector:pg17` without a data migration (ADR 0003).
