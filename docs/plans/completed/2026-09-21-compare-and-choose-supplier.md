# Current Development Plan

## Project

**Zeronix Intelligence**

## Active Milestone

**Compare and Choose Supplier** (roadmap Phase 8, second slice: finishes the sourcing loop, kept deliberately small)

## Status

**Built and verified 2026-09-21.** Final typecheck and ESLint are clean, `next build` is clean (dev server stopped), the existing pure tests pass (8 files, 51 tests), and `prisma migrate status` says the database is up to date.

What was verified, against the project database with `TEST` data:
- **Database guards**, in a rolled-back transaction (13 checks): one active choice per requirement, the supplier must be on the enquiry, another supplier's or another product's observation is refused, only the retraction columns can change, no delete, the retraction CHECK.
- **Service logic**, also rolled back (15 checks): needs a confirmed requirement, supplier on the enquiry, No stock / Declined refused, another supplier's price or stock refused, a retracted price refused, choosing B replaces A in one step, a choice with nothing on record keeps price and stock empty, clear (and clearing twice is refused), an archived enquiry blocks both, audit rows scoped to the enquiry with the replaced supplier named.
- **In a real browser** (Chrome via Playwright, project database): one column per supplier and one row per confirmed requirement; prices and stock shown as stated (AED 2,399 and AED 2,450, both excl. VAT, with age); a requirement with no product says "Link a product to compare"; Choose with a note (toast, Chosen pill, who and when); choosing B moves the choice and the popover says it replaces the current one; after a newer B quote (AED 2,300) B's cell shows the new price and the chosen block still says "When chosen: AED 2,450", whose evidence link opens the original quote text; Clear; a No stock supplier says "cannot be chosen" and has no button; an archived enquiry shows the choice with no Choose or Clear; the Activity timeline shows chosen, cleared and "Replaced: TEST Supplier A" with the note. No console or network errors.

**Not verified yet** (also in `docs/plans/STABILIZATION.md`): many suppliers on one enquiry (wide table), a very long note, and the narrow-screen layout.

**Also done in the same session at the user's request (2026-09-21), outside this milestone's scope:**
- **Broadcast parser version 2**, fixing what the first real supplier messages showed (a Lenovo P16v G3 message and the Hesabi Computers WhatsApp desktop list): a price split off by a blank line is re-attached, title-plus-detail lines are one product, models no longer run on into spec text, resolutions / Wi-Fi standards / number-plus-unit are not part numbers, "AI-Ready" is not stock, Core Ultra shorthand and `I7- 12700` are specs, a trailing number after a part number is proposed as the price (low confidence, no currency), and `SUPPLIER :` / `CONTACT :` lines are not items. Checked with a before/after run over every saved message and the standard formats (18 messages, 29 items): only the intended changes. Rules in `docs/modules/BROADCASTS.md`. It affects only messages saved from now on.
- **@ mentions in the broadcast message box**: `@` after `SUPPLIER :` lists suppliers, narrowing per letter; after `CONTACT :` it lists that supplier's contacts; picking fills the text and sets the Supplier / Contact fields (`docs/design/SCREENS.md`). Checked in a real browser (20 checks, nothing saved); one bug found and fixed (Escape reopened the list). The shared `Combobox` gained an optional controlled `value`.
- **`SUPPLIER :` / `CONTACT :` lines are read automatically** in the broadcast form: the supplier (short or legal name) and then the contact are picked when exactly one record has that name; nothing is picked on no or several matches, with a note or warning saying why; a choice made by hand is never replaced; replies to a request keep their supplier. Checked with 17 rule checks and 19 browser checks (including the real First Option supplier by its legal name); nothing saved. Its browser check first hit a 500 on every page caused by an unrelated Overview refactor in progress (`src/modules/overview/`, not part of this work), which resolved by itself.
- The Lenovo P16v G3 (Workstation) was added under First Option General Trading through the normal review flow; its confirmed price is AED 14,900, VAT and stock unknown.
- `next build` was run afterwards with the dev server stopped (clean, every route listed), then typecheck and ESLint (clean), the existing pure tests (8 files, 51 tests) and `prisma migrate status` (up to date).

`TEST` records added for this check (safe to archive): on `ENQ-00005` a choice history for the Dell requirement (several retracted, one active on `TEST Supplier B`), a newer `TEST Supplier B` quote (AED 2,300, one broadcast), and `TEST Supplier C` (its request was added, marked No stock, reopened and removed). No scripts were added to the repository.

Previous milestones are archived in `docs/plans/completed/`: Supplier & Broadcast Intelligence MVP, Enquiry Intelligence MVP (built; the first real mailbox sync and tuning on real mail are still open), Procurement Search, and Sourcing Requests (built and verified 2026-09-21). Their rules, data model and screens stay in force.

## Purpose

After suppliers reply, the buyer needs to see the answers side by side and say "this one". The app must remember what was known when that choice was made.

```text
Enquiry > Sourcing tab
      ↓
Compare: one row per confirmed requirement, one column per supplier asked
         each cell = that supplier's latest price and stock, as stated, with age and evidence
      ↓
Choose supplier (per requirement, optional note)
      ↓
The choice is saved with the exact price and stock the buyer saw. Change it or clear it any time; nothing is overwritten.
```

## Decisions (2026-09-21)

1. **No ranking, no "best price".** Currency and VAT state make prices non-comparable (`docs/modules/PRODUCTS.md`). The table shows values as stated, with VAT state, age and an evidence link.
2. **Compare = the suppliers on this enquiry.** The values are the existing "latest price and stock per supplier" for the requirement's product (`getProductsIntelligence`); nothing new is stored for the comparison. A requirement with no linked product says "Link a product to compare".
3. **A choice is one small table**, `procurement_decisions`: requirement, supplier, the price and stock observation the buyer saw (pointers to the immutable observations, so the values cannot change), an optional note, who and when. **One active choice per requirement.** Choosing again replaces it; **Clear** withdraws it. Rows are never edited or deleted; a replaced or cleared choice is *retracted* and stays visible in the Activity timeline (same rule as observations).
4. **Free text for the rest** (warranty, credit, "200 units confirmed"): the note. Numeric terms and reliability history stay in the BACKLOG.
5. **No new page, no new sidebar item, no new dependency.** It is a section of the enquiry's Sourcing tab. The enquiry status is not changed automatically.
6. Development-first testing still applies (`CLAUDE.md`): typecheck, lint, manual verification, no new test suites.

## Data (one additive migration, not destructive)

`ProcurementDecision` (`procurement_decisions`)

| Column | Notes |
|---|---|
| `enquiry_item_id`, `supplier_id` | Restrict. The requirement and the chosen supplier. |
| `price_observation_id`, `stock_observation_id` | Optional, Restrict. What the buyer saw. NULL = none on record (unknown stays unknown). |
| `note` | Optional free text. |
| `decided_by_id`, `created_at` | Who and when. |
| `retracted_at`, `retracted_by_id`, `retraction_reason` | One-way retraction (CHECK: both or neither). |

Database guards (hand-written in the migration): a partial unique index (one **active** decision per requirement); a trigger that on INSERT checks the supplier was asked on that enquiry and that any observation belongs to that supplier and to the requirement's product, on UPDATE allows only the retraction columns to change, and refuses DELETE.

## Behaviour

- **Compare section** below the requests table on `/enquiries/[id]?view=sourcing`. Header: each supplier asked, with its request status. Row: each **confirmed** requirement (name, quantity). Cell: latest price (with VAT state, age, evidence link) and latest stock (badge, age, evidence link), exactly as on the product page. Nothing on record says so. A supplier marked **No stock** or **Declined** shows that, muted, and cannot be chosen.
- **Choose** (per cell): a small popover with an optional note and **Choose supplier**. The price and stock shown in the cell are what is saved. The chosen cell is highlighted with a **Chosen** pill, the note, who and when, and, if the supplier's latest price or stock has since changed, a line "When chosen: AED 2,399 excl VAT · 20 pcs" with evidence links. **Clear** withdraws the choice.
- Rules (service): the enquiry is not archived; the requirement is confirmed; the supplier was asked on this enquiry and is not No stock / Declined; any observation shown belongs to that supplier and product and is not retracted. Choosing a different supplier for the same requirement retracts the previous choice in the same transaction.
- Audit: `procurement_decision.chosen|cleared`, scoped to the enquiry, so they appear on its Activity timeline (a replacement is one `chosen` entry that names the supplier it replaced).

## Structure

```text
prisma/schema.prisma + migration                ProcurementDecision, back-relations, the unique index and trigger
src/modules/sourcing/decision.service.ts        chooseSupplier, clearChoice (ctx, zod, transaction, audit)
src/modules/sourcing/queries.ts                 + listDecisionsForEnquiry
src/modules/sourcing/schemas.ts, actions.ts     + choose / clear
src/modules/sourcing/components/compare-table.tsx, choose-button.tsx   server table, client popover and Clear
src/modules/sourcing/components/sourcing-tab.tsx   renders the compare section
src/modules/observations/components/offers.tsx  export PriceCell and StockCell (reused, unchanged)
src/app/(workspace)/enquiries/[id]/page.tsx     passes the evidence link builder to the tab
src/modules/audit/                              entity type and two actions
```

## Out of scope

Ranking or scoring suppliers, a "best price", currency conversion, comparing across enquiries, numeric credit / payment / warranty / lead-time comparison, supplier reliability, quotation and margins, a separate decisions page, choosing more than one supplier per requirement (split orders), moving the enquiry status automatically. Ideas go to `docs/ideas/BACKLOG.md`.

## Definition of Done

Verified by hand once, in a browser, using the project database. Anything created is labelled `TEST`; nothing is bulk-loaded.
1. The Sourcing tab shows a Compare section with one row per confirmed requirement and one column per supplier asked; prices and stock appear as stated with age and evidence links; a requirement with no product says so; a No stock / Declined supplier cannot be chosen.
2. **Choose** saves the choice with the price and stock shown; the cell shows **Chosen**, the note and who and when. Choosing another supplier replaces it; **Clear** withdraws it. If a newer price arrives later, the chosen cell still shows "When chosen: …".
3. An archived enquiry shows the comparison read-only (no Choose or Clear).
4. The Activity timeline shows the choices.
5. The migration is additive and applied with `prisma migrate` only. Typecheck, lint and `next build` are clean; existing tests still pass.

## Documentation to update as built

`docs/architecture/DATA_MODEL.md` (section 13), `docs/modules/ENQUIRIES.md`, `docs/design/SCREENS.md`, `docs/plans/ROADMAP.md`, `docs/ideas/BACKLOG.md`, `docs/plans/STABILIZATION.md`.

## Implementation order

1. Schema, migration, guards; check the guards in a rolled-back transaction.
2. Audit vocabulary; service, queries, schemas, actions; check the service in a rolled-back transaction.
3. Compare table, Choose and Clear, wired into the Sourcing tab.
4. Browser check (Chrome via Playwright, project database, `TEST` data), docs, final typecheck / lint / build.
