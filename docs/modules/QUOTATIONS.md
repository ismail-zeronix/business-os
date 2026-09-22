# Quotations module

Turns an enquiry into a price the customer can be given. Plan: `docs/plans/active/CURRENT.md`. Tables: `docs/architecture/DATA_MODEL.md` section 15. Screens: `docs/design/SCREENS.md`. Code: `src/modules/quotations/`.

## What it does

```text
Enquiry (confirmed requirements, chosen suppliers)
  -> Create quotation      one draft per enquiry, one line per confirmed requirement
  -> price each line       cost = the chosen supplier's price; change markup % or price, the other follows
  -> Issue                 checked for completeness, then frozen
  -> Download PDF          the customer's copy: prices only (opens the print dialog; choose Save as PDF)
  -> Revise                a new draft revision when an issued quotation has to change
```

Nothing is sent, and the enquiry's status is not changed by any of it.

## Manual quotation and quick supplier confirmation

A quotation does not need an enquiry. **New quotation** (on `/quotations`) starts one with a saved customer or a typed name. **Add line > From a supplier confirmation** is for when a supplier has just confirmed a price by phone or message: in one transaction it records **Direct confirmation** evidence (a written record of what was typed, plus the required note), a broadcast for the supplier, the product (existing, or a new temporary one), one confirmed item, and the price and stock observations, then adds the line costing from that price (an optional markup prices it at once). Because it reuses the normal evidence path, the product, price and stock show up in Products, Search, supplier intelligence and the evidence drawer, and a mistake is retracted, not edited. It also works inside an enquiry quotation. Code: `broadcasts/confirmation.schemas.ts`, `broadcasts/confirmation.service.ts`, and `createManualQuotation` / `addLineFromConfirmation` in `quotations/service.ts`. Several manual drafts may exist at once (the one-draft rule is per enquiry).

## Rules

- **Cost is an observation.** A line points at a supplier price observation (by default the price of the active choice for that requirement). It is never typed, so it cannot drift. No choice or no price means no cost on record (unknown stays unknown); the price is then typed.
- **Markup and price follow each other**, decided by the service from `basis` (the field the person changed) using `pricing.ts`. Markup needs a known cost **in the quotation's currency**; there is no currency conversion. A discount is a negative markup down to -100.
- **One currency per quotation** (AED by default) and one **VAT %** (5 by default, 0 allowed). Prices are entered excluding VAT; the subtotal, the VAT (rounded once, on the subtotal) and the total are shown.
- **Issue** needs: a customer name, a valid-until date that is not in the past, at least one line, and a quantity and a price on every line. The message lists everything still missing. The database enforces the same, so a direct write cannot issue an incomplete quotation.
- **Issued is frozen.** The database refuses any change to the quotation or its lines. **Revise** copies it to a new draft (`revision + 1`, same number) and marks the issued one **Superseded**, which stays exactly as it was issued. One draft per enquiry at a time.
- **What the customer reads is copied** onto the quotation (names, line text, quantity, price), so later edits to the enquiry or customer do not change it.
- **Customer-safe by construction.** The print page reads only `getQuotationForPrint`, whose select names customer-visible columns. Supplier, cost, markup and margin are not selected, so the page cannot print them.
- **Quotations are never deleted.** Draft lines can be removed (audited).
- An archived enquiry blocks every change to its quotations (a draft cannot be edited, nothing can be issued or revised) until the enquiry is restored.

## Structure

| File | Role |
|---|---|
| `pricing.ts` | Pure: markup to price and back, line total, totals, margin, `resolveLinePricing`. Integer cents. |
| `schemas.ts` | zod inputs. |
| `service.ts` | `createQuotation`, `createManualQuotation`, `addLineFromConfirmation`, `updateQuotationDetails`, `addLine`, `updateLine`, `removeLine`, `refreshLineCost`, `issueQuotation`, `reviseQuotation`. Each takes `ctx`, runs in a transaction and writes its audit row. |
| `queries.ts` | `listQuotations`, `listQuotationsForEnquiry`, `getQuotation` (internal), `getQuotationForPrint` (customer-safe). |
| `actions.ts` | Thin server actions. Create and Revise redirect to the new draft. |
| `shared.ts` | Reference (`QUO-20260921-0001`, `rev 2`), audit scope, draft check, date helpers. |
| `filters.ts` | List filters from the URL. |
| `components/` | List table, summary strip, details drawer, add-line drawer, the editable line row (live markup and price), lines table, totals, Create / Issue / Revise popovers, print toolbar, the enquiry's quotation links. |
| `src/app/(workspace)/quotations/` | List and the quotation screen. |
| `src/app/(print)/quotations/[id]/print/` | The printable page, outside the app shell. |
| `src/config/company.ts` | The company block on the printout: logo, name, address, emails, phones (TRN still empty). |

## Company details

The printout shows the total in words ("Five Thousand Six Hundred and Forty-Four UAE Dirhams and Eighty-Eight Fils Only", from the pure `lib/number-words.ts`). The header shows the small Zeronix logo (`public/brand/zeronix-logo-black.png`), the legal name, address, two emails and three phone numbers from `COMPANY` in `src/config/company.ts`. The tax registration number (TRN) is still empty: add it there when confirmed. A blank is left out, never guessed.

## Not built (see `docs/ideas/BACKLOG.md`)

Sending, a server-made PDF file, bulk markup, currency conversion, discounts per line, templates, margin visibility by role, won / lost tracking, follow-ups, converting to an order or invoice.

## Reference

`QUO-20260921-0001`: the day the quotation was made (business timezone) and that day's 4-digit counter, which restarts each day. A revision keeps it and adds `rev 2`. Assigned by `nextQuotationReference` in `shared.ts` under an advisory lock. Search accepts the full reference, the reference without `QUO-`, or just the counter.

## PDF and email

**Download PDF** (topbar, issued or superseded) saves a real PDF made by a headless Chrome, Chromium or Edge printing the print page (`pdf.ts`, `/quotations/[id]/pdf`). **Send by email** (issued only) emails the customer's copy: recipients, subject, a pre-written message with a short "Terms in brief" (the quotation's own currency, VAT, payment and delivery terms and validity, plus the standard line in `src/config/quotation-email.ts`), and the sender's own signature, all editable before **Send**. The message text is built by the pure `email.ts`; sending, the record and the audit are in `email.service.ts`. The exact PDF is stored with the email in `sent_emails`. See `docs/decisions/0008-outgoing-email-and-pdf.md`.
