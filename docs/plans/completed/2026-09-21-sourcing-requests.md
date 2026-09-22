# Current Development Plan

## Project

**Zeronix Intelligence**

## Active Milestone

**Sourcing Requests (RFQ)** (roadmap Phase 8, first slice: the outreach loop, kept deliberately small)

## Status

**Built and verified 2026-09-21.** Typecheck and ESLint are clean, `next build` is clean (with the dev server stopped), and the existing pure tests pass (8 files, 51 tests). The task breakdown is `2026-09-21-sourcing-requests-tasks.md` (this folder). Both files move to `docs/plans/completed/` when the next `CURRENT.md` is written.

What was verified, against the project database with `TEST` data:
- **Database guards**, in a transaction that was rolled back: the CHECKs, the write-once sent text, no delete of a sent request, unique per supplier, and the reply-supplier trigger (12 checks).
- **Service logic**, also rolled back (17 checks): add needs a confirmed requirement, Draft -> Sent -> No stock -> Reopen, remove only a Draft, an archived enquiry blocks every change, a reply from the wrong supplier is refused, 9 audit rows scoped to the enquiry.
- **In a real browser** (Chrome via Playwright, from outside the repo): the Sourcing tab and count; suggestions ranked (price on record first, then brand coverage) with reasons; the message (greeting by contact name, both requirements with quantities, no `ENQ-` reference); edit, Copy, Mark sent (drawer closes, toast shows), View message read-only with exactly the edited text; No stock with a note, Reopen, Remove; Record reply opens the broadcast form with the supplier and a "reply to ENQ-…" notice; saving marks the request Replied and the broadcast shows a "Reply to ENQ-00005" link; confirming the line makes the price appear under Supplier intelligence with an evidence link that opens the reply text; the Activity timeline shows the events; an archived enquiry is read-only (sent messages stay viewable) and restores; the empty state on an enquiry with no confirmed requirement; the plain `/broadcasts/new` and an unknown `?request=` are unchanged. No console or network errors on the final runs.

One defect was found and fixed during verification: after **Mark sent** the drawer stayed open and no toast appeared, because the page refresh replaced the drawer's form before the code that closes it could run. The same weakness existed for Remove, Reopen and No stock. Success is now reported when the action returns (`components/use-request-action.ts`).

**Not verified yet** (also listed in `docs/plans/STABILIZATION.md`): Copy on a browser that blocks the clipboard (the inline fallback text), a very long requirement list, Mark sent across a day or timezone boundary, and a message built from a real customer enquiry whose wording contains the customer's name (the builder has no customer field, but requirement wording is copied from the request, which is why the drawer tells the buyer to read the text). The narrow-screen layout was not checked.

`TEST` records created for the check, safe to archive: suppliers `TEST Supplier A` (with contact `TEST Ahmed`, linked to Dell), `TEST Supplier B`, `TEST Supplier C` (its request was removed); product `TEST Sourcing Dell Latitude 5440`; two TEST broadcasts (B's quote, A's reply) with confirmed observations; on `ENQ-00005` two supplier requests and its Dell requirement now linked to the TEST product. No scripts were added to the repository.

Previous milestones are archived in `docs/plans/completed/`: Supplier & Broadcast Intelligence MVP, Enquiry Intelligence MVP (built; the first real mailbox sync and tuning on real mail are still open, see its "Not verified yet" list), and Procurement Search (built and verified 2026-09-21: typecheck, ESLint, `next build` clean). Their rules, data model and screens stay in force.

## Purpose

A customer asks for something and there is no fresh price. The buyer messages a few suppliers. This milestone lets the buyer do that from the enquiry and keeps the answers as evidence.

```text
Enquiry (confirmed requirements)
      ↓  Sourcing tab
Pick suppliers  ->  ready-to-copy message per supplier  ->  copy it, send it yourself  ->  Mark sent
      ↓
Supplier replies  ->  Record reply (the existing broadcast screen)  ->  review and confirm as today
      ↓
Price and stock observations, with the reply as evidence; the enquiry's Supplier intelligence now shows them
```

## Decisions (2026-09-21)

1. **First slice only:** who we asked, the message, whether they replied, and the reply captured as evidence. Comparison and the procurement-decision snapshot are a later milestone (BACKLOG).
2. **No sending from the app.** The app prepares the text; the buyer copies it and sends it from their own email or WhatsApp, then presses **Mark sent**. No SMTP, no WhatsApp API, no credentials, no new integration.
3. **A reply is a broadcast.** The existing broadcast form, parser, review workspace, confirm, retraction and evidence drawer are reused unchanged. The reply is linked back to the request. No new review screen, no new evidence kind.
4. **One small table.** "Which supplier we asked about which enquiry." No RFQ numbers, no RFQ list page, no per-supplier line selection: every confirmed requirement goes in the message, and the buyer can edit the text before copying.
5. **No new sidebar page, no new dependency.** It is a tab on the existing enquiry workspace.
6. **The message never contains the customer's name, email or enquiry reference**, only what to source (reseller confidentiality).
7. Development-first testing still applies (`CLAUDE.md`): typecheck, lint, manual verification, no new test suites.

## Data (one additive migration, not destructive)

`SupplierRequest` (`supplier_requests`)

| Column | Notes |
|---|---|
| `enquiry_id`, `supplier_id` | Restrict. **Unique together**: one request per supplier per enquiry (a chase is a note, not a second row). |
| `contact_id` | Optional supplier contact (Restrict). |
| `status` | `DRAFT`, `SENT`, `REPLIED`, `NO_STOCK`, `DECLINED`. "Waiting" is `SENT`; how long is read from `sent_at`. |
| `channel` | Optional, how it was sent: reuse `PreferredChannel` (PHONE, WHATSAPP, EMAIL). |
| `message_text`, `sent_at`, `sent_by_id` | The exact text sent and when. All three are set together (CHECK) and **write-once** after sent (trigger). Unknown stays NULL. |
| `note` | Free text ("chased on the phone", "quoted verbally"). |
| `created_by_id`, `created_at`, `updated_at` | As elsewhere. |

`broadcasts.supplier_request_id`: nullable FK (Restrict), indexed. A trigger enforces that a linked broadcast's supplier is the request's supplier. Nothing else in existing tables changes.

## Behaviour

- **Sourcing tab** on `/enquiries/[id]?view=sourcing` (with a count of suppliers asked). The message covers the enquiry's **confirmed** requirements only; pending ones are not included and the tab says how many are waiting. With no confirmed requirement it shows an empty state pointing back to Requirements.
- **Add supplier:** suggestions first (suppliers with a latest price or stock for a confirmed requirement's product, then active suppliers who handle its brand), each with the reason and how fresh; plus search over all active suppliers. Optional contact.
- **Message drawer** per request: a generated subject and body (a pure, deterministic template; the contact's name if chosen, otherwise a plain greeting; each requirement with brand, model, part number, spec and quantity, "quantity to be confirmed" when unknown; asks for price with VAT stated, quantity available and lead time), editable, with **Copy**. **Mark sent** records channel and time (default now) and stores the final text.
- **Record reply:** opens `/broadcasts/new` with the supplier and the request pre-filled. Saving creates the broadcast linked to the request and sets the request `REPLIED` in the same transaction. The broadcast page shows a link back to the enquiry. From there review and confirm work as they do today; the enquiry's per-requirement Supplier intelligence then shows the new price and stock.
- **No stock / Declined** are set by a person, with an optional note. They create **no observations** (only a confirmed reply line does); the UI says to record the reply if there is text to keep. **Reopen** returns a request to `SENT` (or `DRAFT` if it was never sent). `REPLIED` is set only by recording a reply.
- **Remove** works on a `DRAFT` request only (audited). A sent request stays.
- An archived enquiry is read-only here too. The enquiry status is **not** changed automatically.
- Audit: `supplier_request.added|removed|sent|status_changed`, scoped to the enquiry, so they appear on its Activity timeline. Recording a reply also writes `broadcast.created` as today.

## Structure

```text
prisma/schema.prisma + migration        SupplierRequest, its enum, broadcasts.supplier_request_id, the CHECKs and triggers
src/modules/sourcing/message.ts         pure buildRequestMessage(...) -> { subject, body }
src/modules/sourcing/service.ts         add, remove, markSent, setStatus, reopen (ctx, zod, transaction, audit)
src/modules/sourcing/queries.ts         requests for an enquiry, supplier suggestions
src/modules/sourcing/schemas.ts, actions.ts, components/
src/modules/broadcasts/                 createBroadcast accepts supplierRequestId; broadcast page shows the back-link
src/app/(workspace)/enquiries/[id]/page.tsx   + Sourcing tab
src/app/(workspace)/broadcasts/new/page.tsx   accept ?supplier= and ?request=
src/modules/audit/                      the four new actions
```

## Out of scope

RFQ numbers, an RFQ list page or sidebar item, choosing lines per supplier, follow-up dates, comparison, the procurement-decision snapshot, sending from the app, reading replies by email automatically, quote validity and other observation attributes, changing the enquiry status automatically, a new evidence kind. Ideas go to `docs/ideas/BACKLOG.md`.

## Definition of Done

Verified by hand once, in a browser, using the project database. Anything created is labelled `TEST` and nothing is bulk-loaded.
1. An enquiry with a confirmed requirement shows a **Sourcing** tab; without one it says what to do first.
2. A supplier can be added from the suggestions and by search; the message lists the confirmed requirements, contains **no customer name, email or reference**, can be edited and copied; **Mark sent** stores the text, channel and time, and they cannot be changed afterwards.
3. **Record reply** opens the broadcast form with the supplier and request filled in; saving marks the request `REPLIED`; confirming its lines makes the price and stock appear in the enquiry's Supplier intelligence, and the broadcast links back to the enquiry.
4. No stock, Declined, Reopen and Remove behave as described (a sent request cannot be removed; an archived enquiry is read-only).
5. The enquiry's Activity timeline shows the events.
6. The migration is additive and applied with `prisma migrate` only. Typecheck, lint and `next build` are clean; existing tests still pass.

## Documentation to update as built

`docs/modules/ENQUIRIES.md` (or a short `SOURCING.md`), `docs/architecture/DATA_MODEL.md` (section 12), `docs/design/SCREENS.md`, `docs/plans/ROADMAP.md`, `docs/ideas/BACKLOG.md`, `docs/plans/STABILIZATION.md` (what this milestone adds to test later).
