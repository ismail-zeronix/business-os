# Current Development Plan

## Project

**Zeronix Intelligence**

## Active Milestone

**Enquiry Intelligence MVP: Manual + Email**

## Status

**Archived 2026-09-20 as built, with the live-mailbox check still open** (the first real Sync now, the email drawer on a real message, and tuning of scoring and parser rules were not done). Task breakdown: `2026-09-20-enquiry-intelligence-tasks.md` (same folder).

Implemented 2026-09-20 (all nine stages). Main manual and drawer flows were checked in a real browser and Test connection succeeds against a real mailbox. **Not yet verified:** an actual sync of that mailbox and the email drawer on a real message; see "Implementation Status" at the end. Task breakdown: `docs/plans/active/enquiry-intelligence-tasks.md`.

The previous milestone (Supplier & Broadcast Intelligence MVP) is complete and archived at
`docs/plans/completed/2026-09-20-supplier-broadcast-intelligence-mvp.md`. Its rules, data model and screens stay in force
(`docs/architecture/DATA_MODEL.md`, `docs/design/SCREENS.md`).

## Purpose

Turn customer requests into structured, evidence-backed requirements and connect them to the supplier intelligence that already exists.

```text
Customer request (pasted text  |  email from a mailbox)
      ↓
Preserve original (immutable evidence)
      ↓
Deterministic requirement extraction  (a proposal)
      ↓
Human review: correct, link product, confirm
      ↓
What do we already know?  latest supplier price / stock / age / evidence for the linked product
      ↓
Operational enquiry inbox: status, priority, blocker, next action, timeline
```

Not a CRM pipeline. The questions are: what exactly does the customer need, what do we already know, what is blocking a response.

---

# 1. Decisions (from planning, 2026-09-20)

1. **Scope:** manual enquiries and IMAP email ingestion, plus a Settings shell that hosts email accounts. Delivered in stages; manual first.
2. **Enquiry model:** dedicated `Enquiry` / `EnquiryItem` tables that mirror `Broadcast` / `BroadcastItem`. Broadcasts are not generalised or refactored.
   They share evidence, parser extractors, product matching, product creation, audit and `getProductIntelligence`.
3. **Parsers propose, humans confirm:** parsed header values (delivery, priority, required-by) are shown as suggestions with an Apply button, not saved.
   Parsed items are `PENDING` until a person confirms.
4. **Notes and timeline:** the enquiry timeline comes from `AuditLog` scoped to the enquiry. A note is an append-only `enquiry.note_added` audit entry. No notes table.
5. **Customers** are a real module (list, detail, contacts), modelled on Suppliers but simpler.
6. **Mailbox password** is stored encrypted (AES-256-GCM) in PostgreSQL, key in `.env`, write-only in the UI. Approved as security-sensitive. See section 11.
7. **No job queue.** Sync is a button plus an optional polling script. A queue table is introduced only if that proves insufficient.
8. **Email never creates an enquiry automatically.** A person creates or dismisses each candidate.
9. **Development-first testing** still applies (`CLAUDE.md`): typecheck, lint, manual verification, no new test suites.

---

# 2. Stages

| # | Stage | Exit criterion |
|---|---|---|
| 1 | Docs, schema, migration | Additive migration applied to the project database; client regenerated; typecheck clean |
| 2 | Settings shell | `/settings/brands`, `/settings/categories` work through the secondary sidebar |
| 3 | Customers | Create/edit/archive customer and contacts; list and detail load |
| 4 | Manual enquiry | Paste a request, land in the workspace with proposed items |
| 5 | Enquiry workspace | Review, link product, confirm, header, status, notes, timeline, supplier intelligence |
| 6 | Enquiry inbox, navigation, Overview | Inbox filters work; Overview shows enquiries needing attention |
| 7 | Email accounts | Add account, Test connection, password stored encrypted and never displayed |
| 8 | Email sync and triage | Sync now ingests real mail; triage view; Create enquiry / Dismiss |
| 9 | End-to-end check, docs | One manual pass of section 17; docs aligned |

Stages 1-6 have no external dependency. Stage 8 needs the user to enter mailbox credentials in the Settings screen.

---

# 3. Settings shell

`/settings` gets a thin secondary sidebar (about 176px) and route-based pages instead of tabs.

| Group | Item | Route |
|---|---|---|
| Master data | Brands | `/settings/brands` |
| Master data | Categories | `/settings/categories` |
| Integrations | Email accounts | `/settings/email` |

- `/settings` redirects to `/settings/brands`; the old `/settings?tab=categories` redirects to `/settings/categories`.
- The existing `MasterDataPanel` and actions are reused unchanged.
- Future settings are added as menu items when their page exists. Unbuilt items are absent, not disabled.
- The main sidebar keeps a single **Settings** entry under Admin.

---

# 4. Customers

Fields: name (unique by normalised name, all statuses), legal name, TRN, country, emirate, website, phone, email, notes, status.
Contacts: name, job title, department, phone, WhatsApp, email, preferred channel, notes, status. Add, edit, archive. No brand or category links.

- `/customers`: table with Customer, Location, Contacts, Open enquiries, Last enquiry, Status; search and status filter; empty state "No customers yet."
- `/customers/[id]`: tabs Overview, Contacts, Enquiries, Activity.
- Contact email is compared case-insensitively when matching an email sender to a known customer.

---

# 5. Enquiries: data model

New enums: `EnquiryStatus` (NEW, ASSIGNED, SOURCING, WAITING_SUPPLIER, QUOTATION_READY, QUOTED, NEGOTIATION, FOLLOW_UP, WON, LOST, ON_HOLD),
`EnquiryPriority` (LOW, NORMAL, HIGH, URGENT). `EvidenceKind` gains `CUSTOMER_ENQUIRY` and `CUSTOMER_EMAIL`. The states are set by people; there is no
automatic transition and no dependency on quotations.

**Enquiry**
- `number` (sequential, shown as `ENQ-00012`), `evidence_source_id` (unique, 1:1 immutable raw request)
- `customer_id?`, `contact_id?`, `requester_name?`, `requester_email?` (kept when the sender is not a known customer; unknown stays unknown)
- `subject?`, `status` (default NEW), `priority` (default NORMAL), `required_by?` (date), `delivery_location?`, `blocker?`, `next_action?`, `assigned_to_id?`, `notes?`
- `extracted_data` (write-once): the parser's original header proposals and reasons
- `archived_at?`, `last_activity_at`, `created_by_id`, timestamps

**EnquiryItem** (mirrors BroadcastItem)
- `enquiry_id`, `position`, `source_text`, `source_line_start/end`, `origin` (PARSER | MANUAL), `extraction_confidence?`, `extracted_data` (write-once)
- Current values, all nullable: `description`, `brand_text`, `family_text`, `model_text`, `part_number`, `quantity` (> 0), `spec_text`, `notes`
- `product_id?`, `match_basis?`, `review_status` (PENDING | CONFIRMED | IGNORED), `confirmed_at/by`, `ignored_reason`
- Structured attributes the parser detects (CPU, RAM, storage, OS) live in `extracted_data.hints` and are shown as read-only chips. `spec_text` is the editable value.
  A category-aware specification model is deferred (BACKLOG).

Confirming an item means a person verified the requirement. It needs a description, model or part number; a linked product is optional. Confirming creates
no observations. Reopen sets it back to PENDING.

---

# 6. Enquiries: requirement parser

A pure, deterministic parser behind an interface like `BroadcastParser`. Input: raw text and context (brand names, category names, product families from the
product master). Output: header proposals and `ParsedItem`-style items with reasons. The existing extractors for brand, quantity, part number and specs
are reused. Enquiry-specific rules are added for phrasing ("Need 200…"), delivery location, urgency and required-by text.

- Anything not written in the text stays unknown. No guessing or normalising ("U7" stays "U7").
- `required_by` text is a hint only; a person sets the real date.
- Quoted reply text is excluded from parsing and scoring only; the evidence keeps the full message.
- An LLM may implement the same interface later as an optional aid. It is out of scope now.

---

# 7. Enquiries: screens

**`/enquiries`** operational inbox, no Kanban. Chips: Needs attention (default: status NEW or any pending item, excluding archived and closed = WON or LOST), New, Sourcing, Waiting supplier,
Quote ready, All, Archived, and Email (the triage queue, section 12). Columns: Ref, Source, Customer or requester, Requirement, Items (confirmed / pending), Status, Priority, Age.
Age is measured from the evidence's received time. Server-side filtering and pagination.

**`/enquiries/new`** paste the request; optional customer and contact (combobox, with quick-create); channel; received-at (default now, Dubai time).
Saving preserves the raw text, runs the parser and lands in the workspace.

**`/enquiries/[id]`** (key screen) split view like broadcast review.
- Left: sticky raw request with line numbers and highlighted source lines. For email evidence it shows the header block and text, with a Download .eml link.
- Right: header strip (customer/requester, status, priority, required-by, delivery, blocker, next action, owner; edit in a drawer) and a suggestion strip with Apply buttons.
- Items with collapsed rows and an inline editor, product linker with Create product, and Confirm / Edit / Ignore / Reopen. Add manual item. j/k navigation like broadcasts where practical.
- Each item expands to **Supplier intelligence**: for a linked product, the latest price and stock per supplier with freshness and evidence link (reusing `getProductIntelligence`);
  for an unlinked item, match candidates plus the active suppliers who cover the item's brand.
- Tabs: Items, Activity (timeline from audit; note composer).
- Customer from requester: a drawer prefilled from the requester creates a customer and contact and links them.

**Overview `/`** gains one compact list, "Enquiries needing attention", with a count link to the email triage queue.

---

# 8. Navigation

```text
Overview

ENQUIRIES
Enquiries
Customers

PROCUREMENT
Suppliers
Broadcasts
Products

ADMIN
Audit
Settings
```

`src/config/navigation.test.ts` currently asserts that `/enquiries` is absent. That single assertion is updated; no new tests are added.

---

# 9. Email: accounts (Settings, Email accounts)

`/settings/email` lists accounts (Label, Mailbox, Folder, Last sync, Status, Messages) with Add account (drawer). Row actions: Edit, Test connection, Sync now, Deactivate.

Form fields: label, host, port, security, username, password, folder, sync-from date.
- Defaults pre-filled and editable: host `imap.hostinger.com`, port `993`, security `SSL/TLS`, folder `INBOX`, sync-from = 7 days ago. The Hostinger defaults are checked against Hostinger's documentation when built.
- Security is `SSL/TLS` or `STARTTLS`. Unencrypted is not offered. Certificate validation is always on.
- Password is required on create and write-only afterwards ("Replace password"). Leaving it blank on edit keeps the stored one.
- **Test connection** connects, opens the folder read-only and reports success or a sanitised error. It stores nothing. On edit with a blank password it uses the stored one.
- Several accounts are allowed. Uniqueness: (host, username, folder), compared case-insensitively.

---

# 10. Email: ingestion

- **Libraries:** ImapFlow (IMAP) and PostalMime (MIME parsing), as in the master plan. These are the only new dependencies.
- **Sync now** button (per account, and in the Email triage header) plus `npm run mail:sync` (one pass) and `npm run mail:sync -- --watch` (poll every `MAIL_SYNC_INTERVAL_MINUTES`, default 5).
- **Read-only:** the folder is opened read-only (EXAMINE); nothing is marked read, flagged, moved or deleted.
- **Cursor:** `(uid_validity, last_uid)` per account. If UIDVALIDITY changes, rescan from the sync-from date and rely on Message-ID de-duplication.
- **Bounds:** only messages on or after the sync-from date; at most 200 messages per run, oldest first. If more remain, the UI says so and Sync again continues.
- **Overlap guard:** a compare-and-set lease column (`sync_lease_until`) on the account. A second run reports "Sync already running".
- **De-duplication:** unique `(account_id, folder, uid_validity, uid)` and a partial unique `(account_id, message_id)` where the Message-ID exists.
- **Per message, one transaction:** parse, store immutable raw MIME, create the `EvidenceSource` (kind `CUSTOMER_EMAIL`, channel `EMAIL`, raw text = header block plus clean text), score, insert.
  A message that fails to parse is recorded as an error row, not skipped silently.
- **Stored:** raw MIME (`bytea`; above 20 MB it is not stored and the row says "too large"), Message-ID, In-Reply-To and References headers, from, to, cc, subject, sent and received times,
  clean text (plain part, or HTML converted to text with a small in-repo function), attachment metadata only (name, type, size), score, reasons, band.
- **Errors** are stored as short sanitised categories (authentication failed, host unreachable, TLS error, timeout, folder not found). The password never appears in an error, log or audit entry.
- Audit: `email_account.created/updated/password_changed/status_changed`, and one `email_account.synced` entry per run that ingested at least one message (actor null for the polling script).

---

# 11. Email: security

Approved 2026-09-20. To be recorded as `docs/decisions/0005-email-account-secrets.md`.

1. **Encryption at rest:** AES-256-GCM, random IV per value, format `v1:<iv>:<tag>:<ciphertext>`. Key from `APP_SECRET_KEY` (32 bytes, base64) in `.env`.
   Without the key, the account form is disabled with an explanation. A `db:backup` dump therefore never contains a usable password. Losing the key means re-entering passwords.
2. **Write-only:** the encrypted column is excluded from every read query except the sync and test-connection services. It is never sent to the browser.
3. **Read-only mailbox access** (section 10).
4. **Real customer email is stored immutably** and appears in backups.
5. **Host field:** the server connects to whatever host and port the form contains. Acceptable while the app is unauthenticated and bound to localhost (ADR 0004). Certificate validation is never disabled.
6. **Authentication is now a hard prerequisite** before anyone other than the developer uses the application.

---

# 12. Email: scoring and triage

Deterministic, configurable in one typed config file (weights, thresholds, phrase lists). Dictionaries are in code; a database-managed dictionary editor is deferred.

| Signal | Points |
|---|---|
| Subject contains a strong RFQ phrase | +30 |
| Body contains procurement intent | +15 |
| Sender matches a known customer contact | +15 |
| Known brand (Brand master) | +10 |
| Recognised category (Category master) | +10 |
| Recognised product or spec pattern | +10 |
| Quantity detected | +5 |
| RFQ/BOQ-style attachment filename | +10 |
| Marketing/spam pattern | -40 |
| Recruitment language | -40 |
| Newsletter indicators (`List-Unsubscribe`, "unsubscribe", "view in browser") | -30 |
| Automated sender (no-reply, mailer-daemon) | -30 |
| Sender matches a known supplier (a supplier contact email or the supplier's general email; likely a price list, not an enquiry) | -30 |

Stored score is clamped to 0-100 and every contributing reason is kept. Bands: 70+ **Likely**, 40-69 **Review**, below 40 **Low** (stored, hidden by default).
Ingesting a supplier email creates no broadcast; that is deferred (BACKLOG).

**Triage (`/enquiries` Email chip):** Received, From, Subject, band badge, top reasons, attachments, actions. Default filter: band Likely and Review, state New.
Row opens a right drawer (`?email=<id>`): headers, clean text, full score breakdown, attachment list, Download .eml.
- **Create enquiry:** the enquiry reuses the email's existing evidence (no copy). It runs the requirement parser on the body, links a known customer by sender, otherwise fills `requester_name` / `requester_email`, and marks the message ENQUIRY_CREATED.
- **Dismiss:** requires a reason and marks it DISMISSED. **Restore** returns it to the queue. Triage state is the only mutable part of an email row.

---

# 13. Database guidance

Additive migration only. Nothing is dropped, altered destructively or reset. `ALTER TYPE ... ADD VALUE` for the two evidence kinds.

New tables: `customers`, `customer_contacts`, `enquiries`, `enquiry_items`, `email_accounts`, `email_messages`. Foreign keys on business tables are `Restrict`.

Hand-written SQL in the migration:
- CHECKs: `enquiry_items.quantity > 0` when present; `email_accounts.port` 1-65535; `email_messages.score` 0-100; `email_messages` triage consistency (`enquiry_id` is set exactly when `triage_status = ENQUIRY_CREATED`; DISMISSED requires `dismissed_at` and a reason).
- Triggers: reuse `guard_item_extracted_data()` for `enquiry_items` and add the same for `enquiries`; a guard so `email_messages` rows are immutable except the triage columns
  (`triage_status`, `dismissed_*`, `enquiry_id`).
- Indexes: `enquiries (status, last_activity_at desc)`, `enquiries (customer_id)`, `enquiry_items (enquiry_id, review_status)`, `email_messages (band, triage_status, received_at desc)`.
- Unique: enquiry number, `enquiries.evidence_source_id`, `email_messages.evidence_source_id`, `email_messages.enquiry_id`, customer normalised name, the email de-duplication keys above.

`EmailAccount.password_encrypted` is excluded by default in queries (explicit select). Deletion follows the existing strategy: status or archive flags, no hard deletes of business data.

---

# 14. Audit

New entity types: `Customer`, `CustomerContact`, `Enquiry`, `EnquiryItem`, `EmailAccount`, `EmailMessage`.
New actions: `customer.created|updated|status_changed`, `customer_contact.created|updated|archived`,
`enquiry.created|updated|status_changed|note_added|archived`, `enquiry_item.created|updated|linked|confirmed|ignored|reopened`,
`email_account.created|updated|password_changed|status_changed|synced`, `email_message.enquiry_created|dismissed|restored`.
Enquiry and item entries are scoped to the Enquiry; contact entries to the Customer. Audit is written in the same transaction as the change.

---

# 15. Code structure

```text
src/modules/customers/   schemas, service, contact.service, queries, actions, components
src/modules/enquiries/   schemas, service, queries, actions, parsing/, intelligence.ts, components
src/modules/email/       schemas, account.service, sync.service, ingest.ts, scoring/, triage.service, queries, actions, components
src/core/security/       secret-box.ts (AES-256-GCM)
scripts/mail-sync.ts
```

Pure logic (parser, scoring, HTML-to-text, quote stripping, secret-box) has no database access so tests can be added later. Services take `ctx`. Actions stay thin.
Broadcast components are reused only where already generic; otherwise their pattern is followed inside the enquiries module. Broadcasts are not refactored.

---

# 16. Out of scope

- Sending mail (SMTP), replying, reply and thread linking to existing enquiries
- Attachment contents and attachment storage
- LLM extraction or classification, embeddings, agents
- Database-managed dictionaries and an editor UI
- Creating broadcasts from supplier emails
- WhatsApp, website forms, spreadsheets, other channels
- Quotations, RFQs, sourcing sessions, margins
- Authentication and roles (ADR 0004), a job queue, Redis, microservices
- Category-aware specification model

Useful ideas go to `docs/ideas/BACKLOG.md`.

---

# 17. Definition of Done

Verified by hand once, in a browser, using the project database. Anything created is labelled `TEST`.

Manual track:
1. Settings sidebar shows Brands, Categories, Email accounts; Brands and Categories still work.
2. Create a customer with a contact.
3. Paste "Need 200 Dell Latitude 16GB 512GB Windows Pro delivery Dubai urgently" as an enquiry.
4. The raw text is preserved; items and header suggestions are proposed; unknowns stay empty.
5. Correct an item, link or create a product, confirm it.
6. For a product with observations, Supplier intelligence shows latest price, stock, age and evidence.
7. Change status and priority, add a note; the Activity tab shows each change.
8. The enquiry appears in the inbox filters and on Overview.

Email track (needs the user's mailbox credentials entered in Settings):
9. Add an account with the Hostinger defaults; Test connection succeeds; a wrong password gives a sanitised error.
10. The password is not visible anywhere in the UI, and the database column holds only the `v1:` ciphertext.
11. Sync now ingests recent messages; a second sync adds none (de-duplication); the mailbox is unchanged (nothing marked read).
12. A message scores and appears in the correct band; Create enquiry opens the workspace with the email as evidence; Dismiss records a reason and Restore returns it.
13. Download .eml returns the original message.
14. Restart the application; all data persists.

Typecheck, lint and `next build` are clean. Migration applied with `prisma migrate` only.

---

# 18. Documentation to update as built

`docs/architecture/DATA_MODEL.md` (new tables and guards), `docs/modules/ENQUIRIES.md` (no longer "future"), `docs/design/SCREENS.md`,
`docs/plans/ROADMAP.md`, `docs/architecture/OVERVIEW.md` if it lists modules, `docs/ideas/BACKLOG.md`, README (env vars, mail sync),
new `docs/decisions/0005-email-account-secrets.md`, and `.env.example` (`APP_SECRET_KEY`, `MAIL_SYNC_INTERVAL_MINUTES`).

---

# 19. Guiding principle

**Customer Request → Structured Requirement → Known Supplier Intelligence → Next Action**

Optimise for a reliable, evidence-backed requirement record and a fast review path, not for the number of features.

---

# 20. Implementation Status (2026-09-20)

All nine stages are built. TypeScript, ESLint and `next build` are clean, every data page is dynamic, and the 142 existing tests pass (run once, not extended).
The only edit to an existing test was `navigation.test.ts` (the nav list and the "future routes" list). Migration `20260920120000_enquiry_email_intelligence` was applied with `migrate deploy` (no shadow database; the generated SQL was checked to be additive).

## Built
- **Settings shell:** route-based, secondary sidebar (Brands, Categories, Email accounts).
- **Customers:** list, detail (Overview, Contacts, Enquiries, Activity), contacts, status, duplicate-name protection.
- **Enquiries:** new-enquiry screen, deterministic requirement parser, workspace (raw request with source lines, requirement review, product linker and create-product, confirm / ignore / reopen, header edit, status, notes and timeline, header suggestions with Apply, save-requester-as-customer), inbox with search and views, Overview list, supplier intelligence per requirement.
- **Email:** accounts (encrypted password, Test connection, Hostinger defaults), sync service (read-only, lease, cursor, 200 cap, Message-ID and UID de-duplication, oversize and unreadable rows), deterministic scoring, triage queue and drawer, create-enquiry / dismiss / restore, `.eml` download, `npm run mail:sync` (+ `--watch`).

## Verified by me (project database, `TEST`-labelled data, no browser)
- Migration, tables, triggers and CHECKs exist; the guards refuse tampering: write-once `extracted_data`, immutable evidence, quantity 0, email column changes and delete, the triage consistency CHECKs.
- Customers and the whole enquiry review flow through the real services: create, edit with diff and preserved parser original, confirm rules, product create + link + alias, reopen, ignore, suggestions, status, note, archive rules, requester to customer, list views and search (including a literal `%`), timeline.
- Parser on eight sample texts (the master-plan example gives quantity 200, Dell, `U7` kept as written, specs, delivery Dubai, priority suggestion URGENT, and no invented "Core Ultra 7"; numbered lists; brand headings; quoted replies ignored; email header skipped; subject-only fallback).
- Encryption: round trip, random IV, tamper and wrong-key rejection. The stored value is `v1:` ciphertext; the password is absent from query results, audit rows and the rendered Settings HTML; connection failures return fixed sentences.
- Ingestion through the real storage, scoring and de-duplication path with a stand-in IMAP client (four `TEST` messages): bands, known-customer linking, evidence, oversize row, duplicate UID and duplicate Message-ID skipped, create enquiry from email (customer linked, header skipped, source lines correct), dismiss / restore, `.eml` download and its 404 cases.
- The sync error path and the overlap guard against a real (refused) connection attempt.
- Server-rendered pages load without errors: settings (3), customers (4 tabs), enquiries (inbox views, search, workspace views, email views and drawers, new), Overview, Audit.

## Verified in a real browser (later the same day, Chrome driven by Playwright from outside the repo, project database)
- New enquiry form: an empty submit shows the inline field errors and saves nothing; a `TEST` submit saves, redirects to the workspace and shows the "Enquiry saved" toast (ENQ-00005).
- Workspace: the parser proposals appear with the source lines highlighted; **Apply** on a detected suggestion updates the header and the timeline; `j` / `k` move between requirements; the product linker's live search finds the `TEST` product; **Ctrl+Enter** confirms the selected requirement (counts and the navbar "pending" chip update); the **Status** popover opens from the navbar and saves with a note; a note added on the Activity tab appears in the timeline; every step is in the audit timeline.
- Drawers: enquiry quick view (with a blocker), evidence (from a real observation), email (not-found state only), Add contact form drawer opened from the navbar button. No console errors on any page.
- **Test connection** on the configured email account reported success ("Connected. The folder holds 3,346 messages."), so the encrypted stored password, the read-only connection and the inline result all work against a real mailbox. **Nothing was synced.**

## Not verified yet
- **An actual sync of the real mailbox.** That nothing is marked read, UIDVALIDITY changes, the variety of real MIME, and the first real triage results (the scoring is unproven on real mail). Press **Sync now** on the Enquiries > Email tab. The Hostinger defaults (`imap.hostinger.com`, port 993, SSL/TLS, username = the full email address) were checked against Hostinger's published email settings on 2026-09-20; Hostinger also says a mailbox with two-factor authentication needs an app password, which the form now mentions.
- The email drawer with a real message (score reasons, attachments, Create enquiry / Dismiss / Restore in the browser), the navbar **Sync now** button's status text, and the create-product drawer from the linker.
- `npm run mail:sync -- --watch` (only the one-shot with no active account was run), and persistence across a PostgreSQL restart.
- The scoring weights and phrase lists and the parser rules are unproven on real mail and real enquiries. They are the first thing to tune.

## Known limitations and things to know
- No authentication (ADR 0004), and now a mailbox with real customer email. **Do not let anyone else use this until authentication exists.**
- `TEST` data was created in the project database for verification: customers "TEST Customer (verification)" and "TEST Customer from requester", five enquiries (ENQ-00001 to ENQ-00005; ENQ-00005 "TEST browser check" was made in the browser check, with one confirmed requirement, a status change and a note), a temporary product "TEST Dell Latitude U7 (enquiry check)" with one alias, one inactive email account "TEST account (dummy, not a real mailbox)" (by the browser check the Settings list showed a single account that connects to a real mailbox, so it appears to have been edited since; check its label before relying on this note), and email rows whose subjects start with `TEST` (plus one with no subject). Emails and audit rows are immutable by design (database triggers), so the email rows cannot be deleted without dropping the guard; they are hidden from the default triage view. Customers, enquiries and the product can be archived.
- The scripts that ran the checks above live outside the project (session scratchpad); none were added to the repository.
- After `prisma generate`, restart `npm run dev`: the dev server caches the old client.
- A `pg` deprecation warning ("Calling client.query() when the client is already executing a query") appeared in the verification scripts. It is harmless today but should be traced before upgrading `pg` to 9.
- `EmailMessage` rows for messages the parser could not read, or that were over 20 MB, are stored with an explanation; their original is not stored when it was not downloaded.
