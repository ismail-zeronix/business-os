# Current Development Plan

## Project

**Zeronix Intelligence**

## Active Milestone

**Procurement Search** (roadmap Phase 5, first slice)

## Status

Built 2026-09-20. Typecheck and ESLint are clean, `navigation.test.ts` passes, and `/search` was checked in a real browser (Chrome via Playwright from outside the repo, project database): sidebar link, an exact part-number hit with its label and the supplier row, a text query, a product with no observations, no-match and empty states, and the evidence drawer opening from a price. No console errors. `next build` was run on 2026-09-21 with the dev server stopped: clean, `/search` in the route list, typecheck and ESLint clean again, `navigation.test.ts` 3/3. **Every Definition of Done item is met; this milestone is complete** and will be archived to `docs/plans/completed/` when the next `CURRENT.md` is written.

Also done in the same session at the user's request: the Overview's on-canvas title and subtitle were removed, and `--color-canvas` is now white, so the layout background and the top navbar are white (`docs/design/UI_SYSTEM.md` updated).

Previous milestones are archived in `docs/plans/completed/`: Supplier & Broadcast Intelligence MVP, and Enquiry Intelligence MVP (built; the first real mailbox sync and tuning on real mail are still open, see the "Not verified yet" list in that file). Their rules, data model and screens stay in force.

## Purpose

One search box for the question a buyer asks all day: **who has this, at what price, and how fresh is that?**

```text
83A100SUAK   |   dell 5440   |   V15 G4
      ↓
Matched products, exact part-number / alias hits first
      ↓
Per product: identity, aliases, latest price and stock per supplier, freshness, evidence link
```

## Decisions (2026-09-20)

1. **Scope:** products plus supplier price and stock only. Broadcasts, previous enquiries and suppliers-by-brand as search sources are deferred (BACKLOG).
2. **Shape:** a dedicated `/search` page, **Search** at the top of the Procurement group. No global Ctrl+K, no shell change.
3. **Read-only.** No schema change, no migration, no audit entry, no new dependency.
4. **No cross-supplier "best price".** Currency and VAT state make prices non-comparable (`docs/modules/PRODUCTS.md`). Values are shown as stated.
5. Development-first testing still applies (`CLAUDE.md`): typecheck, lint, manual verification, no new test suites.

## Behaviour

- `/search?q=...` is server-rendered; the URL is the state. The box reuses the existing debounced `SearchInput` (`/` focuses it).
- **Matching** reuses existing rules. `findMatchCandidates` (part number, model, alias; brand-checked) gives the exact and probable hits, pinned first and labelled with the basis.
  The word-by-word product search (`searchProducts`) supplies the rest. Duplicates are removed. At most 20 products are shown, with the total and "refine the search" when there are more.
  Archived products are hidden.
- **Each product** is a compact block: name (link), part number, brand, category, Temporary badge, match label, alias chips, then the existing supplier-intelligence table
  (supplier, latest price with VAT badge, latest stock, freshness badge, evidence link that opens the existing evidence drawer via `?evidence=`).
- Unknown stays unknown: a product with no observations says so, and is not hidden.
- States: empty query = a short hint; no matches = "No products match" with a link to Products; the evidence drawer follows the existing pattern.

## Structure

```text
src/modules/observations/procurement-queries.ts   + getProductsIntelligence(productIds)  (batched; getProductIntelligence delegates to it)
src/modules/search/queries.ts                     searchProcurement(q)  -> { results, total, truncated }
src/modules/search/components/search-results.tsx  result blocks (reuses ProductIntelligenceTable)
src/app/(workspace)/search/page.tsx               the page
src/config/navigation.ts                          + Search item
```

## Out of scope

Broadcast and enquiry lines as sources, suppliers-by-brand, Ctrl+K, fuzzy or semantic matching, saved searches, filters, pagination beyond the 20-product cap. Ideas go to `docs/ideas/BACKLOG.md`.

## Definition of Done

Verified by hand once, in a browser, using the project database. Nothing is created; this is read-only.
1. **Search** appears under Procurement and opens `/search`.
2. An exact part number returns that product first with its basis label; a text query (brand + model) returns ranked matches.
3. A product with observations shows latest price, stock, freshness and an evidence link that opens the drawer; a product without observations says so.
4. No-match and empty-query states render.
5. Typecheck, lint and `next build` are clean. The existing tests still pass (`navigation.test.ts` gets its one list updated).

## Documentation to update as built

`docs/modules/PRODUCTS.md`, `docs/design/SCREENS.md` (the "no global search" line), `docs/plans/ROADMAP.md`, `docs/ideas/BACKLOG.md`.
