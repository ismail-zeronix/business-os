# Existing system audit

Audit date: 2026-09-21. Read-only inspection of the repository before any AI work. The AI milestone is paused after this documentation stage (`docs/plans/paused/2026-09-21-ai-intelligence-core.md`); re-check anything here that the Quotation milestone touches before resuming. Business logic was not changed. Sources: `CLAUDE.md`, `README.md`, `PROJECT_PLAN.MD`, `docs/**`, `package.json`, `prisma/schema.prisma`, the migrations, `src/**`.

## 1. Existing stack

| Area | Reality |
|---|---|
| Framework | Next.js 16.3.5 (App Router, Turbopack), React 19.2, TypeScript 5.9 |
| Styling / UI | Tailwind 4 (CSS-first tokens in `src/app/globals.css`), shadcn `radix-nova`, `lucide-react` only, `sonner`, `cmdk`, `framer-motion` |
| Data | PostgreSQL 17 in Docker on `127.0.0.1:5442`, Prisma 7.10 with `@prisma/adapter-pg`, UUIDv7 ids, generated client in `src/generated/prisma` |
| Validation | zod 4 on every form and service input |
| Email | `imapflow`, `postal-mime` (read-only IMAP) |
| Tests | Vitest, 15 pure/DB test files, a separate `_test` database guarded in `src/test/global-setup.ts`. Not extended until stabilization (`CLAUDE.md`) |
| Not present | Any LLM SDK or key, SWR / react-query, `/api` routes, `proxy.ts`, full-text or trigram search, job queue |

Next 16 notes that matter here (`node_modules/next/dist/docs/`): `params` and `searchParams` are async; `cookies()` and `headers()` are async; route handlers are `route.ts` and can stream a `Response`; layouts do not re-run on client navigation, so every route handler must call `requireActor()` itself; `cacheComponents` is off.

## 2. Existing modules (`src/modules/*`)

Every module follows `actions.ts` (thin) -> `service.ts` (rules, transaction, audit) -> `queries.ts` (reads), with `schemas.ts` for zod and `components/`.

`suppliers`, `products` (with `matching.ts`), `broadcasts` (with `parsing/`), `enquiries` (with `parsing/`), `customers`, `email` (IMAP sync, scoring, triage), `evidence`, `observations`, `sourcing` (supplier requests, compare, decision), `search`, `audit`, `overview`, `users`. Roles and sign-in: `src/core/auth`, `src/core/permissions`.

## 3. Existing data model (`prisma/schema.prisma`, 6 migrations)

- **Identity:** `User` (role ADMIN / STAFF, password hash, lockout), `Session`.
- **Master data:** `Brand`, `Category`, `Product` (name, brand, category, family, model, part number, manufacturer SKU, normalized model and part number, temporary flag), `ProductAlias`.
- **Suppliers:** `Supplier` (includes free-text `warrantyNotes`, `paymentTerms`, `deliveryNotes`), `SupplierContact`, brand and category join tables.
- **Evidence and observations:** `EvidenceSource` (immutable raw text, hash, kind, channel, `observedAt`), `Broadcast`, `BroadcastItem` (write-once `extractedData`), `PriceObservation`, `StockObservation` (append-only, retractable, evidence NOT NULL).
- **Demand side:** `Customer`, `CustomerContact`, `Enquiry`, `EnquiryItem`, `EmailAccount` (password encrypted), `EmailMessage`.
- **Sourcing:** `SupplierRequest` (one per enquiry and supplier), `ProcurementDecision` (chosen supplier per requirement, keeps the price and stock the buyer saw).
- **Audit:** `AuditLog` (actor, action, entity, scope, details JSON), append-only by trigger.

Database triggers enforce immutability of evidence, one-way retraction of observations, append-only audit and the last-admin rule.

## 4. Existing procurement flow

Supplier broadcast (or a reply to a supplier request) -> immutable evidence -> deterministic parser proposes items -> human reviews and confirms -> price and stock observations -> `/search` shows products with latest supplier price, stock, freshness and evidence. Customer enquiry (manual or email, scored, triaged by a person) -> requirement items -> Sourcing tab: choose suppliers, copy a message (no customer data in it), mark sent, record the reply as a broadcast -> compare replies side by side -> choose a supplier per requirement. Nothing is sent by the application and nothing is created automatically.

**Stops here:** quotation. There is no quote table, price workspace, margin or revision.

## 5. Existing roles and permissions

Two fixed roles, ADMIN and STAFF (ADR 0006). `getServiceContext()` returns `{ actor, db }`; `assertAdmin(ctx)` guards users, mailbox accounts, brands and categories; `requireActor()` and `requireAdmin()` guard pages. Everything else is open to any signed-in user. There is no cost or margin split, no per-record ownership, no tenancy. Sign-in is enforced once an active admin has a password; it is on in the current database.

## 6. Existing UI conventions

Design v3 (`docs/design/UI_SYSTEM.md` banner): lime primary `#b4e64e`, brand green `#2a8a4a`, deep green sidebar, Plus Jakarta Sans, 12px radius, green-tinted neutrals, dense tables first, light theme only. Server components read through module `queries.ts`; writes go through thin server actions with `runAction` and `useActionFeedback`. URL state (`?tab`, `?peek`, `?evidence`) is used instead of client stores. The authenticated shell is `src/app/(workspace)/layout.tsx`; `/login` and `/setup` live in `(auth)`.

## 7. Reusable components and code

| Need | Reuse |
|---|---|
| Evidence and observations | `EvidenceSource`, `PriceObservation`, `StockObservation`, `modules/evidence`, `modules/observations/procurement-queries.ts` |
| Product lookup | `modules/products/matching.ts` (exact part number, model, alias), `modules/search/queries.ts` `searchProcurement` |
| Extraction seams | `BroadcastParser`, `EnquiryParser` interfaces (`{ name, version, parse }`) |
| Audit | `writeAudit(ctx, ...)` in `modules/audit/service.ts` inside `inTransaction` (`core/database/tx.ts`) |
| Secrets | `core/security/secret-box.ts` (AES-256-GCM, `APP_SECRET_KEY`) |
| Actions | `core/validation/action-result.ts` `runAction`, `components/forms/use-action-feedback.ts` |
| UI | `PageHeader`, `Panel`, `SoftPill`, `status-badges.tsx` (`ConfidenceBadge`, `FreshnessBadge`, `StockBadge`), `EvidenceDrawer`, `UrlSheet`, `FormDrawer`, `states.tsx`, `sonner`, `ShellContext` breadcrumbs |
| Supplier text | `modules/sourcing/message.ts` (no customer data) |

## 8. Existing gaps

- No LLM code, provider settings or keys.
- No quotation, quote item, revision or margin tables.
- No task or follow-up table (only `Enquiry.nextAction`).
- Warranty is free text on `Supplier` only. No warranty type, source or verification date.
- No supplier discovery states.
- No fuzzy or full-text search (btree on normalized columns, token `contains`).
- No unified communication thread; attachments are JSON metadata only.
- No cost or margin visibility control; no Founder / Manager / Sales / Procurement roles.
- No outbound email; no supplier reliability or response-time history.

## 9. Tables that can be reused as they are

`EvidenceSource`, `PriceObservation`, `StockObservation`, `Product`, `ProductAlias`, `Supplier`, `SupplierContact`, `Customer`, `Enquiry`, `EnquiryItem`, `SupplierRequest`, `ProcurementDecision`, `AuditLog`, `User`. The prompt's "Evidence" table already exists as `EvidenceSource` plus the observations, so no new evidence table is added.

## 10. Tables that need extension (later, not in the current scope)

| Table | Extension | When |
|---|---|---|
| `PriceObservation` | Warranty type and duration — **done 2026-09-23** (`docs/architecture/DATA_MODEL.md` §17). Warranty *source* and *verification date* remain out of scope (the existing evidence/`observed_at` already answers "when," and the source is always the broadcast's supplier). | Broadcast intelligence |
| `StockObservation` | Stock status values beyond today's | Broadcast intelligence |
| `Supplier` | Discovery state (DISCOVERED to TRUSTED) | Supplier matching |
| `AuditLog` | `actor_type` (user / agent), already planned in `DATA_MODEL.md` | First agent |
| `Enquiry` | A real task or follow-up table | Follow-up agent |

## 11. New tables in the current scope

`AiProviderSetting`, `AiExecution` (stage 1, built); `AiConversation`, `AiMessage`, `AiFeedback` (stage 2). `AiSuggestion` waits for the first module that proposes changes. All additive.

## 12. Recommended integration points

- New module `src/modules/ai/` in the existing shape.
- `AssistantFab` mounted in `src/app/(workspace)/layout.tsx` after `SidebarProvider`.
- Streaming route handler `src/app/api/assistant/route.ts` (calls `requireActor()` itself).
- Settings > AI beside the other settings pages (`src/config/settings-navigation.ts`), admin only.
- Capability map next to `assertAdmin` in `core/permissions/roles.ts`.
- New audit action and entity types in `modules/audit/types.ts`.
- First tool wraps `searchProcurement`.

## 13. Risks and assumptions

- **Data leaves the company** when text is sent to a provider. Recorded in ADR 0007; needs the user's confirmation.
- **No cost split:** both roles see supplier cost, so both hold every capability for now.
- **Sparse evidence** gives thin answers. The AI must say "unknown".
- **Structured-output reliability** varies by provider. One repair retry, then a typed error.
- **Toaster and dev indicator** also sit bottom-right; the assistant button needs an offset.
- **Doc drift found:** `README.md` still names the Enquiry milestone and says "no login yet"; `docs/architecture/OVERVIEW.md` section 9 lists agents as future (correct) but `AGENTS.md` still says "do not implement" without pointing at this work. Fixed in Stage 0. An early read of `CURRENT.md` reported sign-in as "Not started": that was out of date, the file says built and verified 2026-09-21 and ADR 0006 is accepted.
- Real customer email is stored in the database; it must never reach a prompt without going through the context builder's redaction.
