# Current Development Plan

## Project

**Zeronix Intelligence**

## Active Milestone

**Stabilization** (before any production use). The main modules are built. The previous milestone (Customer Quotation, email quotations, broadcast bulk confirm and review table, AI enquiry intake chat) is archived in `docs/plans/completed/2026-09-26-quotations-email-and-ai-enquiry-chat.md`; its rules and its "not verified" lists stay in force. The full test checklist is `docs/plans/STABILIZATION.md`.

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

## Out of scope

New features. Ideas go to `docs/ideas/BACKLOG.md`.
