# Backlog

Ideas that are **not authorised for implementation**. Do not build these unless `docs/plans/active/CURRENT.md` says so. Add new ideas here instead of writing code for them.

## Deferred from the current milestone (observation and broadcast detail)
- Observation attributes: condition (new / refurbished / used), market (UAE stock vs import), warranty, lead time, minimum order quantity. Today this text stays in the item's spec text / notes and in the original evidence.
- Broadcast attachments (screenshots, PDF, Excel) and re-parsing a broadcast after edits.
- Correction learning beyond aliases (e.g. suggesting brand/model rules from repeated fixes).
- Product merge (`merged_into_id`), and a match-history table if audit-log history proves too slow to query.
- ~~Broadcast parser problems found on the first real messages (Lenovo P16v G3; the Hesabi Computers WhatsApp desktop list)~~ fixed in parser version 2 (2026-09-21), see `docs/modules/BROADCASTS.md`. Reading `SUPPLIER :` / `CONTACT :` lines to pick the supplier and contact was built the same day. Still open: fuzzy or partial supplier names (today only an exact name, or legal name, matches, so nothing is guessed); a brand heading (`> DELL`) giving following blocks a default brand; warranty text ("1 Yr PS NBD", "1Yr Carry-in") as data; confidence "LOW" for well-identified items that simply have no price in the message.

## Overview (dashboard) ideas, deferred 2026-09-21
- Quote or sales value cards and charts (needs a quotations module and a value on enquiries; today prices are supplier observations only).
- Supplier response time and reliability chart (needs reply-time history: sent-at to reply-at per supplier request).
- Team workload by assignee (works today, but only one user exists).
- Most-requested brands and categories (from enquiry requirements), and top customers by enquiry count.
- Overview widgets as a registry (one definition per card, chart and tab) if the page grows past a dozen widgets; today they are plain lists in `queue-cards.tsx` and the page's tab array.

## Suppliers
- Numeric credit limit/period, delivery areas, typical lead time, minimum order requirements, `SupplierTerm` history.
- Supplier account owner (internal user), preferred communication rules.
- Supplier search over broadcast content, stock and credit ("Lenovo Dubai stockist 30 days credit").
- Supplier reliability evidence (kept separate from any "score"; no generic score is planned).
- Relax supplier name uniqueness if genuine same-name branches become common.

## Products and search
- Procurement Search sources beyond products (deferred from the first slice, 2026-09-20): broadcast items and lines linked or text-matching a product, previous enquiry requirements, and active suppliers who cover a searched brand or category. Also Ctrl+K, and filters (brand, category, only-with-price) on `/search`.
- Category-aware specification model (laptops, servers, networking differ) instead of one fixed table.
- A curated CPU/generation/OS/color/keyboard term dictionary (regex-based, normalizing supplier typos like "ARTICAL GRAY" -> "Arctic Grey") to make spec text canonical, feeding the specification model above once that exists. Needs real `Product`/`BroadcastItem` spec columns and a matching-identity decision first (today two CPU variants of the same model collapse into one product — confirmed 2026-09-23 in `products/matching.ts`, which never reads `specText`). `ProductAlias` ("remember this wording") already covers per-product name/model teaching; a token-level dictionary would be a second, parallel mechanism, so should reuse that pattern rather than duplicate it. If built, derive the term list from this business's actual saved broadcasts (like every other parser rule so far), not an imported generic list, and keep it code-only at first (settings-page editing deferred), matching the existing decision already made for the email-scoring phrase list (`email/scoring/config.ts`). If built, in this order: (1) real spec columns on `Product`/`BroadcastItem` (schema + migration), (2) a database-driven term table mirroring `ProductAlias` (canonical value, matched variants, scoped by attribute type — not a hardcoded list), (3) tokenizer/parser integration reading that table, (4) verification against this business's actual saved broadcasts before trusting it. A smaller, already-built step toward the same underlying problem (2026-09-23): the ambiguous-candidate picker on broadcast review now shows each candidate's own spec text (from its already-confirmed items) next to the item being reviewed, tokens that differ flagged — no dictionary, just surfacing what the parser already extracts correctly. See `docs/modules/BROADCASTS.md`.
- Category hierarchy (`parent_id`), lifecycle, region, warranty, manufacturer fields.
- Faster product text search. **Measured 2026-09-20** on a synthetic 20k-product / 600k-observation / 500k-audit volume: product search 150-620 ms (the 3-word alias search was slowest); supplier offers about 150-250 ms for a supplier with about 2,000 observations; audit filtered by type about 150 ms (mostly the `count(*)`). Everything else (review workspace, product intelligence, evidence, lists) was under 100 ms. Trigram GIN indexes on the individual columns gave **no gain** because the query is an `OR` across joined relations, so the planner cannot use them. Real fix if needed: search one denormalised `search_text` column (name, brand, category, family, model, part number, SKU, aliases) with a single trigram index, maintained by the product and alias services, or restructure into `UNION` subqueries. Not needed at current scale.
- Fuzzy matching layer; LLM-assisted matching as the last layer.
- Global Ctrl+K search across products, suppliers, contacts, broadcasts.

## Platform
- ~~Authentication, roles and permissions~~ built 2026-09-21 (email and password, database sessions, ADMIN and STAFF; ADR 0006). Still open: password reset by email (an admin resets it today), two-factor authentication, single sign-on (Google / Microsoft), more roles (for example Buyer and Sales, with Sales not seeing supplier costs), per-record permissions, a "sign out everywhere" and active-sessions screen, an audit of failed sign-ins, IP-based rate limiting, "you were sent to /login" returning to the page you were on (`?next=` is supported by the login screen but nothing adds it yet), a "must change password at first sign-in" flag for passwords an admin sets, and password rules beyond length.
- Dark theme (tokens are already semantic).
- Background jobs on a PostgreSQL-backed queue (email sync is a button plus a polling script for now; see "Enquiries and email").
- Comprehensive automated testing (Vitest, integration, Playwright) is scheduled as the stabilization phase: see `docs/plans/STABILIZATION.md`.
- Dockerising the application; production deployment and backups.
- Upgrade Prisma to 8.x and TypeScript to 7.x once stable and supported by tooling.

## Enquiries and email (deferred from the Enquiry Intelligence MVP, 2026-09-20)
- Reply and thread linking: attach a reply (`In-Reply-To` / `References`, already stored) to the enquiry it answers instead of listing it as a new candidate.
- Sending mail (SMTP) and replying from the application.
- Attachment contents: store files, read RFQ / BOQ spreadsheets and PDFs into requirements. Today only name, type and size are kept.
- An optional LLM pass over already-filtered candidates (summary, missing information, spec normalisation). It must remain a proposal.
- Database-managed dictionaries and a Settings editor for the scoring phrase lists, weights and thresholds (today they are code: `modules/email/scoring/config.ts`); re-scoring stored mail after tuning.
- Create a broadcast from a supplier email (a known supplier's mail is only scored down today).
- Mailbox key rotation for `APP_SECRET_KEY`; several folders per account; IMAP IDLE instead of polling; a PostgreSQL-backed job queue if the button and polling script prove insufficient.
- Category-aware requirement specifications (today a free-text specification plus read-only detected chips).
- Enquiry-side product intelligence: "also requested in N other enquiries" on a requirement and on the product page; customer purchase / quotation history once those modules exist.
- Bulk "confirm ready requirements", and assigning an enquiry to a user from the inbox.
- Unify the enquiry and broadcast review components (they were deliberately kept separate so the working broadcast code was not refactored).
- Remembered aliases from enquiry items carry provenance only in the audit entry (`product_aliases` points at broadcast items); add a generic provenance if it is needed.

## Sourcing requests (deferred from the first Sourcing milestone, 2026-09-21)
- ~~Supplier comparison and the decision snapshot~~ built 2026-09-21 (Compare and Choose Supplier). Still open: comparing warranty, UAE vs import stock, credit, delivery and lead time as data rather than a free-text note (needs the observation attributes below), supplier reliability, and never a ranking or "best price" (currency and VAT state make prices non-comparable).
- Choosing more than one supplier for a requirement (split orders), and a "decisions so far" summary across enquiries.
- RFQ numbers, an RFQ list page with "waiting on N suppliers" across enquiries, and per-supplier line selection (ask a supplier for only some requirements).
- Follow-up dates and an overdue view; quote validity ("Expired") once observation attributes exist.
- Sending from the application (SMTP / WhatsApp API) and reading replies by email automatically (needs reply and thread linking).
- Suggesting reply values with the existing parser matched to the request's requirements; pre-filling the reply form from the request.
- Optionally moving the enquiry status to Sourcing / Waiting supplier when a request is marked sent (today the status stays a human decision).

## Quotations (deferred from the first Quotation milestone, 2026-09-21)
- Bulk markup: apply one markup % to every line that has a cost (today it is per line only).
- A PDF file made on the server (today: the browser's Save as PDF from the print page), and sending the quotation by email or WhatsApp from the application.
- Currency conversion (a cost in USD against an AED quotation); today markup is only available when the cost is in the quotation's currency.
- Per-line discounts, optional or alternative lines, sections and headings, quotation templates and standard terms, a default validity (7 or 14 days) as a setting.
- Margin and cost visibility by role (Sales not seeing supplier costs): both roles see them today, and the paused AI plan's capability map is the seam.
- Won / lost on the quotation itself, follow-up dates and reminders, quotation conversion statistics on the Overview, and converting an accepted quotation into an order or invoice.
- Moving the enquiry status to Quoted when a quotation is issued (today the status stays a human decision).
- Company details as a Settings screen (today `src/config/company.ts`: logo, name, address, emails and phones; the TRN prints once filled in) and a logo on the printout.
- Quick confirmation follow-ups: retract a confirmation from the quotation screen, a stock-only confirmation, several products in one confirmation, and a saved list of who confirmed what by phone for a day.
- A "Discard draft" action (today an unwanted draft is edited or left; nothing is ever deleted).
- An internal note per line (not printed), and a cost the buyer types by hand when no supplier price exists (today cost is always a supplier observation).

## Email quotations (deferred from the first sending milestone, 2026-09-21)
- **Merging the customer Activity tab** with enquiries, quotations (created, issued, revised, emailed) and emails received matched by contact address, with filter chips, and showing the same merged feed on each enquiry and quotation page. (2026-09-23: logging a note or a call, and quotation-emailed events, already appear today — see `docs/plans/active/CURRENT.md`.)
- Moving the enquiry to **Quoted** with one click after emailing; a "Follow up in N days" reminder.
- HTML email with the Business OS look, reply and thread linking for mail the customer sends back, and showing replies on the quotation.
- Sending other documents (a supplier request, an order confirmation), several attachments, and templates per customer or per language.
- Retry and a queue for failed sends, and bounce handling; SPF, DKIM and DMARC guidance for `zeronix.ae` so mail is not marked as spam.
- A separate permission for who may send, an approval step for large quotations, and a per-person From address.
- Open and click tracking was deliberately left out (privacy, deliverability); add only if wanted.

## Later modules (see `docs/plans/ROADMAP.md`)
Sourcing/RFQ, Second Brain (pgvector), multi-agent platform, WhatsApp and other channels, advanced analytics.
