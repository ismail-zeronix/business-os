# Broadcast parsing: category, warranty, and a bulk review table

**Status:** Approved design, ready for planning.
**Author:** Claude, with Ismail, 2026-09-23.
**Module:** `docs/modules/BROADCASTS.md`. Extends the Broadcast & Supplier Intelligence work; does not touch Quotations.

## 1. Why

The database now holds real pasted supplier broadcasts (13 broadcasts, 214 items). Inspecting them directly (not guessed) shows two strong, previously-unhandled deterministic signals, plus a workflow gap:

- **Category.** Supplier lines are consistently prefixed with a category word: `LAP` (148×), `MONITOR` (17×), `SERVER` (16×), `WORKSTATION` (6×), and one multi-line block spells it inline (`Lenovo Desktop M70t G6`). The existing `categories` table (CCTV, Desktop, Laptop, Networking, Printer, Server, Storage, Workstation) has no `Monitor`, so all 17 monitor items are currently unclassifiable.
- **Warranty.** `1YR`/`3YR`/`1Yr`/`2YR`/`1 Year`/`3YEAR`/`3 Year`/`3 YRS` (159 occurrences total) and warranty type words `Carry-in` (6×), `Onsite` (1×), plus bare `Warranty` (3×). Today warranty is free text on `Supplier` only — nothing captures it per offer.
- **Review workflow.** Today's review is strictly one item at a time (expand a card, edit, Confirm/Save). There is a bulk "Confirm N ready items," but it only fires with whatever the parser already extracted — there is no way to bulk-correct obvious parser mistakes across many items before doing the careful per-item product-linking work.

## 2. Decisions (confirmed with the user)

1. Warranty type recognizes `CARRY_IN`, `ON_SITE`, `NBD`, `RETURN_TO_BASE` — broader than what's in the data today (only Carry-in/Onsite appear), because these are standard OEM support terms (Dell ProSupport, HP Care Pack, Lenovo) likely to appear in future messages, and adding them now avoids a later migration.
2. `Monitor` is added as a real category now, through the existing admin `createCategory` service — this is normal master data filling a real gap, not fabricated data.
3. The new review table's **Apply all** only saves corrected field values onto `BroadcastItem`s (same effect as today's per-item "Save"). It never confirms anything itself. The existing per-item product-linking and Confirm flow is unchanged and still required afterward.
4. The Add Broadcast form gets a new optional **Category** field alongside Supplier/Contact/Channel. It is a fallback hint applied only to items the parser could not classify from the text itself; it never overwrites a category the parser did find.

## 3. Data model (one additive migration)

No existing table, column, or constraint changes. Everything below is new.

### 3.1 New enum

```prisma
enum WarrantyType {
  CARRY_IN
  ON_SITE
  NBD
  RETURN_TO_BASE
}
```

No `UNKNOWN` member. Unlike `VatState`/`StockStatus` (which always apply and default to a meaningful `UNKNOWN`), warranty is frequently just absent from a line (an accessory sub-line, a server with no stated term). NULL already means "not stated"; a forced `UNKNOWN` member would be redundant state.

### 3.2 `BroadcastItem` gains

| Column | Type | Notes |
|---|---|---|
| `category_text` | `String?` | Free text, mirrors `brand_text`/`model_text`. What the parser read, or what the reviewer typed/corrected. Not a FK — resolved against the `Category` master list at product-creation time, exactly like `brandText` is resolved to `brandId` today (`normalizeName` match in `item-row.tsx`). |
| `warranty_months` | `Int?` | e.g. `12`, `36`. CHECK `warranty_months IS NULL OR warranty_months > 0`. |
| `warranty_type` | `WarrantyType?` | |

### 3.3 `PriceObservation` gains

| Column | Type | Notes |
|---|---|---|
| `warranty_months` | `Int?` | Copied from the item at confirm time, same pattern as price/currency/VAT. |
| `warranty_type` | `WarrantyType?` | |

Same CHECK as above. Warranty is a term of a specific priced offer, so it lives on `PriceObservation`, not `StockObservation` — a stock-only confirmation (no price) does not create a warranty record. This is a deliberate gap: if a future message states warranty with no price, the wording stays visible in the immutable raw evidence and in the item's `extracted_data`, but nothing structured is recorded. Documented, not hidden.

### 3.4 `Category`

No schema change. One new row, `Monitor`, added through `products/master-data.service.ts` `createCategory` (already admin-gated, audited, normalized-name-unique) — run once as a normal app action, not a migration-time seed and not raw SQL.

### 3.5 Guards

Add to the same migration (hand-written SQL, following the existing convention in `DATA_MODEL.md` §5):

```sql
ALTER TABLE broadcast_items
  ADD CONSTRAINT broadcast_items_warranty_months_positive CHECK (warranty_months IS NULL OR warranty_months > 0);
ALTER TABLE price_observations
  ADD CONSTRAINT price_observations_warranty_months_positive CHECK (warranty_months IS NULL OR warranty_months > 0);
```

No change to the write-once `extracted_data` guard, the observation immutability guard, or any existing trigger — these new columns follow the exact same lifecycle as the existing typed columns they sit beside (item: reviewer-editable while PENDING; observation: set once at confirm, never changed except by retraction, which leaves them as-is since retraction only touches the retraction columns).

## 4. Parser changes (deterministic, version 4)

Both new extractors follow the existing house style in `src/modules/broadcasts/parsing/extractors.ts`: pure functions, return a span + a human-readable `reason` string for `extracted_data.reasons`, never guess when ambiguous.

### 4.1 `findCategory(text, categories)`

1. **Leading-token check first.** If the item's text (or the first line of a multi-line block) starts with a recognized category word, that wins outright at high confidence — it is the supplier's own tag, stronger than any word appearing later in spec text. Recognized prefixes: `LAP` → Laptop, `MONITOR` → Monitor, `DESK`/`DESKTOP` → Desktop, `SERVER` → Server, `WORKSTATION` → Workstation. This resolves the real ambiguous case in the data: `LAP HP MOBILE WORKSTATION ZBook...` is filed as **Laptop** (the `LAP` prefix), even though "MOBILE WORKSTATION" appears later in the same line.
2. **Otherwise, scan the rest of the text once** with the same keyword set (plus a few synonyms: `NOTEBOOK` → Laptop, `DISPLAY`/`LCD`/`LED` alone is *not* used — too generic, seen in `MONITOR LED LENOVO...` where `MONITOR` already won at step 1). If more than one distinct category matches, leave `categoryText` NULL and record the ambiguity in `reasons` — never guess.
3. **Resolve against the live `Category` table** by `normalizedName`, same as `findBrand` resolves against the live `Brand` table. A keyword whose mapped category does not exist (e.g., if `Monitor` had not been added) simply does not propose anything — no fabrication, no auto-creation of categories from the parser.

### 4.2 `findWarranty(text)`

- **Duration:** `` /\b(\d{1,2})\s*-?\s*(?:YRS?|YEARS?)\b/i `` → `warrantyMonths = years * 12`. Covers `1YR`, `3YR`, `1Yr`, `2YR`, `1 Year`, `3YEAR`, `3 Year`, `3 YRS` (all seen in the real data) plus the obvious `1YEAR`/`3YEAR` the user called out.
- **Type**, checked in this order (first match wins):
  1. `/on[-\s]?site/i` → `ON_SITE`
  2. `/carry[-\s]?in/i` → `CARRY_IN`
  3. `/\brtb\b|return[-\s]?to[-\s]?base|\bdepot\b/i` → `RETURN_TO_BASE`
  4. `/\bnbd\b|next\s*business\s*day/i` → `NBD`
  This order means "Onsite NBD" (an on-site visit with a next-business-day SLA) is recorded as `ON_SITE` — the physical service type — with "NBD" staying visible in the raw evidence and spec text; a bare "NBD" with no on-site/carry-in wording elsewhere is recorded as `NBD`.
- A bare `Warranty` with no duration or recognized type extracts nothing (both columns stay NULL) — matches the existing "never guess" rule; the word itself stays in the spec text as written.

### 4.3 Version bump

New dated section in `docs/modules/BROADCASTS.md`, "Parser version 4 (2026-09-23), from the real broadcasts already in the database" — same format as v2/v3: what changed, checked against which specific saved messages, what stayed the same. Older confirmed items are never re-parsed; only new parses use v4 (matches the existing "only new parses use vN" rule).

## 5. Review workflow: the new Table stage

### 5.1 Where it lives

A third tab on the broadcast page, next to `Review` / `Activity`: `?view=table`. `getBroadcast`/the page already computes `counts.pending`; when a broadcast has freshly-parsed PENDING items (i.e., none yet touched by a save/confirm/ignore), the page defaults to `view=table` instead of `view=review`. Switching tabs is always available and never loses work — Apply all is a normal server action, not a client-only draft.

### 5.2 What it shows

One row per **PENDING** item only (confirmed/ignored items are already past this stage and stay out of the table, same as they're excluded from "ready" bulk-confirm today). Columns: Description, Category, Brand, Model, Part #, Spec, Qty, Price, Currency, VAT, Stock, Warranty (duration + type) — the same field set `ItemFieldsGrid` already edits per-item, laid out as dense inline-editable table cells (native inputs/selects, matching `docs/design/UI_SYSTEM.md`: compact, dense, no per-row modals).

### 5.3 Apply all

One server action, one transaction: validates every changed row with the same zod schema `saveItemAction` already uses per item, writes the corrected values onto each `BroadcastItem`, and one `broadcast_item.updated` audit row per changed item (same action name and shape already used for a single-item save — no new audit vocabulary). Rows with no changes are skipped. It does **not** create observations, link products, or change `review_status` — those still happen afterward in the existing per-item flow (product linking, Confirm, or "Confirm N ready items").

### 5.4 Reuse, not a parallel implementation

The table's field set, validation, and save action are the existing `ItemFieldsGrid` schema and `saveItemAction`, extended with `categoryText`, `warrantyMonths`, `warrantyType` — called once per changed row inside one transaction, not a new parsing or validation path.

## 6. Add Broadcast form: Category hint

One new optional field in `broadcast-form.tsx`, using the existing `categoryOptions` already threaded through the broadcast page (today only used by `ProductLinker`). It is passed to `createBroadcastAction` and, after parsing, applied as `categoryText` **only** to items where `findCategory` found nothing — a real per-item signal is never overwritten by the broadcast-level hint. Nothing new is stored on `Broadcast` itself.

## 7. Documentation to update as built

- `docs/modules/BROADCASTS.md`: "Parser version 4" section; a short "Warranty" subsection; the Table stage added to the Workflow diagram and prose.
- `docs/architecture/DATA_MODEL.md`: new `§17 Category and warranty on broadcast items (2026-09-23)`, same style as the existing dated sections (§11-§16).
- `docs/ai-intelligence/existing-system-audit.md` §10: update the `PriceObservation`/`StockObservation` "warranty type, warranty source, verification date" row to reflect that warranty type and duration are now built (warranty *source* and *verification date* remain out of scope — see §8).
- `docs/plans/active/CURRENT.md`: this becomes a new side-addition entry (like the 2026-09-22 bulk-confirm one), since the active milestone is Quotations and this is independent, additive work on Broadcasts.

## 8. Out of scope (this slice)

Warranty *source* (who stated it) and *verification date* (separate from `observed_at`) — the existing evidence/observed-at already answers "when was this stated," and the source is always the broadcast's supplier, so these would be redundant today. Category confidence scoring beyond the existing HIGH/MEDIUM/LOW scheme. Auto-creating new categories from parser output (Monitor is added by hand, once, via the admin service). Bulk product-linking from the table (the table only corrects fields; linking stays per-item, since picking the right product is explicitly the one judgment call that stays manual per the existing docs). Editing `WarrantyType` on `Supplier.warrantyNotes` or reconciling it with the new per-offer warranty (they remain two independent things: one is the supplier's general policy text, the other is what a specific broadcast stated about a specific offer).

## 9. Definition of done

1. Migration is additive, applied with `prisma migrate` only; typecheck, lint, `next build` clean; existing tests still pass.
2. `Monitor` category exists, created via the audited service, visible in Settings > Categories.
3. Parsing a broadcast containing `LAP ... 1YR`, `MONITOR ... 3YR`, `SERVER ... 3YR`, and the multi-line `Lenovo Desktop ... Carry-in` block correctly proposes category and warranty on each, checked against real saved broadcasts in the project database (not synthetic data).
4. The Table view lists all PENDING items editable inline; Apply all saves corrections in one transaction and leaves review_status untouched; the per-item flow afterward is unchanged.
5. The Add Broadcast form's Category hint fills only items the parser left uncategorized.
6. A confirmed item with warranty info shows warranty duration and type on its `PriceObservation`, visible in the evidence drawer.
7. Manual verification on the project database (existing broadcasts), `TEST`-labeled only if any new broadcast is created for the check; nothing bulk-loaded or overwritten.
