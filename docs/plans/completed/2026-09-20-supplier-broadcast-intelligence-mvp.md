# Current Development Plan

## Project

**Zeronix Intelligence**

## Active Milestone

**Supplier & Broadcast Intelligence MVP**

## Status

Completed 2026-09-20 (archived; superseded by the Enquiry Intelligence MVP plan in `docs/plans/active/CURRENT.md`)

## Purpose

Build the first fully usable procurement-intelligence vertical slice.

The goal of this milestone is not to build the entire Zeronix Intelligence platform.

The goal is to establish the real working foundation for supplier intelligence, supplier broadcasts, product matching, price observations, stock observations and source evidence.

This milestone should prove the core procurement-data model before adding enquiries, email ingestion, agents, Second Brain, RFQ workflows or quotation modules.

---

# 1. Milestone Objective

A user must be able to:

```text
Create Supplier
      ↓
Add Supplier Contacts
      ↓
Assign Brands / Categories
      ↓
Paste Supplier Broadcast
      ↓
Preserve Original Broadcast
      ↓
Extract Broadcast Items
      ↓
Review / Correct Items
      ↓
Match Existing Product
or
Create New / Temporary Product
      ↓
Confirm
      ↓
Create Price Observation
      ↓
Create Stock Observation
      ↓
Search Product
      ↓
View Supplier + Price + Stock + Freshness
      ↓
Open Original Evidence
```

The entire workflow must persist correctly in PostgreSQL.

---

# 2. Current Technical Foundation

Preferred initial stack:

- Next.js
- TypeScript
- React
- PostgreSQL
- Prisma ORM
- Tailwind CSS
- shadcn/ui
- Docker Compose for PostgreSQL
- Geist typography
- Lucide icons

Architecture:

**Modular Monolith**

Do not introduce microservices during this milestone.

The Next.js application may run directly on the local machine.

PostgreSQL should run locally through Docker.

---

# 3. Current Local Architecture

```text
Browser
   ↓
Next.js
   ↓
Application / Service Layer
   ↓
Prisma
   ↓
PostgreSQL
   ↓
Docker
```

Keep local development simple.

Do not Dockerize unrelated services yet.

---

# 4. In Scope

## 4.1 Application Foundation

Implement:

- Next.js application structure
- TypeScript configuration
- PostgreSQL Docker Compose setup
- persistent PostgreSQL volume
- Prisma configuration
- `.env.example`
- database migrations
- development seed support
- application shell
- sidebar navigation
- top-level layout
- shared loading states
- shared empty states
- shared error states
- basic audit foundation

Do not spend excessive time polishing infrastructure.

---

# 5. Supplier Intelligence

Implement a complete Supplier module.

## Supplier fields

Support at minimum:

- supplier name
- legal/trading name where applicable
- supplier type
- country
- emirate/location
- general email
- general phone
- WhatsApp
- website
- active/inactive status
- notes
- payment terms
- credit terms where known
- warranty notes
- delivery notes
- created timestamp
- updated timestamp

Unknown values must remain unknown.

Do not force users to enter unnecessary information.

---

# 6. Supplier Contacts

One supplier may contain multiple contacts.

Implement:

- contact name
- designation / role
- mobile
- WhatsApp
- email
- department
- preferred communication method
- brands/categories handled
- notes
- active/inactive status

Users should be able to add, edit and archive contacts.

Do not assume one contact per supplier.

---

# 7. Supplier Brands and Categories

Suppliers should be associated with:

- brands they commonly handle
- categories they commonly handle

Examples:

Brand:

Dell  
HP  
Lenovo  
HPE  
Cisco  
Ubiquiti

Category:

Laptop  
Desktop  
Server  
Networking  
Storage  
CCTV  
Printer

Use relational associations.

Do not store comma-separated brand/category strings.

---

# 8. Supplier List UI

Create a compact enterprise-style supplier table.

Suggested columns:

- Supplier
- Type
- Brands
- Categories
- Location
- Payment Terms
- Last Evidence
- Status

Support:

- search
- status filtering
- brand filtering
- category filtering
- supplier type filtering where practical

Prefer tables over oversized cards.

---

# 9. Supplier Detail UI

Suggested structure:

```text
Supplier Name
Supplier Type · Location

Overview | Contacts | Broadcasts | Products | Prices / Stock | Activity
```

Only implement tabs backed by actual functionality.

Do not create empty fake modules merely to match future architecture.

---

# 10. Product Foundation

Implement enough product functionality to support procurement intelligence.

Support:

- Brand
- Category
- Product Family
- Model
- Part Number
- Manufacturer SKU where appropriate
- Description
- Product Aliases
- Active/inactive status

Do not attempt to model every technical specification in this milestone.

Keep the product structure extensible for future category-specific attributes.

---

# 11. Product Aliases

A product may have multiple supplier/customer naming variations.

Example:

Canonical Product:

`Lenovo V15 G4 IRU`

Aliases:

`V15 G4`

`V15 IRU`

`V15G4`

`83A100SUAK`

Aliases must support future matching.

Do not duplicate products unnecessarily because suppliers write names differently.

---

# 12. Supplier Broadcasts

Build a manual supplier-broadcast ingestion workflow.

A user should be able to:

1. open Broadcasts
2. create a new broadcast
3. select a supplier
4. optionally select a supplier contact
5. paste the original supplier text
6. save the original broadcast
7. create/extract one or more broadcast items
8. review them
9. correct them
10. link each item to a product
11. confirm the item
12. create price/stock observations

---

# 13. Preserve Raw Evidence

The original supplier broadcast must never be destroyed when structured data is created.

Store:

- raw broadcast text
- supplier
- supplier contact
- source
- received/observed timestamp
- created by
- processing/review status

Structured extraction is derived from this source.

The raw message remains available later through an Evidence view.

---

# 14. Broadcast Items

One broadcast may contain multiple product items.

Each item should be able to contain:

- extracted description
- detected brand
- detected model
- part number if available
- quantity if available
- price if available
- currency
- VAT inclusion/exclusion if known
- stock status
- extracted specification text
- linked product
- match status
- review status
- user corrections

Missing information must remain null/unknown.

---

# 15. Broadcast Parsing

Do not build a complex AI pipeline now.

For this milestone:

- preserve raw text
- support manual item entry
- support simple deterministic parsing where practical
- create a clean parser interface for future expansion
- allow manual corrections
- allow manual product matching
- support multiple products in one broadcast

Do not block completion because parsing is imperfect.

An LLM may be introduced later as an optional extraction aid.

It must never become the source of truth.

---

# 16. Broadcast Review Workflow

The review UI should make it easy to compare:

```text
RAW BROADCAST              EXTRACTED ITEM

Dell 5440                  Dell Latitude 5440
i7 16/512                  i7 · 16GB · 512GB
25pc                       Qty: 25
2450+                      AED 2,450
```

Actions:

- Confirm
- Edit
- Link Product
- Create Product
- Ignore Item

Review should require minimal clicks.

Do not hide the source message from the reviewer.

---

# 17. Product Matching

During this milestone, product matching can use:

1. exact part number
2. exact normalized model
3. known alias
4. manual selection

Do not build complex semantic or LLM matching yet.

The architecture should allow future matching logic to be added later.

---

# 18. Temporary / New Products

If the broadcast contains a valid product that does not exist yet, users must be able to create a new product without leaving the workflow.

Future product normalization can improve these records later.

Do not block procurement entry because master data is incomplete.

---

# 19. Price Observations

Never store a permanent product price.

Create time-aware price observations.

Each observation should include:

- product
- supplier
- supplier contact where relevant
- price
- currency
- VAT state if known
- observed timestamp
- source/evidence
- source broadcast item
- created by

Historical price observations must remain preserved.

Do not overwrite old prices.

---

# 20. Stock Observations

Never store permanent supplier stock directly on the product.

Each stock observation should contain:

- product
- supplier
- quantity when known
- stock status
- observed timestamp
- source/evidence
- source broadcast item

Possible statuses:

- In Stock
- Limited
- Available
- Incoming
- On Request
- Out of Stock
- Unknown

Quantity may remain unknown.

---

# 21. Freshness

Observation age must be visible in procurement views.

Examples:

`12 min ago`

`3 hours ago`

`Yesterday`

`18 days ago`

Older observations should remain visible but clearly look stale compared with recent evidence.

Do not silently hide history.

---

# 22. Product Procurement Search

Create a usable product search.

Search should support at least:

- product name
- model
- part number
- alias
- brand

Product result/detail should show:

- product identity
- aliases
- suppliers with observations
- latest price per supplier
- latest stock per supplier
- observation age
- evidence link

Example:

```text
Lenovo V15 G4 IRU
83A100SUAK

SUPPLIER INTELLIGENCE

Supplier          Price        Stock       Observed
ABC Computers     AED 1,450    Ready       2h ago
XYZ Trading       AED 1,475    30 pcs      1d ago
```

---

# 23. Evidence View

Users must be able to open the source behind an observation.

Evidence should show at minimum:

- supplier
- contact if known
- original raw broadcast
- timestamp
- broadcast item
- extracted values
- corrected values where applicable
- linked product

This is essential to the evidence-first design.

---

# 24. Audit Foundation

Create a lightweight audit mechanism for important actions.

Initially audit at least:

- supplier creation/update
- contact creation/update
- product creation/update
- broadcast creation
- broadcast confirmation
- product linking
- price observation creation
- stock observation creation

Store:

- actor
- action
- entity type
- entity ID
- timestamp

Detailed before/after snapshots can be expanded later.

---

# 25. UI Requirements

Follow:

`docs/design/UI_SYSTEM.md`

The interface should feel:

- premium
- thin
- compact
- enterprise
- professional
- information-dense

Prefer:

- compact tables
- drawers
- side panels
- tabs
- filter bars
- searchable selects
- contextual actions
- meaningful badges

Avoid:

- oversized cards
- giant typography
- unnecessary gradients
- excessive rounded corners
- unnecessary animations
- decorative dashboards
- emoji icons

---

# 26. Navigation for Current Milestone

Primary navigation should approximately contain:

```text
ZERONIX
INTELLIGENCE

Overview

PROCUREMENT
Suppliers
Broadcasts
Products

ADMIN
Audit
Settings
```

Do not create fake pages for:

- Enquiries
- Agents
- Second Brain
- RFQs
- Quotations

until those modules enter the active plan.

---

# 27. Out of Scope

The following must NOT be implemented during this milestone unless CURRENT.md is explicitly updated later.

## Enquiry Intelligence

- email ingestion
- manual enquiry module
- website enquiries
- WhatsApp enquiries
- enquiry classification
- enquiry scoring

## AI Platform

- agent builder
- multi-agent orchestration
- agent memory
- agent skills
- LLM provider settings
- autonomous tool execution

## Second Brain

- pgvector
- embeddings
- semantic search
- episodic memory
- procedural memory
- context builder

## Procurement Expansion

- sourcing sessions
- supplier RFQ generation
- supplier responses
- procurement decision comparison
- purchase workflows

## Commercial

- quotations
- quotation revisions
- margins
- invoices
- customer follow-up

## Integrations

- WhatsApp API
- email APIs
- Gmail
- Microsoft Graph
- external supplier portals
- ERP integrations
- Zoho
- HubSpot

## Infrastructure

- Redis
- Kubernetes
- microservices
- event bus
- dedicated vector database
- cloud deployment automation
- complicated observability stack

Good ideas outside current scope should be added to:

`docs/ideas/BACKLOG.md`

Do not implement them.

---

# 28. Database Guidance

Implement only schema required by this milestone.

Likely entities include:

```text
User

Supplier
SupplierContact

Brand
Category
SupplierBrand
SupplierCategory

Product
ProductAlias

Broadcast
BroadcastItem

PriceObservation
StockObservation

EvidenceSource

AuditLog
```

Names and relationships may be adjusted where a cleaner model is justified.

Before migrations, verify:

- cardinality
- foreign keys
- uniqueness
- indexing
- timestamps
- historical preservation
- deletion behavior
- provenance
- nullability

Avoid speculative tables.

---

# 29. Deletion Strategy

Business evidence should generally not be destructively deleted.

Prefer:

- active/inactive
- archive state
- soft-delete where justified

Especially protect:

- broadcasts
- price observations
- stock observations
- evidence
- audit history

Administrative cleanup behavior can be expanded later.

---

# 30. Seed Data

Provide small development seed data where useful.

Examples:

Brands:

- Dell
- HP
- Lenovo
- HPE
- Cisco
- Ubiquiti

Categories:

- Laptop
- Desktop
- Workstation
- Server
- Networking
- Storage
- Printer
- CCTV

Keep seed data minimal and clearly development-only.

---

# 31. Validation

Use schema validation for business forms and service inputs.

Important validation includes:

- valid supplier names
- valid emails when supplied
- valid URLs when supplied
- non-negative quantity
- non-negative price
- valid currency
- valid product relationships
- required evidence references where needed

Do not over-constrain optional information.

---

# 32. Permissions

A sophisticated role system is not required yet.

However, architecture should not assume all future users will have full access.

Avoid tightly coupling UI components directly to unrestricted database actions.

Keep service boundaries ready for future authorization rules.

---

# 33. Code Structure

Keep module responsibilities clear.

A suggested direction:

```text
src/
  app/

  modules/
    suppliers/
    products/
    broadcasts/
    observations/
    evidence/
    audit/

  components/
    application/
    data-table/
    forms/
    ui/

  core/
    database/
    validation/
    permissions/

  lib/

prisma/
```

Adapt to existing repository architecture where appropriate.

Do not reorganize working code unnecessarily just to match this example.

---

# 34. Business Logic Placement

Do not place important business rules entirely inside React components.

Keep significant operations inside appropriate application/service functions.

Examples:

- create supplier
- confirm broadcast item
- link product
- create price observation
- create stock observation
- fetch latest supplier observations

The UI should call business capabilities rather than directly containing all business rules.

---

# 35. Error Handling

Handle common failures clearly.

Examples:

- database unavailable
- duplicate product
- invalid part number
- supplier not found
- observation cannot be created
- invalid broadcast item
- failed product association

Do not silently swallow errors.

Show useful user-facing messages without exposing sensitive implementation details.

---

# 36. Empty States

Every major list should have intentional empty states.

Examples:

No suppliers yet.

No contacts for this supplier.

No broadcasts yet.

No supplier observations for this product.

Empty states should guide the next logical action.

Avoid decorative empty-state artwork unless genuinely useful.

---

# 37. Loading States

Use clean loading states.

Avoid excessive skeleton animation.

Tables and detail areas should remain visually stable while loading.

---

# 38. Performance

Do not prematurely optimize.

But avoid obvious problems such as:

- N+1 database calls
- loading complete historical datasets unnecessarily
- giant client-side data payloads
- filtering thousands of records entirely in the browser

Use server-side pagination/filtering where the structure reasonably supports it.

---

# 39. Testing During This Milestone

> **Updated 2026-09-20 (see §46): development-first.** Automated testing is deferred to a dedicated stabilization phase
> (`docs/plans/STABILIZATION.md`). During this milestone the required verification is: TypeScript and ESLint clean, migrations succeed,
> and **manual** verification of each feature and of the finished end-to-end workflow. The list below is the manual checklist. Do not write
> new automated tests now.

Testing must support development, not block completion.

Required minimum verification:

- application compiles
- TypeScript passes
- Prisma migrations succeed
- Docker PostgreSQL persists data
- supplier CRUD works
- broadcast persistence works
- product linking works
- price observation persistence works
- stock observation persistence works
- product search retrieves observations
- evidence can be reopened

Add targeted tests for critical business logic where useful.

Do not build a large test suite before the workflow itself is complete.

---

# 40. Definition of Done

The milestone is complete only when the following workflow works end-to-end:

1. Start local PostgreSQL through Docker.

2. Start the application.

3. Create a supplier.

4. Add at least one supplier contact.

5. Assign supplier brands/categories.

6. Create a supplier broadcast.

7. Paste a multi-line broadcast containing one or more products.

8. Preserve the raw message.

9. Create/extract broadcast items.

10. Review and correct an item.

11. Link the item to an existing product or create a product.

12. Confirm the broadcast item.

13. Create a price observation.

14. Create a stock observation.

15. Search for the product.

16. View suppliers offering the product.

17. View the latest price and stock observations.

18. See when the evidence was observed.

19. Open the original broadcast evidence.

20. Restart PostgreSQL/application and verify persisted data remains intact.

If this workflow is incomplete, the milestone is not complete.

---

# 41. Development Rules

During this milestone:

- inspect before modifying
- preserve working code
- plan non-trivial changes
- avoid unnecessary dependencies
- avoid giant files
- avoid premature abstractions
- do not implement backlog features
- do not silently expand scope
- do not fabricate data
- keep documentation aligned with implementation
- update this CURRENT.md only when scope genuinely changes

---

# 42. Priority Order

Implement in this order unless an existing repository structure requires a justified variation:

```text
1. Inspect repository
2. PostgreSQL Docker setup
3. Prisma configuration
4. Initial domain schema
5. Migration + development seed
6. Application shell
7. UI foundation
8. Supplier module
9. Supplier contacts
10. Brands/categories
11. Product foundation
12. Broadcast persistence
13. Broadcast item review
14. Product linking
15. Price observations
16. Stock observations
17. Product procurement search
18. Evidence view
19. Audit verification
20. End-to-end workflow verification
```

---

# 43. Next Milestone

Do not begin automatically.

Once this milestone is complete and reviewed, the likely next milestone is:

**Enquiry Intelligence MVP**

Expected future focus:

```text
Manual Enquiry
      +
Email Ingestion
      ↓
Deterministic Classification
      ↓
Enquiry Candidate
      ↓
Requirement Extraction
      ↓
Product Identification
      ↓
Search Existing Supplier Intelligence
```

That work requires a separate update to `CURRENT.md`.

---

# 44. Current Guiding Principle

For this milestone, always optimize toward:

**Supplier Evidence → Structured Product Intelligence → Searchable Procurement Knowledge**

Do not optimize toward:

**maximum number of features.**

The objective is to create the first reliable business-data foundation on which future Enquiry Intelligence, Second Brain and specialized Zeronix agents can safely operate.

---

# 45. Planning Clarifications (added 2026-09-20)

Decisions made while converting this plan into an implementation plan. They refine, and do not expand, the scope above.
Rationale for each lives in `docs/decisions/` and `docs/architecture/DATA_MODEL.md`.

1. **Navigation.** Future modules are absent (not disabled). **Settings** is Brands and Categories master data, which is needed
   to assign brands/categories to suppliers and contacts.
2. **Supplier detail tabs.** Overview, Contacts, Broadcasts, Prices / Stock (this also covers "Products"), Activity.
   There is no separate empty Products tab.
3. **Observation retraction.** Reopening a confirmed broadcast item *retracts* its price/stock observations. They are kept,
   shown struck-through in history and excluded from "latest". They are never deleted or overwritten. This is the only path for
   correcting a wrong confirmation while honouring "do not overwrite history".
4. **Seed data.** 6 brands, 8 categories and 1 development user only. No fabricated suppliers, products or prices.
   The end-to-end test creates its own clearly labelled `TEST` data in a separate test database.
5. **Time.** Timestamps are stored in UTC and displayed in `Asia/Dubai`. Freshness bands (one constant in `lib/freshness.ts`):
   under 24h fresh, under 7d recent, under 14d aging, 14d or more stale.
6. **Deferred observation/broadcast attributes** (see `docs/ideas/BACKLOG.md`): condition (new/refurbished), market
   (UAE/import), warranty, lead time, MOQ, broadcast file attachments, supplier account owner, credit limit/period as numbers.
7. **Authentication.** Not part of this milestone. A single `getCurrentActor()` seam returns the seeded development user.
   The dev server is bound to localhost. See ADR 0004.
8. **Local database.** A new isolated PostgreSQL container on `127.0.0.1:5442` (see ADR 0003). It is unrelated to any other
   local Postgres on the machine.
9. **Review checkpoint.** Work pauses after documentation and the schema proposal so the data model can be reviewed before the
   first migration.
10. **Development-first testing.** See §46.

---

# 46. Development-First Approach (added 2026-09-20)

**BUILD FIRST -> STABILIZE -> COMPREHENSIVE TESTING -> PRODUCTION.**

Priority order during this phase: business functionality, correct architecture, database design, user experience, type safety, security,
performance, then automated testing.

- Do not create unit, integration or E2E tests, mocks, fixtures or test infrastructure for individual features, and do not stop
  development to write comprehensive tests unless explicitly requested.
- Keep TypeScript and ESLint clean, validate with zod, and enforce integrity with Prisma/PostgreSQL constraints. Skipping tests never
  justifies lower quality, weaker architecture, looser types, weaker security or weaker data integrity.
- Verify manually while building. When a major workflow is complete, do one basic manual end-to-end verification and move on.
- Keep code structured (pure logic, services taking `ctx`, thin actions) so tests can be added later without major refactoring.
- The tests that exist today (unit tests for pure helpers, and service integration tests) are retained, not extended.
- After the main modules are substantially complete, a dedicated stabilization and testing phase follows
  (`docs/plans/STABILIZATION.md`), before any production use.

---

# 47. Implementation Status (2026-09-20)

**The milestone workflow (§40, steps 3-19) is implemented and was verified once end to end in a real browser (15/15 steps).**
TypeScript, ESLint and `next build` are clean.

## Built
- Foundation: isolated PostgreSQL 17 (Docker, `127.0.0.1:5442`), Prisma 7 migration with DB-level guards (append-only evidence and audit, observations immutable except retraction, CHECKs, one-active-observation-per-item), idempotent reference seed, app shell, design system, audit foundation.
- Suppliers (list, filters, create/edit, detail with Overview / Contacts / Broadcasts / Prices-Stock / Activity), contacts with brands and categories, Settings master data (brands, categories).
- Products (master, aliases, layered matching, word-by-word search), product detail with **Supplier Intelligence** (latest price and stock per supplier, freshness, evidence) and full history including retracted rows.
- Broadcasts: paste, immutable evidence, deterministic parser proposals, split review workspace (raw pane with highlighted source lines, inline editor, product linker, create-product drawer, confirm / ignore / reopen with retraction, add item, archive), j/k navigation, duplicate-paste warning.
- Evidence drawer (`?evidence=`), Overview (review queue + latest observations), Audit page.

## Database hardening (2026-09-20)
- Migration `observation_time_indexes` adds newest-first indexes on both observation tables (Overview "latest observations" measured about 300 ms -> about 13 ms at 600k observations). Other candidate indexes were measured and rejected (no gain); findings are in `docs/ideas/BACKLOG.md`.
- `npm run db:backup` / `db:restore` (`scripts/`): read-only, verified-readable backups with retention; restore only into a new database. Live-database recovery is a documented manual procedure (README, "Backups"). The backup was taken and read back once; a full restore into a database was deliberately not exercised (no scratch databases).

## Deliberate deviations from the original plan
- `AuditLog` has `scope_type` / `scope_id` (Activity tabs include child records). Observations, `extracted_data` and the extra CHECKs are guarded by DB triggers (`docs/architecture/DATA_MODEL.md` section 5).
- `extracted_data` (write-once) holds `{ parser, version, reasons, hints, fields }`, where `fields` is the parser's original values, so the evidence view can show original vs corrected.
- "Confirm N ready items" (bulk confirm) was **not** built; it was an optional stretch (see BACKLOG).

## Verified manually vs not verified
- Verified in a browser: suppliers, contacts, master data, products, aliases, search; the full broadcast workflow including reopen and retraction, evidence drawer, history, supplier Prices/Stock, Overview and Audit.
- **Not verified yet** (to be covered in stabilization): the duplicate-paste warning, broadcast archive/restore, `j`/`k` and Ctrl+Enter shortcuts, "Use existing product" recovery, the parser on anything other than one sample message (it needs real, redacted broadcasts), the Audit date filters, pagination beyond one page for broadcasts/audit, and persistence across an application restart with real data.

## Known limitations
- No authentication (ADR 0004): do not expose the dev server or database to a network.
- Parser is deterministic and deliberately imperfect: it proposes, a person confirms; missing lines can be added by hand.
