# Module: Enquiries, Customers and Email

**Status:** built (2026-09-20), pending live verification of the mailbox sync. Plan: `docs/plans/active/CURRENT.md`. Data model: `docs/architecture/DATA_MODEL.md` section 11. Screens: `docs/design/SCREENS.md`.

## Purpose
Turn customer requests (pasted text, or email from a mailbox) into structured requirements, then show what supplier intelligence already exists for them. Not a CRM pipeline: the questions are *what exactly is needed, what do we already know, what is blocking a response*.

## What exists

```
Pasted request                         IMAP mailbox (read-only)
      |                                        |
      |                          sync -> raw MIME + clean text (immutable evidence)
      |                                        |
      |                          deterministic score -> band (Likely / Review / Low) + reasons
      |                                        |
      |                          triage queue: a person creates an enquiry or dismisses it
      v                                        v
   Enquiry  (immutable request as evidence, header suggestions, status / priority / blocker / next action)
      |
   Requirement items: parser proposals -> a person corrects, links a product, confirms
      |
   "What do we already know?": latest supplier price / stock / age / evidence for the linked product, plus suppliers who handle the brand
```

- **Customers** (`src/modules/customers`): companies and their contacts, modelled on suppliers. A contact's email is how an incoming email is recognised as a known customer.
- **Enquiries** (`src/modules/enquiries`): `service.ts` (create, header, status, notes, archive, suggestions, save-requester-as-customer), `item.service.ts` (review workflow), `parsing/` (pure requirement parser), `intelligence.ts` (read-only supplier intelligence), `queries.ts` (inbox and workspace reads).
- **Email** (`src/modules/email`): `account.service.ts` (mailboxes and encrypted passwords), `imap.ts` (the only code that talks to a mail server), `sync.service.ts`, `mime.ts` and `text.ts` (normalisation), `scoring/` (config and pure scorer), `triage.service.ts`.
- `scripts/mail-sync.ts` (`npm run mail:sync`, `-- --watch`): optional automatic sync. No queue.

## Rules this module follows
- **The request is immutable evidence.** A pasted request is an `EvidenceSource` (`CUSTOMER_ENQUIRY`); an email's clean text is one (`CUSTOMER_EMAIL`) and its original MIME is stored immutably and downloadable as `.eml`.
- **Parsers propose, people confirm.** Items stay `PENDING`; header suggestions (delivery, urgency, required-by wording) are saved only when a person presses Apply.
- **Unknown stays unknown.** The parser never defaults or normalises ("U7" stays "U7"; nothing becomes "Core Ultra 7"). An unknown sender is kept as a requester, never turned into a customer.
- **Nothing is created automatically from email.** Scoring only orders the queue.
- **Confirming a requirement records no prices or stock.** An enquiry says what the customer needs, not what a supplier offered.
- **Nothing is deleted.** Enquiries are archived; emails are never deleted (a trigger refuses); dismissing is reversible.
- **Read-only mailbox, encrypted credentials** (ADR 0005).

## Parser (`enquiries/parsing`)
Rule-based and deliberately imperfect. It splits the visible text (quoted reply text and an email's header block are skipped; line numbers always refer to the full evidence text) into blocks, treats lines with a brand/family plus quantity/specs/model/part number as requirement lines, and reuses the broadcast extractors for brand, specs, part number and quantity. Enquiry-specific rules: "Need 200 ...", "40 Dell ...", "x 50", delivery place, urgency, required-by wording, product families from the product master. Detected cpu / ram / storage / os are shown as chips (`extracted_data.hints`), never as facts. It implements `EnquiryParser`, so an LLM extractor could later implement the same interface as an optional aid.

## Email scoring (`email/scoring/config.ts`)
Weights follow the master plan: subject RFQ phrase +30, procurement intent +15, known customer +15, known brand +10, category +10, product detail +10, quantity +5, RFQ/BOQ attachment name +10; marketing -40, recruitment -40, newsletter -30, automated sender -30, known supplier -30 (a price list, not an enquiry). Clamped 0-100. Bands: 70+ Likely, 40-69 Review, below 40 Low (stored, hidden by default). Every rule that fired is stored with the email and shown in the drawer. **Tune the phrase lists and weights after looking at real mail.**

## Sourcing requests (`src/modules/sourcing`, built 2026-09-21)
The **Sourcing** tab of an enquiry: ask suppliers about the confirmed requirements and keep their answers as evidence.

```
Confirmed requirements -> Add supplier -> Prepare message (edit, Copy) -> you send it -> Mark sent
                                                                                         |
Record reply (opens /broadcasts/new for that supplier, linked to the request) <----------+
  -> the existing broadcast review: link a product, Confirm -> price and stock observations
  -> the enquiry's Supplier intelligence and the product page show them, with the reply as evidence
```

- **One request per supplier per enquiry** (`supplier_requests`). Statuses: Draft, Sent (= waiting), Replied, No stock, Declined. Replied is set automatically when a reply is recorded; No stock / Declined are set by a person (with a note) and create **no observation**; Reopen returns them to Sent (or Draft if never sent).
- **Nothing is sent by the application.** It builds the text (`message.ts`, a pure function); a person copies it into their own email or WhatsApp and presses **Mark sent**, which stores the exact text, channel and time (write-once in the database).
- **The message never contains the customer's name, email or reference**: its input has no customer field. Requirement wording is copied from the customer's request, so the drawer tells the buyer to read it before sending.
- **Suggestions** (read-only): suppliers with a latest price or stock for a confirmed requirement's product (freshest first), then active suppliers who handle its brand. Every other active supplier can still be picked.
- Only a Draft can be removed. An archived enquiry is read-only here (sent messages stay viewable). The enquiry status is never changed automatically.
- Services: `addSupplierRequest`, `removeSupplierRequest`, `markRequestSent`, `setRequestOutcome`, `reopenRequest`, plus two hooks called by `broadcasts/service.ts` when a reply is recorded (`assertRequestAcceptsReply`, `markRequestReplied`).
- Screens and data: `docs/design/SCREENS.md`, `docs/architecture/DATA_MODEL.md` section 12.

### Compare and choose supplier (built 2026-09-21)
Below the requests table, the Sourcing tab has a **Compare** section: one row per confirmed requirement, one column per supplier asked. Each cell is that supplier's latest price and stock for the requirement's product, as stated (VAT state, age, evidence link): the same values as the product page and the requirement's Supplier intelligence (`getProductsIntelligence`), so nothing new is stored for the comparison. **Nothing is ranked and there is no "best price".**
- **Choose** a supplier for a requirement (optional note). The price and stock shown in the cell are saved with the choice, as pointers to the immutable observations. **One active choice per requirement**: choosing another supplier replaces it, **Clear** withdraws it; the old record is retracted, never edited or deleted.
- The chosen cell shows **Chosen**, the note, who and when. If the supplier has quoted differently since, a **When chosen** block shows the original price and stock with their evidence.
- A supplier marked No stock or Declined cannot be chosen. A requirement with no linked product says "Link a product to compare" (it can still be chosen; price and stock stay empty). An archived enquiry shows the choices read-only.
- Service: `chooseSupplier`, `clearChoice` (`decision.service.ts`). Data: `docs/architecture/DATA_MODEL.md` section 13. It does not change the enquiry status.

## Not built (see `docs/ideas/BACKLOG.md`)
Sending mail (SMTP), reply and thread linking, attachment contents, an LLM pass, database-managed dictionaries and an editor, creating broadcasts from supplier emails, WhatsApp and other channels, key rotation, a job queue, authentication. For sourcing: RFQ numbers and a cross-enquiry RFQ list, follow-up dates, per-supplier line selection, numeric warranty / credit / lead-time comparison, split orders.

## Prerequisites for the next step
Authentication before anyone else uses the application. Real (redacted) enquiries and real mail to tune the parser and scoring thresholds. Product families in the product master improve requirement recognition.
