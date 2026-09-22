# Zeronix Intelligence — Development Rules

Internal procurement-intelligence application for Zeronix Technology LLC (a no-stock reseller).
Supplier broadcasts, prices, stock and enquiries become structured, searchable, evidence-backed knowledge.

## Authority and where to read

- `PROJECT_PLAN.MD` is the **long-term vision only**. Never implement something merely because it appears there.
- `docs/plans/active/CURRENT.md` is the **implementation authority** (one active plan). Update it only when scope genuinely changes.
- Read only what the task needs: `docs/architecture/OVERVIEW.md`, `docs/architecture/DATA_MODEL.md`, `docs/modules/<module>.md`,
  `docs/design/UI_SYSTEM.md` and `SCREENS.md` (any UI work), `docs/decisions/` (why things are the way they are).
- Useful ideas outside the current scope go to `docs/ideas/BACKLOG.md`, not into code.

## Working rules

1. Read the existing implementation before changing it. Prefer existing components and patterns.
2. Plan before non-trivial work.
3. Build complete vertical slices: schema, migration, service logic, validation, UI, evidence linkage, audit, error/empty/loading states, manual verification. Never mark placeholder features done.
4. Do not refactor unrelated working code. Do not add infrastructure or dependencies without an active requirement.
5. Keep documentation aligned with what is actually built.
6. Say explicitly when an action is security-sensitive or a migration is destructive, and get confirmation first.
7. Inspect before deleting or overwriting. Never run `prisma migrate reset` or `db push` against data that matters. Migrations only.

## Development-first approach (current phase)

**BUILD FIRST -> STABILIZE -> COMPREHENSIVE TESTING -> PRODUCTION.** Until the main modules are substantially complete:

- Priorities, in order: business functionality, correct architecture, database design, user experience, type safety, security, performance, then automated testing.
- **Do not write** unit, integration or E2E tests, mocks, fixtures or test infrastructure for individual features, and do not stop development to write comprehensive tests unless explicitly asked.
- **Do keep** TypeScript and ESLint clean, validate every input with zod, and enforce integrity with Prisma/PostgreSQL constraints. Skipping tests is never a reason to lower code quality, architecture, type safety, security or data integrity.
- Verify manually while building: typecheck, lint, load the screen, try the flow. When a major business workflow is complete, do one basic manual end-to-end check and move on.
- Keep code testable so tests can be added later without refactoring: pure functions for logic, services that take `ctx`, thin actions.
- **Use the project database for all verification.** Do not create test, e2e, scratch or duplicate databases or servers. Guardrails on the shared project data: label anything you create `TEST` so it is easy to remove; never bulk-load synthetic data; never truncate, reset or drop project data.
- Tests that already exist are kept (run them occasionally) but are not extended now. The dedicated testing phase is planned in `docs/plans/STABILIZATION.md`.

## Business rules (never violate)

- **PostgreSQL is the source of truth.** Not LLM chat history, not the UI state.
- **Price and stock are observations** (product + supplier + value + observed time + evidence). Never `Product.price` or `Product.stock`.
- **Preserve raw evidence.** The original broadcast/email is immutable. Structured data is derived from it.
- **Never overwrite history.** Observations are appended; a mistake is *retracted*, not edited or deleted.
- **Unknown stays unknown.** Missing quantity, VAT, warranty, currency, part number remain NULL / `UNKNOWN`.
- **Never fabricate** product, price, stock, supplier or customer information. This includes seed data and tests (label test data `TEST`).
- **Parsers and AI propose; humans confirm.** Extracted data is `PENDING` until a person confirms it.
- **Deterministic rules before LLM reasoning.** An LLM may later assist extraction; it is never the source of truth.

## Architecture rules

- Modular monolith: `app` pages -> `actions.ts` (thin) -> `service.ts` (business rules, transactions, audit) -> Prisma -> PostgreSQL.
  Business rules do not live in React components. Writes go through the owning module's service; read queries may join across tables.
- Services take `ctx = { actor, db }` so authorization can be added later without touching the UI.
- Validate every form and service input with zod. Audit important actions in the same transaction as the change.
- Do not introduce microservices, Kubernetes, Redis, queues, vector databases, multiple LLM providers, autonomous agents or WhatsApp/email integrations until `CURRENT.md` says so.
- Avoid giant files and abstractions that do not solve a current problem.

## UI

Follow `docs/design/UI_SYSTEM.md`. Compact, thin, information-dense, tables first. No oversized cards, no gradients, no emoji icons,
no fake screens for future modules.

## Environment notes (Windows)

- Shell is PowerShell/Git Bash on Windows 11. Node 26, Docker Desktop.
- Local Postgres for this project: `127.0.0.1:5442` (container `zeronix-bi-postgres`). **Use `127.0.0.1`, not `localhost`**, and never point
  this project at port 5432: an unrelated Postgres owns it. See `docs/decisions/0003-local-postgres-isolation.md`.
- Pinned on purpose: Prisma **7.10** (not the 8.0 RC that npm marks `latest`), TypeScript **5.9** (typescript-eslint does not support 7.x yet).
- Timestamps are stored in UTC and displayed in `Asia/Dubai`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
