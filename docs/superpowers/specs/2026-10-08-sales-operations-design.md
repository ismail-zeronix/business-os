# Sales operations: ownership, invoicing & payments, UI polish, and KPIs

**Status:** Approved design, ready for planning.
**Author:** Claude, with Ismail, 2026-10-08.
**Module:** Extends `docs/modules/ENQUIRIES.md` (ownership) and the Customers/Quotations modules; adds a new `docs/modules/INVOICES.md` (the Invoices module already exists in code but was never documented — written as part of Phase 2 below). A scope change on top of the Stabilization milestone, same pattern already used for the structured-requirements work in `docs/plans/active/CURRENT.md`.

## 1. Why

Zeronix wants the Sales side run as a real operation: an admin assigns enquiries to sales reps, ownership of that enquiry's customer follows the rep, invoices can be edited before they go out and support real payment recording (multiple partial payments, a choice of payment type), a Payments screen sits under Sales, the Quotes/Invoices/Payments screens are raised to the clarity of a mature sales suite (Zoho was the reference point for *completeness*, not a visual template), and an admin can see each rep's KPIs across the whole procurement-to-cash pipeline.

Groundwork already exists, committed as `e6925b5` (done in a concurrent session on this same repo, per the project's "multiple sessions run at once" convention): `Customer.ownerId`/`createdById` with admin-only reassignment, `Invoice`/`InvoiceLine` with create-from-quotation/issue/cancel and a binary `markInvoicePaid`, a reorganized nav (`Procurement` vs `Sales` groups, `Invoices` added), and a "Convert to invoice" button on the quotation page. This plan extends that work rather than redoing it.

## 2. Decisions confirmed with the user

1. Roles stay `ADMIN`/`STAFF` — no new role, decision `0006-sign-in-and-roles.md` stands. "Sales team" means per-record ownership, not a permission tier.
2. Enquiry assignment becomes an **admin-only** action (mirroring `Customer`), but stays **attribution-only**: it never restricts who can see or work an enquiry. Procurement staff still need full visibility to source/match products for any enquiry regardless of who owns the sales relationship — this matches how `Customer.ownerId` was already scoped (procurement-side reads are never restricted by it).
3. Assigning an enquiry's owner auto-syncs the linked `Customer`'s owner, but **only when the customer is currently unowned** — an admin reassigning one enquiry must never silently take a customer away from the rep who already owns them.
4. Invoices support **multiple partial payments** (e.g. deposit now, balance later), not a single binary "paid" flag.
5. Payment methods: **Cash, Bank transfer, Cheque**, plus an **Other** catch-all — the last one is Claude's addition (not explicitly requested), flagged here because it's a scope decision: without it, an unusual payment (e.g. an online gateway) would have no way to be recorded at all.
6. An invoice is editable only while **DRAFT**. Once **ISSUED** it freezes exactly like a quotation revision; a mistake is corrected by cancelling (reason required, already built) and invoicing a fresh quotation revision — not by adding an invoice-level revision mechanism. This matches "never overwrite history, retract instead."
7. The UI pass raises the existing screens to this app's own design system (`docs/design/UI_SYSTEM.md`) — not a Zoho skin.
8. The KPI dashboard is **admin-only** for now, covering pipeline volume, conversion rate, revenue, and collections, per rep, with a date-range filter. A rep-facing "my KPIs" self-view is deferred (section 8).

## 3. Already built (committed in `e6925b5`, not part of this plan)

- Schema: `Customer.ownerId`/`createdById`, `Invoice`/`InvoiceLine`, `EmailMessage.assignedToId` (advisory-only, email triage).
- Services: `reassignCustomerOwner` (admin-only), `createInvoiceFromQuotation`, `issueInvoice`, `markInvoicePaid` (binary), `cancelInvoice`.
- UI: `CustomerOwnerControl`, the `Sales` nav group (Customers/Quotations/Invoices), `ConvertToInvoiceButton`, invoices list/detail pages, an "Assigned to me" filter on email triage.
- `Enquiry.assignedToId` already exists in the schema, but today it is edited through the general `updateEnquiryHeader` action/form (`enquiry-header-form.tsx`) — open to **any** STAFF member, no admin gate, and treated as a plain label.
- Nothing documents the Invoices module yet (`docs/modules/INVOICES.md` does not exist) — a pre-existing gap, picked up in Phase 2.

## 4. Phase 1 — Ownership & assignment

### 4.1 Enquiry owner becomes an admin-only action

- Remove `assignedToId` from `enquiryHeaderSchema` and from the general header edit form — it stops being something any STAFF member edits alongside priority/blocker/notes.
- New `reassignEnquiryOwner(ctx, { id, assignedToId })` in `enquiries/service.ts`, gated by `assertAdmin(ctx)`, same shape as `reassignCustomerOwner`: validates the target user is `ACTIVE`, audits `enquiry.owner_changed` with `{ owner: { from, to } }`.
- New `enquiryOwnerSchema` (same empty-string-means-null preprocessing as `customerOwnerSchema`).
- New `EnquiryOwnerControl` component (mirrors `CustomerOwnerControl`) on the enquiry detail header, next to the existing read-only "Owner" display (`header-panel.tsx`/`enquiry-peek.tsx` keep rendering it read-only for everyone — only admins additionally get the control).

### 4.2 Auto-sync to the linked customer

Inside `reassignEnquiryOwner`'s transaction, after updating the enquiry: if it has a `customerId`, load that customer's `ownerId`. If `NULL`, set it to the same `assignedToId` and audit `customer.owner_changed` with `{ owner: { from: null, to: name }, via: "enquiry" }`. If the customer already has a *different* owner, leave it alone.

### 4.3 "Assigned to me" filtering on the main Enquiries list

Add the same `assignee` filter pill (`all` / `mine` / `unassigned`) already built for email triage to the main `EnquiryList` section of `/enquiries` (`parseEnquiryFilters`/`listEnquiries` gain an `assignee` param). A filter only — consistent with 4.1, it never hides rows from anyone who doesn't use it.

### 4.4 Verification

Manual, project database, `TEST`-labeled: admin reassigns a `TEST` enquiry to a `TEST` STAFF user; confirm the audit row; confirm a non-admin can no longer submit a changed `assignedToId` (field removed from their form) and that calling the new action directly as non-admin is refused; confirm the linked customer's `ownerId` follows when it was `NULL` and is left alone when it already had a different owner.

## 5. Phase 2 — Invoice completeness: edit + payments

### 5.1 Schema (one additive migration)

- `InvoiceStatus` gains `PARTIALLY_PAID` (between `ISSUED` and `PAID`).
- New enum `PaymentMethod { CASH BANK_TRANSFER CHEQUE OTHER }`.
- New `Payment` model: `id`, `invoiceId` (FK, Restrict), `amount` (Decimal 14,2, CHECK `> 0`), `method` (`PaymentMethod`), `reference` (`String?`, e.g. cheque/transfer number), `paidOn` (`Date` — when the money was actually received), `notes` (`String?`), `recordedById` (User, Restrict), `createdAt`. Retraction columns `retractedAt`/`retractedById`/`retractedReason`, same shape as other observation-like tables in this codebase (e.g. `ProductAttribute`) — a wrong payment is retracted, never edited or deleted. Index on `invoiceId`.
- Guard: CHECK that `retractedReason` is set whenever `retractedAt` is set, following the existing retraction-guard convention (`docs/architecture/DATA_MODEL.md` §5).

### 5.2 Service (`invoices/service.ts`)

- `recordPayment(ctx, { invoiceId, amount, method, reference?, paidOn, notes? })`: invoice must be `ISSUED` or `PARTIALLY_PAID` (plain-message refusal otherwise). Computes `remaining = invoiceTotal - sum(non-retracted payments)`; refuses `amount > remaining` (no overpayment). Creates the `Payment` row, recomputes total paid, sets status to `PARTIALLY_PAID` or `PAID` (and `paidAt` once fully paid). Audits `invoice.payment_recorded` with `{ amount, method, reference }`, scoped to the invoice.
- `retractPayment(ctx, { id, reason })`: `assertAdmin(ctx)` — a financial correction, same bar as cancelling an invoice. Marks the payment retracted, recomputes the paid total, and walks status back down (`PAID` → `PARTIALLY_PAID` → `ISSUED` as appropriate, clearing `paidAt` if no longer fully paid). Audited.
- `updateInvoiceDraft(ctx, { id, dueDate?, notes?, vatPercent?, lines })`: only while `status === "DRAFT"` (plain-message refusal otherwise). Replaces header fields and lines the same way `quotations/service.ts` edits a draft quotation — no cost/markup columns, since an invoice line never carries them. Audited with a diff.

### 5.3 Validation (`invoices/schemas.ts`)

`paymentRecordSchema`, `paymentRetractSchema`, `invoiceDraftUpdateSchema` (lines as an array, same shape as the quotation line schema).

### 5.4 UI

- Invoice detail page: **Edit** button when `DRAFT` (reuses the quotation `LinesTable`/`QuotationDetailsForm` pattern, adapted for invoices). **Record payment** popover/drawer when `ISSUED`/`PARTIALLY_PAID` (amount defaults to the remaining balance; method select; optional reference; `paidOn` date; optional notes). A **Payments** panel on the invoice lists recorded payments with a `retract` control (admin-only, following the existing `ConfirmAction` popover pattern).
- New nav item **Payments** under the `Sales` group → `/payments`: a list of all payments (date, invoice reference, customer, method, amount, reference, recorded by), filterable by method and date range, same visibility rule as `Invoice` (joined through the invoice's customer owner). Read-only list — retracting happens from the invoice detail page.

### 5.5 Verification

Manual, project database, `TEST`-labeled: record two partial payments on a `TEST` invoice (status moves `ISSUED` → `PARTIALLY_PAID` → `PAID`); confirm an over-amount payment is refused; retract one payment as admin and confirm status walks back and a non-admin is refused; edit a `TEST` `DRAFT` invoice's lines and confirm editing is refused once issued; confirm `/payments` shows the right rows scoped to visibility.

## 6. Phase 3 — UI pass on Quotes/Invoices/Payments

Scope: `quotations/page.tsx`, `quotations/[id]/page.tsx`, `invoices/page.tsx`, `invoices/[id]/page.tsx`, the new `payments/page.tsx` — visual/structural only, no new data or service logic beyond Phases 1–2.

Per `docs/design/UI_SYSTEM.md`: dense tables for lists (status badge, customer, amount, date, one-line actions); a clear totals/running-balance strip on detail pages; every status (including the two new ones — `PARTIALLY_PAID` and whatever pill a payment row gets) rendered through the existing `status-badges.tsx`; an activity/timeline panel reusing the existing Customer Activity-tab pattern; one obvious primary action top-right per state (Issue / Convert to invoice / Record payment / Edit). No new component primitives expected — reuses `SoftPill`/`Badge`/existing form components; flagged during planning if a screen genuinely needs something new.

## 7. Phase 4 — Sales KPI dashboard

New admin-only screen (exact route, e.g. `/reports/sales` vs. a tab under `Admin`, decided during planning) with a date-range filter (default: current month) and one row per owning STAFF member:

- **Pipeline:** enquiries assigned / open vs. closed in range (via `Enquiry.assignedToId`, Phase 1); quotations drafted/issued in range (via `Quotation.customerId` → `Customer.ownerId` — a quotation can exist without an enquiry, so attribution has to go through the customer, not the enquiry).
- **Conversion:** enquiry→quotation % and quotation→invoice %; average days enquiry-created→quotation-issued and quotation-issued→invoice-created.
- **Revenue:** invoiced total, paid total, average deal size (per issued invoice) in range — via `Invoice.customerId` → `Customer.ownerId`, the same attribution the existing `visibilityWhere` already uses.
- **Collections:** outstanding balance (issued/partially-paid invoices' remaining amount — not time-boxed to the range, since it's a current snapshot), overdue balance (past `dueDate`), average days-to-pay (issued→fully-paid) for invoices paid within the range.

All computed by read-only aggregate queries off Phase 1 (`Enquiry.assignedToId`, `Customer.ownerId`) and Phase 2 (`Invoice`, `Payment`) — no new schema. Verification: manual, against the project database's real data (a reporting screen has nothing to fabricate as `TEST`; cross-check two or three numbers by hand against a direct query instead).

## 8. Out of scope / explicitly deferred

- A formal `SALES` role or any new permission tier (decision 0006 stands).
- Enquiry-level visibility restriction — procurement keeps full visibility on every enquiry.
- A rep-facing "my KPIs" self-service view (admin-only for now).
- Commission calculation, invoice-level revision history, recurring invoices, multi-currency payment conversion, online payment gateways.
- Automated tests (CLAUDE.md's development-first phase) — manual verification against the project database only, as in every phase above.

## 9. Sequencing

Phase 1 → Phase 2 → Phase 3 → Phase 4, each committed and manually verified before the next starts — the same phase convention already used for the structured-requirements plan in `docs/plans/active/CURRENT.md`.
