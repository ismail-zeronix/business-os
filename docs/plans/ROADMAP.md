# Roadmap

Organised from `PROJECT_PLAN.MD` (sections 82-93). Only the active milestone (`docs/plans/active/CURRENT.md`) is implemented. The AI Intelligence plan is paused in `docs/plans/paused/`. Later phases are direction, not commitment; each starts with its own `CURRENT.md`.

| Phase | Focus | Status |
|---|---|---|
| **0 — Foundation** | Repo structure, Docker PostgreSQL, Prisma + migrations, app shell, navigation, shared UI, audit foundation. Auth/roles were added later (ADR 0006, 2026-09-21); a tool registry is still deferred. | **Active (current milestone)** |
| **1 — Supplier Intelligence** | Suppliers, contacts, brands, categories, procurement profile, search/filters, detail, notes, activity, audit. | **Active** |
| **2 — Broadcast Intelligence** | Manual broadcast entry, raw preservation, deterministic extraction, review, product linking/temporary products, price and stock observations, evidence drawer. | **Active** |
| 3 — Enquiry Intelligence | Manual + email enquiries, IMAP sync, dictionaries, deterministic RFQ classification and scoring, review inbox, requirement extraction, enquiry timeline. | **Built, awaiting live mailbox verification (`CURRENT.md`).** Phases 0-2 are complete and archived in `docs/plans/completed/`. Dictionary editor and a job queue are deferred; sync is a button plus a polling script. |
| 4 — Product Intelligence Expansion | Category-aware specifications, matching rules, match review, correction learning, product merge. (Product master, aliases and basic matching are in the current milestone.) | Foundation only |
| 5 — Procurement Search | Cross-system search: product -> suppliers -> stock -> price -> freshness -> evidence -> broadcasts, plus prior enquiries/quotations. | **First slice built and verified (2026-09-21)**: `/search` for products with supplier price, stock, freshness and evidence. Broadcasts, enquiries and suppliers-by-brand as sources are deferred. |
| 6 — Second Brain | Memory and knowledge models, entity relationships, full-text retrieval, pgvector, context builder, provenance, retrieval policies. | Later |
| 7 — Multi-Agent Platform | Agent registry and builder, skills and versions, tool registry, agent chat, provider selection, learning extraction, permissions parity with users. | Later |
| 8 — Sourcing / RFQ | Sourcing workspace, supplier candidates, RFQ drafts and tracking, responses, comparison, procurement decision snapshot. | **Two slices built and verified (2026-09-21).** (1) The outreach loop: a Sourcing tab on the enquiry to pick suppliers, copy a ready message, mark sent and record the reply as a broadcast. (2) Compare and choose supplier: replies side by side per requirement (no ranking), one choice per requirement that keeps the price and stock the buyer saw. Numeric terms, reliability and split orders are deferred (BACKLOG). |
| 9 — Quotations | Pricing workspace, margins, quotation revisions, customer-safe output, permissions, follow-ups. | **First slice built (2026-09-21; see `CURRENT.md` for what was verified).** Draft a quotation from an enquiry (cost from the chosen supplier, markup % and price that follow each other), issue it (frozen), revise it, and print the customer's copy (prices only) to PDF from the browser. Sending, bulk markup, currency conversion and margin visibility by role are deferred (BACKLOG). |
| 10 — Additional Integrations | Contact forms, WhatsApp API, supplier email broadcasts, Excel/PDF price sheets, supplier portals, website sourcing, APIs. Only after email and manual flows are stable. | Later |
| 11 — Advanced Intelligence | Supplier response analytics, price trends, coverage gaps, demand, quotation conversion, lost-enquiry reasons, reliability history, AI-assisted research. Needs enough history first. | Later |

## Sequencing notes
- **Development-first, then stabilise.** Build the main modules first. Once they are substantially complete, run the dedicated **stabilization and testing phase** (`docs/plans/STABILIZATION.md`: Vitest for business logic, integration tests, Playwright for critical journeys, permissions, validation, edge cases, production-readiness review) before any production use.
- The current milestone covers Phases 0-2 plus the slices of 4-5 needed to close the loop from broadcast to searchable product intelligence.
- Real authentication was a prerequisite for putting the system in front of the team: **built 2026-09-21** (email and password, sessions, two roles; ADR 0006). Still to do before real exposure: serve over HTTPS and complete /setup first.
- Do not start a phase because it is next in this table: start it when its `CURRENT.md` is written and approved.
