# Current Development Plan

## Project

**Zeronix Intelligence**

## Active Milestone

**Customer Quotation** (roadmap Phase 9, smallest useful slice). The AI Intelligence plan is paused: `docs/plans/paused/2026-09-21-ai-intelligence-core.md`.

## Status

**Built 2026-09-21, in two parts.** (1) The quotation made from an enquiry. (2) At the user's request, a manual quotation and **quick supplier confirmation** (see the last section). Agreed with the user: a markup % per line with an editable price, and a print-ready page saved as a PDF from the browser that shows prices only, never suppliers or costs.

**Verified 2026-09-21** on the project database: typecheck, ESLint and `next build` clean, the 142 existing tests pass, `prisma migrate status` up to date. Database guards (22 checks) and the services (22 checks for the enquiry quotation, 23 for the manual quotation and confirmation) were each run inside a rolled-back transaction. In a real browser (Chrome via Playwright, a temporary TEST staff login, since deactivated): the list and the empty state, New quotation, Add line from a supplier confirmation with a new product and with an existing one (evidence, product, price and stock created; visible in the evidence drawer and Search), markup and price following each other live and after a reload, the inline validation errors, Issue, the customer copy (no supplier, cost, markup, margin or note in its text or HTML), the list showing the quotation as Manual and Issued. The first browser pass of the enquiry-made quotation (create, issue while incomplete, revise, superseded view) was **not** run, because someone had already created a real draft on ENQ-00005 and it was left untouched; those paths are covered by the rolled-back service checks and remain unverified in a browser (see `docs/plans/STABILIZATION.md`).

`TEST` records left in the project database, safe to archive: quotation `QUO-20260921-0002` (TEST Walk-in Customer, issued) with product `TEST Quick Laptop 14` (`TESTQ-BROWSER-1`), two direct-confirmation broadcasts from `TEST Supplier A` and `TEST Supplier B`, and the user `TEST Quotation Check` (deactivated). Some quotation numbers were used up by the rolled-back checks, so numbering does not start at 1.

Earlier milestones are archived in `docs/plans/completed/`: Supplier & Broadcast Intelligence MVP, Enquiry Intelligence MVP, Procurement Search, Sourcing Requests, Compare and Choose Supplier, Sign-in and Roles. Their rules stay in force.

## Side addition (2026-09-22): broadcast bulk confirm

Independent of the Quotation milestone above, approved and built the same day: **"Confirm N ready items"** on the broadcast
review screen (`/broadcasts/[id]`) — confirms every PENDING item already linked to an active product in one click, instead of
reviewing each one individually. Alongside it, a rule applied to both the single-item and bulk confirm paths: an item with no
price/currency or no price/stock now confirms with sensible defaults (currency → AED, stock → AVAILABLE) instead of being
blocked, since this business runs on a single currency and treats being listed by a supplier as evidence of availability.
Additive only, no migration. See `docs/modules/BROADCASTS.md`.

## Side addition (2026-09-23): broadcast category, warranty, and a bulk review table

Independent of the Quotation milestone, built from real broadcast data now in the project database: category (resolved
against the live Category list, including a new "Monitor" category) and warranty (duration + type: Carry-in, On-site, Next
business day, Return-to-base) are now parsed from broadcast text (parser v4) and recorded through to `PriceObservation` at
confirm. A new **Table** view on the broadcast page lets a reviewer bulk-correct every PENDING item's fields before
continuing into the existing per-item product-linking and Confirm flow. The Add Broadcast form gained an optional Category
hint, applied only to items the parser could not classify. One additive migration; see `docs/modules/BROADCASTS.md` and
`docs/architecture/DATA_MODEL.md` section 17. Spec: `docs/superpowers/specs/2026-09-23-broadcast-category-warranty-review-design.md`.

## Purpose

After the buyer has chosen a supplier for each requirement, turn the enquiry into a price the customer can be given.

```text
Enquiry (confirmed requirements, chosen suppliers)
      ↓  Create quotation
Draft quotation: one line per confirmed requirement
   cost = the chosen supplier's price (a pointer to the observation, never typed in)
   markup % and unit price: change either one, the other follows
      ↓  Issue   (checks it is complete, then freezes it)
Issued quotation → Print / Save as PDF (customer sees description, quantity, price, totals. Never suppliers or costs)
      ↓  Revise  (only when an issued quotation must change)
New draft revision; the issued one stays exactly as the customer saw it
```

## Decisions (2026-09-21)

1. **Cost is an observation, not a typed number.** A line points at the supplier price observation it costs from (by default the price of the active choice for that requirement). Observations are immutable, so cost cannot drift. A line with no chosen supplier has an unknown cost; its price is typed by hand. "Refresh cost" re-reads the current choice on a draft line.
2. **Markup and price follow each other.** The person edits one of them and says which; the **service** computes the other (pure functions in `pricing.ts`). The browser shows the same result live but is never trusted. Markup needs a known cost in the quotation's currency; with another currency or no cost, only the price can be typed. **No currency conversion.**
3. **One currency per quotation** (default AED, changeable while draft). **VAT %** is per quotation (default 5, changeable; 0 allowed). Prices are shown excluding VAT, then VAT, then the total.
4. **Draft, Issued, Superseded.** A draft is editable. **Issue** needs: customer name, valid-until date (not in the past), at least one line, every line with a quantity and a price. Issued means frozen: the database refuses any later change to the quotation or its lines (trigger). **Revise** turns an issued quotation into a new draft revision (same number, revision + 1) and marks the issued one Superseded. One draft per enquiry at a time. Quotations are never deleted.
5. **Snapshot, not link, for what the customer reads.** The line text, quantity, price, customer name and contact name are copied onto the quotation, so editing the enquiry later cannot change an issued document. The links (enquiry, requirement, customer) are kept for navigation.
6. **Customer-safe by construction.** The print page reads through one query, `getQuotationForPrint`, whose select names only customer-visible columns. Supplier, cost, markup and margin are not selected there, so they cannot be rendered by mistake.
7. **PDF = the browser's Save as PDF.** A print page with A4 print CSS and a **Print / Save as PDF** button. No PDF library, no server rendering, no new dependency.
8. **Company details** (name, address, phone, email, TRN) come from `src/config/company.ts`. Only the name is filled in; the rest stay empty and are not printed until the user provides them. Nothing is invented.
9. **Nothing else changes automatically.** Issuing does not change the enquiry status or send anything.
10. **Costs and margin are visible to both roles today.** A later capability map (paused AI plan) is the seam for hiding them.
11. Development-first testing still applies (`CLAUDE.md`): typecheck, lint, manual verification on the project database with `TEST` data, no new test suites. The pricing and totals maths are pure functions, ready for tests in the stabilization phase.

## Data (one additive migration, not destructive)

`Quotation` (`quotations`)

| Column | Notes |
|---|---|
| `number` (serial), `revision` | Reference `QUO-00012` (+ `rev 2`). Unique together. A revision reuses the number. |
| `enquiry_id` | Restrict. |
| `customer_id` | Optional, Restrict. Navigation only. |
| `customer_name`, `contact_name` | Text snapshots, editable while draft. NULL = unknown (issuing needs the customer name). |
| `status` | `DRAFT`, `ISSUED`, `SUPERSEDED`. |
| `currency_code`, `vat_percent` | Default `AED`, `5.00`. |
| `valid_until` | Date, optional while draft, required to issue. |
| `payment_terms`, `delivery_terms`, `notes` | Optional free text the customer sees. |
| `issued_at`, `issued_by_id`, `superseded_at` | Set by Issue and Revise. |
| `created_by_id`, `created_at`, `updated_at` | |

`QuotationLine` (`quotation_lines`)

| Column | Notes |
|---|---|
| `quotation_id`, `position` | Restrict. Unique together. |
| `enquiry_item_id` | Optional, Restrict. Where the line came from (NULL for a line typed by hand, e.g. delivery). |
| `description`, `part_number` | Customer-facing text (copied). |
| `quantity` | Optional while draft, `> 0` when set. |
| `unit_price` | Optional while draft, `>= 0`. |
| `markup_percent` | Optional. Set only when the cost is known and in the quotation's currency. |
| `cost_price_observation_id` | Optional, Restrict. Internal. Cost, supplier and VAT state are read through it. |

Database guards (hand-written in the migration): CHECKs (quantity, price, status and date pairs); a partial unique index (one `DRAFT` per enquiry); a trigger on `quotations` (no delete; a draft may change; an issued quotation may only become superseded; a superseded one is frozen; `DRAFT → ISSUED` needs the customer name, valid-until, at least one line and a quantity and price on every line); a trigger on `quotation_lines` (any insert, update or delete needs the parent to be a draft).

## Behaviour

- **Create** (button in the enquiry header): needs an open enquiry and at least one confirmed requirement. One line per confirmed requirement, in order; customer and contact from the enquiry; cost from the active choice. If a draft already exists, the button opens it instead.
- **Quotation page** `/quotations/[id]`: header (reference, status, customer, link to the enquiry), details (editable while draft), lines table, totals, Activity. Line row: description, quantity, **cost** (amount, supplier, VAT state, age, evidence link), **markup %**, **unit price**, line total, margin. Internal columns are labelled as internal; the print page does not have them. Draft actions: add a line, remove a line, refresh cost, Issue. Issued actions: Print / Save as PDF, Revise.
- **Print page** `/quotations/[id]/print`: no sidebar, A4, company block, customer, reference, date, valid until, lines (description, part number, quantity, unit price, total), subtotal, VAT, total, terms and notes. A draft prints with "Draft" clearly on it.
- **List** `/quotations`: reference, customer, enquiry, status, lines, total, valid until, updated. Search and a status filter; `?enquiry=` narrows to one enquiry. Sidebar item **Quotations** in the Enquiries group.
- Audit (same transaction, scoped to the quotation): `quotation.created`, `updated`, `line_added`, `line_updated`, `line_removed`, `issued`, `revised`.

## Structure

```text
prisma/schema.prisma + migration                  Quotation, QuotationLine, QuotationStatus, back-relations, CHECKs, index, triggers
src/config/company.ts                             Company block for the printout (name only, for now)
src/modules/quotations/pricing.ts                 Pure: markup <-> price, line total, totals, margin (integer cents)
src/modules/quotations/schemas.ts                 zod inputs
src/modules/quotations/service.ts                 create, update details, add / update / remove line, refresh cost, issue, revise (ctx, transaction, audit)
src/modules/quotations/queries.ts                 list, get (internal), getQuotationForPrint (customer-safe), for one enquiry
src/modules/quotations/actions.ts                 Thin server actions
src/modules/quotations/components/                Quotations table, details form, line row editor, totals, create / issue / revise buttons, print button
src/app/(workspace)/quotations/page.tsx           List
src/app/(workspace)/quotations/[id]/page.tsx      Workspace
src/app/(print)/layout.tsx, .../print/page.tsx    Print page outside the app shell (still requires sign-in)
src/app/(workspace)/enquiries/[id]/page.tsx       Create / open quotation in the header
src/config/navigation.ts (+ test list)            Quotations item
src/modules/audit/                                Entity type, actions, labels
```

## Out of scope

Sending the quotation (email, WhatsApp), generating a PDF file on the server, bulk markup for all lines, currency conversion, discounts per line, sections, optional items, alternates, quotation templates, follow-up reminders, converting to an order or invoice, won / lost tracking on the quotation, margin visibility by role, changing the enquiry status automatically. Ideas go to `docs/ideas/BACKLOG.md`.

## Definition of Done

Verified by hand once, in a browser, on the project database. Anything created is labelled `TEST`; nothing is bulk-loaded.
1. From an enquiry with confirmed requirements and a chosen supplier, **Create quotation** makes a draft with one line per requirement and the chosen supplier's cost.
2. Typing a markup % sets the price; typing a price sets the markup %; a line with no known cost accepts a price only; a cost in another currency accepts a price only.
3. Totals (subtotal, VAT, total) are right, and the internal margin shows on the quotation page only.
4. **Issue** refuses an incomplete quotation with a clear message, and freezes a complete one; the database refuses a direct change to an issued quotation and its lines.
5. **Revise** creates revision 2 as a draft and marks revision 1 Superseded; revision 1 still reads exactly as issued.
6. The print page shows no supplier, cost, markup or margin (checked in the page text and the query's select), fits A4, and saves as a PDF from the browser.
7. The list, the sidebar item, the enquiry header link, the Activity timeline and the Audit page all show the quotation.
8. The migration is additive and applied with `prisma migrate` only. Typecheck, lint and `next build` are clean; existing tests still pass.

## Documentation to update as built

`docs/modules/QUOTATIONS.md` (new), `docs/architecture/DATA_MODEL.md`, `docs/design/SCREENS.md`, `docs/plans/ROADMAP.md`, `docs/ideas/BACKLOG.md`, `docs/plans/STABILIZATION.md`, `README.md` if it lists modules.

## Implementation order

1. Schema, migration, guards; check the guards in a rolled-back transaction.
2. `pricing.ts`, audit vocabulary, schemas, service, queries, actions; check the service in a rolled-back transaction.
3. Quotation page, list, sidebar item, enquiry header link.
4. Print page and layout.
5. Browser check (Chrome via Playwright, project database, `TEST` data), docs, final typecheck / lint / build.

## Manual quotation and quick supplier confirmation (approved and built 2026-09-21)

Asked for: quote without an enquiry, and add the product and the supplier's price to the system on the spot when a supplier confirms by call or message, with the confirmation shown as evidence and kept as a note.

**What it does.** **New quotation** on `/quotations` starts a draft with a saved customer or a typed name (no enquiry). **Add line** has two kinds: **From a supplier confirmation** and a typed line. A confirmation records, in one transaction: an immutable evidence record of kind **Direct confirmation** (channel Phone call, WhatsApp, Email, Manual entry or Other) whose text is a written record built from what was typed plus the required note; a broadcast for the supplier; the product (an existing one, or a new **temporary** one); one item confirmed by the person; and the price and stock observations. The line then costs from that price, with an optional markup that prices it at once. It works the same inside an enquiry quotation.

**Reuse, no new price rules.** It composes existing services (`createEvidence`, `createProduct`, `confirmItem`), so the price and stock appear on the product page, in Search and supplier intelligence and in the evidence drawer, and a mistake is retracted, not edited. Nothing is parsed or guessed. The typed note does not go through the message parser.

**Data (one additive migration, `20260921150000_manual_quotation_and_confirmation`).** `EvidenceKind` gains `SUPPLIER_CONFIRMATION`; `EvidenceChannel` gains `PHONE`; `quotations.enquiry_id` becomes optional (a manual quotation has none; the one-draft-per-enquiry index simply does not apply to it, and the line guard still refuses a requirement on a quotation with no enquiry).

**Decisions.** A new evidence kind rather than reusing the broadcast kind, so it reads as "Direct confirmation (typed in, with a note)" in the evidence drawer. A new product from a confirmation is temporary (curate it later). A price is required (this is for when a price is needed now); stock and VAT stay optional and unknown stays unknown. The confirmation time cannot be in the future.

**Code.** `src/modules/broadcasts/confirmation.schemas.ts` and `confirmation.service.ts` (`recordDirectConfirmation`); in `src/modules/quotations`: `createManualQuotation`, `addLineFromConfirmation`, the schemas and actions, and the components `new-quotation-form`, `confirmation-line-form`, `add-line-tabs`; labels for the new evidence kind and channel; the evidence drawer shows the kind.

**Not built.** Retracting a confirmation from the quotation screen (use the product or evidence page), choosing several existing products in one confirmation, and a stock-only confirmation. See `docs/ideas/BACKLOG.md`.


## Email quotations (approved and built 2026-09-21, stages A to C; stage D only in part)

Asked for: an Outgoing email option in Settings, a compose drawer (subject, body, to, cc, bcc) before sending, a pre-written body with terms, a signature that differs for each person, and tracking of what happens with a customer. Decisions: the PDF is made by **headless Chrome** printing the existing print page (one template); sending is over SMTP with `nodemailer`. Decision record: `docs/decisions/0008-outgoing-email-and-pdf.md`.

**Built.**
- **A. Real PDF.** `src/modules/quotations/pdf.ts` finds an installed Chrome, Chromium or Edge (or `PDF_BROWSER_PATH`) and prints `/quotations/[id]/print` through `playwright-core`, using a two-minute signed token (`core/security/render-token.ts`) instead of a session. **Download PDF** on an issued or superseded quotation now saves a real file (`/quotations/[id]/pdf`, `?inline=1` to view). The internal address never comes from the request's Host header.
- **B. Outgoing account.** Settings > Email accounts has **Incoming** and **Outgoing** tabs. Outgoing: add or edit the account (Hostinger's `smtp.hostinger.com`, 465, SSL/TLS pre-filled), **Same login as an incoming mailbox** (its encrypted password is copied on the server and never shown), From name and address, Reply-To, default Bcc, **Send test email**, and a status control. One account is active at a time. Password encrypted and write-only (ADR 0005). Each person's own **signature** is edited on the same tab, and in the compose drawer.
- **C. Compose and send.** **Send by email** on an issued quotation opens a drawer: From (read-only), To / Cc / Bcc as chips (the customer's contacts one click away, default Bcc pre-filled), a subject, a **pre-written message with "Terms in brief"** (currency and VAT, payment and delivery terms and validity from the quotation, plus the standard line in `src/config/quotation-email.ts`), the sender's own signature (editable, "Save as my signature"), and the PDF attached. Nothing is sent until **Send**. The email, its recipients, its text and the **exact PDF** are stored in `sent_emails` (immutable); a failed attempt is stored with a plain reason. The quotation page lists **Emails sent** with the attachment.
- **D (part).** Sending is audited on both the quotation and the customer (`quotation.emailed`, scope Customer), so it already shows on the customer's Activity tab. The full customer **Timeline** tab with notes and calls is **not built**.

**Data (migration `20260921190000_outgoing_email`, additive).** `smtp_accounts`, `sent_emails`, `users.email_signature`, enum `SentEmailStatus`; one active account (partial unique index); `sent_emails` cannot be updated or deleted (trigger) and its CHECKs tie a failure to a reason and an attachment to its bytes.

**Verified 2026-09-21.** Typecheck, ESLint, `next build` and the 142 existing tests clean. Database guards: 12 checks in a rolled-back transaction. A real PDF was made through headless Chrome (one page, A4) and the design was checked from a print-media screenshot. The render token was checked (valid only for its quotation, unexpired, untampered). The outgoing account was created from the existing `info@zeronix.ae` login, the SMTP sign-in check passed, and a **real sample** of `QUO-20260921-0002` (a TEST quotation) was sent to `ismail@zeronix.ae` with its PDF attached; the server accepted it (Message-ID recorded) and the record is in `sent_emails`. **Not verified in a browser:** the Outgoing tab, the compose drawer, recipient chips and the Emails sent section (no sign-in was available); they compile and build. Delivery into the inbox is for you to confirm.

**Left in the project database:** the outgoing account `Zeronix outgoing (info@zeronix.ae)` (sends as `Zeronix Technology LLC <info@zeronix.ae>`; change it on Settings > Email accounts > Outgoing), one `sent_emails` row and its audit rows.

**Not built.** The customer Timeline tab and notes and calls, moving the enquiry to Quoted when a quotation is emailed, HTML email, replies and threading, open and click tracking (deliberately left out), sending anything other than the quotation, retry and a queue. See `docs/ideas/BACKLOG.md`.
