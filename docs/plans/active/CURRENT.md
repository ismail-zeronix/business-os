# Current Development Plan

## Project

**Zeronix Intelligence**

## Active Milestone

**Stabilization** (before any production use). The main modules are built. The previous milestone (Customer Quotation, email quotations, broadcast bulk confirm and review table, AI enquiry intake chat) is archived in `docs/plans/completed/2026-09-26-quotations-email-and-ai-enquiry-chat.md`; its rules and its "not verified" lists stay in force. The full test checklist is `docs/plans/STABILIZATION.md`.

**Knowledge screen (2026-09-27, not part of the stabilization steps):** a read-only Knowledge screen (`/knowledge`, all signed-in users) shows the markdown files in `knowledge/` (company, services, sales team, procurement, AI instructions). The pages are a skeleton to be filled with real business facts from the owner; see `docs/decisions/0009-knowledge-base-files.md`. The AI module stays paused.

**Right dock and contact notes (2026-09-27, not part of the stabilization steps):** a slim icon rail on the right edge of every signed-in screen opens tool panels. The first tool is **Supplier contacts**: paste rough contact text, save it as a free-floating note (not linked to a supplier) with name, company, phones and emails read from the text by rules and confirmed by the person, plus a typed description; search, edit, remove (archive). Built as a registry so later tools are one entry each. Module doc: `docs/modules/CONTACT_NOTES.md`. Verified so far: typecheck, lint, and the service against the project database; the screen itself still needs a signed-in browser check.

**Structured requirements and specification matching (2026-09-27, approved scope change, on branch `feature/enquiry-requirements`):** upgrades how enquiry requirements are represented and how products are matched, underneath the unchanged workflow (enquiry -> evidence -> parser -> item -> matching -> review -> sourcing -> decision -> quotation). Plan in phases, each shippable:
1. **Structured enquiry requirements** (built, see Status below): `enquiry_requirements`, pure spec normalizers in `src/modules/specs`, extraction on create, human edit with retraction, chips in the item row. No matching change.
2. **Product attributes** (built, see Status below): `product_attributes`, `products.model_key` (Gen 7 = G7), extraction from product data on create, dry-run backfill script (writing to existing products needs the owner's go-ahead), category set on auto-created products. Human correction of product attributes (edit UI) comes with phase 3.
3. Compare and explain (shadow mode): structured candidate search, per-requirement verdicts (EXACT, COMPATIBLE, UPGRADE, PARTIAL, MISMATCH, UNKNOWN), ranking and explanation in the candidate list. Auto-link unchanged.
4. Auto-link gating: `pickAutoLink` redefined so conflicts and unknown must-have specifications force human review.
5. Broadcast side uses the same attributes so model-only lines no longer collapse two configurations into one product.
6. Other categories (server, switch) and AI-proposed requirements.
Parked, not in this scope: supplier ranking, stock-status inference, `match_feedback`. `product_variants` is deliberately not added: `Product` acts as the sellable variant.

## Steps, in order

1. **Browser verification pass (no new features).** Clear the "not verified in a browser" items by hand on the project database, with `TEST` data:
   - Enquiry-made quotation: create, issue while incomplete, revise, superseded view.
   - Outgoing email tab, compose drawer, Emails sent section.
   - Customer note and call logging on the Activity tab.
   - AI chat panel: chat a `TEST` request through to Create enquiry draft, open the enquiry.
   Fix what breaks; record results here and in `STABILIZATION.md`.
2. **Security items before real exposure.** HTTPS and the `Secure` cookie, the `/setup` window on a fresh deployment, CSRF behind a proxy, and the decision on the re-recorded checksum of migration `20260923004256_broadcast_category_warranty`.
3. **Automated tests** (explicitly started by the user's approval of this plan), in this order: Vitest on pure logic (quotation pricing, parsers, `secret-box`, render token, password helpers); database-constraint checks for the guard triggers; service integration tests; Playwright for critical journeys only.
4. **Performance and production readiness.** Search query plans, backups, logging, final review.

## Status

**Step 1 run 2026-09-26** (Chrome via Playwright, project database, temporary user `TEST Verify Admin`, `test.verify@example.test`; deactivate it when done).

Verified in a browser:
- Enquiry-made quotation (QUO-20260923-0001): Revise created rev 2 as a draft; a price edit followed to the total and survived a reload; Issue refused a line with no quantity with a plain message; Issue then froze it; rev 1 shows "Replaced by a newer revision" and is unchanged; the print page has no supplier, cost, markup or margin; `/pdf` returns a real PDF.
- Outgoing tab shows the account, signature box and Send test email. The compose drawer opens with From, To, subject, message, signature and the PDF attached; an invalid Cc is refused inline and a valid one becomes a chip. Not sent (nothing outward was sent).
- Customer Activity: a `TEST` note and a `TEST` call were logged and show at the top of the timeline with the right labels, author and time.

**Not verified: AI chat panel.** The panel opens and shows the provider failure as a plain message, but Gemini (`gemini-3.8-flash`) answered with a server error (`UNAVAILABLE`) on every try in this session, so a chat through to Create enquiry draft could not be run. Retry when the provider is up.

Also verified: **Send email** from the drawer (26 Sep 2026, 06:01, to ismail@zeronix.ae). The `sent_emails` row is SENT with a Message-ID and the 118 KB PDF, and the quotation shows it under Emails sent. Also verified: **Send test email** from Settings > Email accounts > Outgoing (to ismail@zeronix.ae; the row shows "Sent just now"). **Narrow screen (390 px):** quotations list, quotation page, enquiries and customer page have no sideways page scroll; the compose drawer fits. **Fixed:** the top bar had a fixed height and pushed page buttons (Download PDF, Send by email, Revise) off the right edge on a phone; it now wraps (`components/application/topbar.tsx`), desktop unchanged. Minor, not fixed: on a phone the breadcrumb "Quotations" and the reference overlap slightly. Not yet done: a quotation with a confirmation line on a narrow screen, hundreds of suppliers in the confirmation drawer.

Left behind: rev 2 of QUO-20260923-0001 (issued), a `TEST` note and call on the customer IBRAHIM MOHAMMAD, five failed `CAPTURE_ENQUIRY` executions.

Observation: in `next dev` the Next.js dev badge sits over the assistant button (bottom-right) and blocks clicks; production builds do not show it.

## Step 2 findings (2026-09-26, read from code, not run)

- **Secure cookie:** set when `NODE_ENV=production` (`src/core/auth/session.ts`), so production must be served over HTTPS or sign-in will not stick.
- **CSRF on server actions:** Next compares `Origin` with `Host` / `X-Forwarded-Host`. Behind a proxy, forward `X-Forwarded-Host` or set `serverActions.allowedOrigins` in `next.config.ts` (not set today).
- **/setup window:** closed on this database (an admin with a password exists). On a fresh deployment it is open to anyone who reaches the URL first; complete it immediately, or add a one-time setup token (not built).
- **Migration checksum:** `20260923004256_broadcast_category_warranty` was edited after it was applied. `prisma migrate diff` shows the live schema matches `schema.prisma` exactly, so only the recorded checksum is stale (DB `fc63ce12...`, file `1d71deb1...`). Fix = a one-row update of `_prisma_migrations.checksum`. Not applied: the change was blocked as a shared-resource edit and needs the owner's go-ahead. A fresh database applies the file as it is and is not affected.

### Step 2 built (2026-09-26)

- **Setup code:** optional `SETUP_TOKEN` in `.env`. When set, `/setup` asks for it and `setupFirstAdmin` refuses a missing or wrong code (constant-time compare, field error, nothing changed). Unset = unchanged behaviour. `core/auth/setup-token.ts`, tests in `setup-token.test.ts` and `auth.service.test.ts`. Not seen in a browser: /setup is closed on this database.
- **Server actions behind a proxy:** optional `APP_ALLOWED_ORIGINS` (comma-separated hosts) feeds `serverActions.allowedOrigins` in `next.config.ts`; needed only when the proxy does not forward `X-Forwarded-Host`. Not run against a real proxy.
- **Still the owner's to do at deploy:** serve over HTTPS (the session cookie is `Secure` in production), set `SETUP_TOKEN`, and complete `/setup` first. The migration checksum update is still pending the owner's go-ahead.

## Step 3 progress (2026-09-26)

Started with the user's approval. Typecheck, ESLint clean; `vitest run` 441 tests pass (was 142).

Added, all on pure logic or the `*_test` database (the existing test harness):
- `quotations/pricing.test.ts`, `lib/number-words.test.ts`, `quotations/email.test.ts` (money maths, amount in words, email body and signature).
- `core/security/render-token.test.ts`, `core/security/secret-box.test.ts`, `core/auth/auth-helpers.test.ts` (token, encryption, password hashing, `safeNextPath`, session helpers).
- `email/error-text.test.ts` (`describeSmtpError`, `describeImapError`: fixed text, never the raw error), `broadcasts/readiness.test.ts`.
- `broadcasts/parsing/rules-parser.test.ts`, `enquiries/parsing/enquiry-parser.test.ts` (real broadcast and enquiry line formats, no supplier or customer details).
- `core/database/guards.test.ts`: `guard_quotation`, `guard_quotation_line`, `guard_sent_email`, `guard_last_admin`, the quotation, line, sent-email and SMTP CHECKs, the one-active-account index, unique session token. Prisma reports a trigger refusal as a generic foreign-key error (P2003); the test helper reads the database's own message from `meta.driverAdapterError`.

Second slice (same day), service integration tests on the `*_test` database:
- `quotations/service.test.ts` (29): manual and enquiry-made quotations, typed and confirmation lines, markup and price following each other, currency change, issue lists every problem, revise (rev 2 and 3, original untouched), one draft per enquiry, archived enquiry blocks everything. It found one small defect, fixed in `service.ts`: saving a line with unchanged values wrote an audit row ("100" to "100.00"); stored decimals are now compared as two-decimal text.
- `quotations/email.service.test.ts` (17): send an issued quotation with the SMTP server and headless Chrome stubbed (no real mail): the exact PDF and its hash are stored, failure stored with a plain reason, only ISSUED sends, needs an active account and the key, customer Activity scope; the outgoing account service (admin only, password encrypted and never in audit, one active account, copy-login without decrypting, test-send result), own signature.
- `users/auth.service.test.ts` (23): sign-in (hash-only session token, identical message for every failure, lockout after 5 and its release), first-admin setup (takes over the first user, refuses a second run, two simultaneous runs give one winner), change own password (other sessions end), user management (admin only, last admin, self-protection, deactivate ends sessions, admin reset).
- `sourcing/sourcing.test.ts` (26): request state machine, reply linking rules, write-once and reply-supplier guards, choose and clear a supplier (one active choice, replaced choice retracted, another supplier's or product's or retracted price refused), and a quotation costing from the choice (refresh follows a new choice, cleared choice, another currency).

Third slice: pure-logic tests for `buildRequestMessage` / `describeLine` / `composeSentText`, `htmlToText` / `stripQuotedForScoring`, `scoreEmail`, and the quotation reference and Asia/Dubai date helpers (midnight and year boundaries).

Still to do in Step 3: guard and service tests for the enquiry and email-sync tables (`ingestMessage`, `syncAccount`, triage, enquiry item confirm rules, `createEnquiry` from email), `normalizeEmail`; and Playwright, which needs `@playwright/test` (a new dev dependency, so it needs a go-ahead) and a sign-in for the browser. `docs/plans/STABILIZATION.md` lists each. The 2026-09-26 manual browser pass (above) covers the same journeys by hand.

## Structured requirements, phase 1 status (2026-09-27)

Built and verified on the project database with a `TEST` enquiry (ENQ-00004, archived): 12 requirements proposed for two lines (CPU, RAM, storage, type, screen, keyboard, resolution, OS read correctly from the E14 and Latitude wording); a human edit retracted the parsed row and wrote a `HUMAN` row (both kept); "Read again" left human rows alone; a duplicate, an unreadable CPU, a bad range and a wrong operator were refused with plain messages; the database refused an UPDATE of a value, a DELETE, and a BETWEEN with no upper value; four audit rows and `requirements: 12` on `enquiry.created`. Typecheck and ESLint clean; migration `20260927100000_enquiry_requirements` applied with `migrate deploy` (additive).

**Not verified in a browser** (sign-in is required and no bypass was used): the chips, the Add and Edit popovers, and the read-only view on a reviewed item. Known limits of the reader: an unit-less capacity ("512 NVMe") is read as GB with MEDIUM confidence; "FHD+" is not read as FHD; Wi-Fi, GPU, panel and touch are not extracted yet; a requirement written only in an attachment is not seen.

## Structured requirements, phase 2 status (2026-09-27)

Built: migration `20260927140000_product_attributes` (applied, additive), `product_attributes` and `products.model_key`, `canonicalModelKey`, product-attribute extraction on `createProduct`, `model_key` kept current on update, category resolved on auto-created products, a read-only "Specifications" panel on the product page, and `npm run specs:backfill`. Typecheck and ESLint clean. Verified with a `TEST` product: key `E14G7`, six attributes read, the key follows an edit of the model, and the database refused an attribute update, a delete and a row with two values.

**Backfill dry run on the project database (nothing written):** 139 products; 123 would get a model key, 131 would gain attributes (619 values: cpu 85, os 86, ram 115, resolution 39, screen 92, storage 116, storage type 86), 27 would get a category (112 have no category text on any of their lines, so they stay unknown). **Applied on 2026-09-27 with the owner's go-ahead** (`--apply`, then `--apply-categories`): 123 model keys, 619 attribute values, 27 categories; a re-run finds nothing left to write.

Known limits: the model key still differs when the model text includes the family word; a platform code such as "LNL" stays in the key; the product-attribute edit UI is not built; the product page panel was not seen in a browser (sign-in required).

## Broadcast variant safety, parser v5 (2026-09-27)

From the first real Red Data Computer list: parser version 5 (signature block skipped and read, price/currency false positive fixed, glued CPU+RAM split, INCOMING stock, tower category) and variant-safe product resolution for broadcast lines (`resolveProductForItem`). Verified by running the whole list through `createBroadcast` inside a rolled-back transaction on the project database: 6 lines gave 6 distinct products (the three Dell T2 lines sharing FCT2250 stayed three variants); nothing was saved. Existing broadcast, product and lib tests pass (124). This is phase 5 of the plan, built early because real data showed the collapse.

## Broadcast parser v6 and real supplier data (2026-09-27)

Owner-supplied real broadcasts were used to train the rule parser (version 6). Read: pipe-separated, comma-separated and one-line product lists, `|| title ||` + detail lines, a heading with one variant per line ("240GB - SA400S37/240G"), priced one-liners ("@325+vat"), Apple lines that start with a code, sender banners and footers ("SUPP :", "Person :", "CALL @", "Samir - +971..."), Apple / Snapdragon / Core Ultra X9 / Core 7 CPUs, months of warranty, "Last 4 Units" as LIMITED. Memory cards and USB sticks get no laptop attributes; GPU memory is not RAM. Brands added from the lists (Apple, TP-Link, ASUS, LG, MSI, Microsoft, Samsung, Seagate, Hiksemi, SanDisk, Apacer, Kingston, Acer) and 30 brandless products were given the brand their own name states (audited, `via: brand read from the product name`). Seven suppliers and their contacts were created from list signatures and 11 broadcasts were saved (all items PENDING; no observations until a person confirms). Full test suite 441 passed; the parser has no new tests (owner's development-first rule).

**AI layer changes from the same patterns:** search terms no longer treat capacities and speeds ("16GB", "144Hz") as part numbers (`ai/intents.ts`); `searchProcurement` (used by `/search` and the assistant's `search_products`) also lists products that share the canonical model key ("E14 Gen 7" finds "E14 G7") as possible MODEL matches; `search_products` returns each product's active specifications and the evidence package shows them as "specifications read from its name (not verified)"; prompts `answer-v2`, `interpret-v2` (code shapes) and `enquiry-draft-v2` (specification vocabulary, which details to ask for first). No provider or budget change; the model still never writes data and never decides a match.

## Out of scope

New features. Ideas go to `docs/ideas/BACKLOG.md`.
