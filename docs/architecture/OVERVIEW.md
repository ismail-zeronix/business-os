# Architecture Overview

Modular monolith. One Next.js application, one PostgreSQL database. Vision and long-term design: `PROJECT_PLAN.MD`. What is built now: `docs/plans/active/CURRENT.md`.

## 1. Runtime topology (this milestone)

```
Browser
   |
Next.js app (runs on the host)        React Server Components + Server Actions
   |
Service layer  (src/modules/*/service.ts)
   |
Prisma (driver adapter: pg)
   |
PostgreSQL 17 in Docker  (127.0.0.1:5442)
```

Only PostgreSQL is containerised. There is no queue, cache, search engine or vector store. The parsers are synchronous and fast. Email sync is a service function (`modules/email/sync.service.ts`) called from a button in the app or from an optional polling script (`npm run mail:sync`, `scripts/mail-sync.ts`); a compare-and-set lease on the account prevents overlapping runs, so no job queue is needed yet.

## 2. Layers and responsibilities

| Layer | Location | Responsibility | Must not |
|---|---|---|---|
| Pages / components | `src/app`, `src/modules/*/components`, `src/components` | Render, collect input, call actions | Contain business rules or call Prisma directly |
| Actions | `src/modules/*/actions.ts` | Thin: `FormData` -> zod -> service -> `revalidatePath` -> `ActionResult` | Hold logic; catch-and-hide errors |
| Services | `src/modules/*/service.ts` | Business rules, invariants, transactions, audit | Depend on React/Next |
| Queries | `src/modules/*/queries.ts` | Read side (lists, search, latest observations) | Mutate data |
| Core | `src/core/*` | Prisma client, transaction helper, actor context, error types, validation helpers | Know about modules |
| Lib | `src/lib/*` | Pure helpers: normalisation, formatting, freshness | Touch the database |

**Service contract.** Every mutating service is `fn(ctx, input)` where `ctx = { actor, db }` and `db` is the Prisma client or an open transaction. Services run their own transaction when they need several writes, write audit rows in that transaction, and throw typed domain errors (`NotFoundError`, `ConflictError`, `ValidationError`, `InvariantError`). Actions translate those into user-facing messages; unexpected errors are logged and shown generically. Database-unavailable errors get a specific, non-technical message.

## 3. Modules and boundaries

| Module | Owns | May call |
|---|---|---|
| `suppliers` | Supplier, SupplierContact, supplier/contact brand & category links | `audit`, `products` (brand/category lookups), `observations`/`broadcasts` queries (last evidence, prices tab) |
| `products` | Brand, Category, Product, ProductAlias, matching, product search | `audit`, `observations` queries (product intelligence view) |
| `evidence` | EvidenceSource (create, hash, read raw) | `audit` |
| `observations` | PriceObservation, StockObservation, retraction, latest-per-supplier | `evidence` (read), `audit` |
| `broadcasts` | Broadcast, BroadcastItem, parser, review workflow (confirm / ignore / reopen) | `suppliers` (read), `products` (match, create, alias), `evidence`, `observations`, `audit` |
| `audit` | AuditLog write + list | none |
| `customers` | Customer, CustomerContact | `audit` |
| `enquiries` | Enquiry, EnquiryItem, requirement parser, review workflow, supplier-intelligence read | `customers` (write via its services), `products` (match, create, alias), `evidence`, `observations` queries (read), `audit` |
| `email` | EmailAccount, EmailMessage, IMAP sync, MIME normalisation, scoring, triage | `enquiries` (create an enquiry from an email), `customers` and `suppliers` (read: is the sender known?), `evidence`, `audit`. Secrets via `core/security/secret-box` |

Rules: dependencies point one way (`broadcasts` -> `observations` -> `evidence`; nothing depends on `broadcasts` except pages; `email` -> `enquiries` -> `customers`). **Writes go through the owning module's service.** Read queries may join across tables for display. No module reaches into another module's non-exported files.

## 4. PostgreSQL ownership

PostgreSQL is the system of record for everything. Integrity is enforced in the database (FKs, unique, CHECK, append-only and immutability triggers). See `DATA_MODEL.md`. Migrations only (`prisma migrate`); never `db push`. The application never depends on an LLM provider's memory or state.

## 5. Evidence model

`EvidenceSource` is the immutable raw artefact (text, hash, channel, `observed_at`, creator). A supplier broadcast is a workflow wrapper (`Broadcast`) around one evidence row. Every observation carries a NOT NULL reference to its evidence, so any price or stock value can be traced to the original message, contact, time and the extraction and corrections behind it. New evidence kinds (email, quotation, spreadsheet) are new `kind` values, not new observation tables. This is now in use: `CUSTOMER_ENQUIRY` (a pasted customer request; an `Enquiry` wraps it 1:1) and `CUSTOMER_EMAIL` (an ingested email). For email, `raw_text` is the clean rendering (a fixed From / To / Cc / Date / Subject block, a blank line, then the text) and the original MIME is kept in `email_messages.raw_source` (immutable, downloadable as `.eml`). An enquiry created from an email reuses the email's evidence row; it is never copied.

## 6. Observation model

`PriceObservation` and `StockObservation` are append-only facts. Freshness is measured from `observed_at` (when the supplier stated it), not `created_at`. "Latest" is a query, not a stored value. A wrong confirmation is *retracted* (kept, excluded from latest), never edited or deleted.

## 7. Extraction and matching seams (built now, intentionally small)

- `BroadcastParser { name, version, parse(rawText, context) }` returns *proposals*. The first implementation is a deterministic, rule-based parser. An LLM extractor could later implement the same interface as an optional aid; output is still a proposal and still needs human confirmation.
- Product matching is a pure layered function (part number -> model -> alias -> manual) returning candidates with a basis. It never auto-confirms.
- `EnquiryParser { name, version, parse(rawText, context) }` is the same idea for customer requests: header suggestions (delivery, urgency, required-by wording) shown with an Apply button, plus requirement items as proposals. It reuses the broadcast extractors.
- `scoreEmail(input, context)` is a pure deterministic scorer (weights and phrase lists in `modules/email/scoring/config.ts`). It records every rule that fired. It never creates anything: a person triages.

## 8. Security posture (this milestone)

**Sign-in and roles (ADR 0006).** People sign in with email and password (scrypt hashes, database sessions, an `httpOnly` cookie); there are two roles, ADMIN and STAFF. `core/permissions/actor.ts` is the one place that decides "who is acting": pages and layouts call `requireActor()` first, actions get their actor from `getServiceContext()`, admin-only services call `assertAdmin(ctx)`, and scripts use `getSystemContext()`. Sign-in is enforced once an active admin has a password; before that (a fresh install) the seeded development user acts and a banner links to `/setup`. The dev server binds to localhost and Postgres to `127.0.0.1`: the build is for a trusted network, and must be served over HTTPS in production. Secrets live in a git-ignored `.env`; `.env.example` holds local-only defaults. Destructive or security-sensitive actions must be called out in plans and PRs.

**Mailbox credentials** (ADR 0005): stored AES-256-GCM encrypted with `APP_SECRET_KEY` from `.env` (never in the database), write-only in the UI, excluded from every query except the sync and test-connection paths, and never in logs, errors, audit details or the values a failed form echoes back. The mailbox is opened read-only, TLS is mandatory and certificates are always verified. Real customer email is stored (immutably) and appears in backups. Sign-in is now in place (ADR 0006); the mailbox settings are admin-only.

## 9. Future integration boundaries (conceptual, not built)

- **Email / enquiries (built, see `docs/modules/ENQUIRIES.md`):** IMAP -> MIME parse -> normalise -> deterministic rule scoring -> human triage -> enquiry. **Still future:** an optional LLM refinement step, database-managed dictionaries, reply/thread linking, sending mail, and a PostgreSQL-backed job queue (only if the button and polling script prove insufficient).
- **AI intelligence layer (designed, paused; see `docs/ai-intelligence/` and ADR 0007):** an orchestrator between the database and the screens. The model calls *tools* (typed input/output, zod validation, capability check, audit), never raw tables and never SQL; context is rebuilt from PostgreSQL per request and redacted to the actor; the LLM is a stateless, replaceable provider behind an interface, chosen in Settings. Its milestone builds the core and a read-only floating assistant; it is paused after the documentation stage, so **none of it is built yet**. **Still future:** agents, LLM extraction, proposals with approve and reject, and pgvector. See `docs/modules/AGENTS.md` for the longer-term Second Brain notes.
- **Auth / roles (built, ADR 0006):** more roles, single sign-on or two-factor sign-in would extend `core/permissions` and `core/auth`; nothing in the modules would change, because they only see `ctx.actor`.
- **Other channels** (WhatsApp API, Excel/PDF import, portals): new evidence kinds and ingestion adapters that produce the same `EvidenceSource` + item structures.

Nothing above is implemented until `CURRENT.md` says so.

## 10. Testing approach

**Development-first** (see `CLAUDE.md`): during active development the required checks are TypeScript, ESLint and manual verification of each feature and finished workflow; comprehensive automated testing is deferred to a dedicated stabilization phase (`docs/plans/STABILIZATION.md`). The architecture is kept test-friendly: pure functions for logic (normalisers, parser, matching, freshness), services that take an explicit `ctx = { actor, db }` (so they can run against any database, including a dedicated one in the stabilization phase), and thin actions. During development, verification uses the project database (see `CLAUDE.md`). The tests written so far are retained but not extended until stabilization.
