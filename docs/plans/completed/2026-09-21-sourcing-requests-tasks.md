# Sourcing Requests (RFQ) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax.
> This is the task breakdown of `docs/plans/active/CURRENT.md`, not a second plan. If they disagree, `CURRENT.md` wins.

**Goal:** From an enquiry, ask suppliers for a price (a ready-to-copy message per supplier), track who was asked and who replied, and capture each reply as evidence through the existing broadcast screen.

**Architecture:** Modular monolith, `actions.ts` (thin) -> `service.ts(ctx)` -> Prisma -> PostgreSQL. One new table (`supplier_requests`) and one new nullable column (`broadcasts.supplier_request_id`). A reply *is* a broadcast, so parsing, review, confirm, retraction and the evidence drawer are reused unchanged. The UI is a **Sourcing** tab on the existing enquiry workspace.

**Tech Stack:** Next.js 16.3.5, React 19.2.8, TypeScript 5.9, Prisma 7.10 (`@prisma/adapter-pg`), PostgreSQL 17 (Docker, `127.0.0.1:5442`), zod 4, Tailwind 4 + shadcn/ui, Lucide. **No new dependency.**

**Spec:** `docs/plans/active/CURRENT.md`

## How this plan differs from the generic template

The project rules (`CLAUDE.md`) override the template: **no test files, no TDD steps, no commits** (the folder is not a git repository). Each task is verified by `npm run typecheck`, `npm run lint`, loading the affected pages, and, where logic is not reachable from a page, a throw-away script in the session scratchpad that runs against the **project database** (data labelled `TEST`, or inside a transaction that is rolled back). Never `prisma migrate reset` / `db push`. Never create another database or server.

## Global Constraints (from `CLAUDE.md` and `CURRENT.md`, verbatim values)

- Node `>=22.12`; Prisma **7.10** and TypeScript **5.9** are pinned on purpose; Next is `16.3.5` (docs in `node_modules/next/dist/docs/`, read them before writing any *new* framework pattern; here every page and action mirrors an existing one).
- Database `127.0.0.1:5442` (never `localhost`, never 5432). Migrations only. Timestamps UTC, displayed in `Asia/Dubai`.
- Every input validated with zod; integrity in PostgreSQL constraints; audit written in the same transaction as the change; services take `ctx = { actor, db }`; actions stay thin.
- Services import with **relative paths** (no `@/`) so scratch scripts can run them. Actions and components may use `@/`.
- Business rules: raw evidence immutable; unknown stays NULL / `UNKNOWN`; parsers propose and people confirm; never fabricate; label anything created for verification `TEST`.
- **The request message never contains the customer's name, email or enquiry reference.**
- **A request is one row per (enquiry, supplier).** Statuses: `DRAFT`, `SENT`, `REPLIED`, `NO_STOCK`, `DECLINED`. `sent_at`, `message_text`, `sent_by_id` are set together and write-once. Only a `DRAFT` request can be removed. `REPLIED` is set only by recording a reply. `NO_STOCK` / `DECLINED` create no observations. The enquiry status is never changed automatically.
- UI: `docs/design/UI_SYSTEM.md`. Compact, thin, tables first, no oversized cards, no gradients, no emoji, drawers not modals, errors inline, toasts only for success. No new sidebar item.
- After `prisma generate`, restart `npm run dev` (the dev server caches the old client).

---

## File structure

**Create**

| Path | Responsibility |
|---|---|
| `prisma/migrations/<ts>_supplier_requests/migration.sql` | Table, enum, column, plus hand-written CHECKs and triggers |
| `src/modules/sourcing/message.ts` | Pure: build the request text, compose the stored text |
| `src/modules/sourcing/schemas.ts` | zod input schemas |
| `src/modules/sourcing/service.ts` | add, remove, mark sent, outcome, reopen, and the two reply hooks (ctx, transaction, audit) |
| `src/modules/sourcing/queries.ts` | requests for an enquiry, supplier suggestions, request for the reply form |
| `src/modules/sourcing/actions.ts` | thin server actions |
| `src/modules/sourcing/components/sourcing-tab.tsx` | server component: the tab's content |
| `src/modules/sourcing/components/add-supplier-form.tsx` | client: pick a supplier and optional contact |
| `src/modules/sourcing/components/message-drawer.tsx` | client: prepared message, Copy, Mark sent (read-only once sent) |
| `src/modules/sourcing/components/request-actions.tsx` | client: Remove, No stock / Declined, Reopen |
| `src/modules/sourcing/components/use-request-action.ts` | client hook added during verification: reports success (toast, close) when the action returns, because the revalidation re-renders the row and unmounts the form before an effect could run. Used by Mark sent, Remove, Reopen and No stock / Declined. Tasks 6 steps 3 and 4 above show the first version (`useActionFeedback`), which had this defect. |

**Modify**

| Path | Change |
|---|---|
| `prisma/schema.prisma` | enum, model, back-relations, `Broadcast.supplierRequestId` |
| `src/modules/audit/types.ts`, `describe.ts` | entity type `SupplierRequest`, four actions and labels |
| `src/lib/labels.ts`, `src/components/application/status-badges.tsx` | request status label and pill |
| `src/modules/enquiries/shared.ts` | `enquiryReference(number)` |
| `src/modules/enquiries/queries.ts` | `getEnquiry` also returns the request count |
| `src/app/(workspace)/enquiries/[id]/page.tsx` | the Sourcing tab |
| `src/modules/broadcasts/schemas.ts`, `actions.ts`, `service.ts`, `queries.ts` | accept and validate `supplierRequestId`; return the link |
| `src/modules/broadcasts/components/broadcast-form.tsx` | hidden request field and notice |
| `src/app/(workspace)/broadcasts/new/page.tsx`, `[id]/page.tsx` | read `?request=`; show the back-link |

---

### Task 1: Schema, migration and database guards

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_supplier_requests/migration.sql` (generated, then extended by hand)

**Interfaces:**
- Produces: Prisma model `SupplierRequest` (`db.supplierRequest`), enum `SupplierRequestStatus` (`DRAFT | SENT | REPLIED | NO_STOCK | DECLINED`), `Broadcast.supplierRequestId: string | null`, relation `Broadcast.supplierRequest`, relation `SupplierRequest.replies: Broadcast[]`, composite key `enquiryId_supplierId`.

- [ ] **Step 1: Add the enum and model** at the end of `prisma/schema.prisma`:

```prisma
// ─────────────────────────────── Sourcing requests ───────────────────────────────
// Milestone: docs/plans/active/CURRENT.md. Additive only. The CHECKs and triggers live in the migration (Prisma cannot express them).

enum SupplierRequestStatus {
  DRAFT
  SENT
  REPLIED
  NO_STOCK
  DECLINED
}

/// "We asked this supplier about this enquiry." One row per (enquiry, supplier). The text sent, its time and channel are write-once (trigger).
/// A supplier's reply is a Broadcast whose supplier_request_id points here.
model SupplierRequest {
  id          String                @id @default(uuid(7)) @db.Uuid
  enquiryId   String                @map("enquiry_id") @db.Uuid
  supplierId  String                @map("supplier_id") @db.Uuid
  contactId   String?               @map("contact_id") @db.Uuid
  status      SupplierRequestStatus @default(DRAFT)
  /// How it was sent. NULL until sent.
  channel     PreferredChannel?
  /// The exact text sent (subject line, blank line, body). NULL until sent.
  messageText String?               @map("message_text")
  sentAt      DateTime?             @map("sent_at") @db.Timestamptz(3)
  sentById    String?               @map("sent_by_id") @db.Uuid
  note        String?
  createdById String                @map("created_by_id") @db.Uuid
  createdAt   DateTime              @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt   DateTime              @updatedAt @map("updated_at") @db.Timestamptz(3)

  enquiry   Enquiry          @relation(fields: [enquiryId], references: [id], onDelete: Restrict)
  supplier  Supplier         @relation(fields: [supplierId], references: [id], onDelete: Restrict)
  contact   SupplierContact? @relation(fields: [contactId], references: [id], onDelete: Restrict)
  sentBy    User?            @relation("SupplierRequestSentBy", fields: [sentById], references: [id], onDelete: Restrict)
  createdBy User             @relation("SupplierRequestCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  replies   Broadcast[]

  @@unique([enquiryId, supplierId])
  @@index([supplierId])
  @@map("supplier_requests")
}
```

- [ ] **Step 2: Add the back-relations and the broadcast link.**
  - In `model Enquiry` add `supplierRequests SupplierRequest[]` after `email EmailMessage?`.
  - In `model Supplier` add `supplierRequests SupplierRequest[]` after `stockObservations StockObservation[]`.
  - In `model SupplierContact` add `supplierRequests SupplierRequest[]` after `stockObservations StockObservation[]`.
  - In `model User` add, after `emailMessagesDismissed`:
    ```prisma
      supplierRequestsCreated    SupplierRequest[]  @relation("SupplierRequestCreatedBy")
      supplierRequestsSent       SupplierRequest[]  @relation("SupplierRequestSentBy")
    ```
  - In `model Broadcast` add the column after `contactId`:
    ```prisma
      /// Set when this broadcast is a supplier's reply to a request. A trigger checks the supplier matches.
      supplierRequestId String?  @map("supplier_request_id") @db.Uuid
    ```
    the relation after `contact`:
    ```prisma
      supplierRequest SupplierRequest? @relation(fields: [supplierRequestId], references: [id], onDelete: Restrict)
    ```
    and `@@index([supplierRequestId])` next to the other indexes.

- [ ] **Step 3: Format, then create the migration without applying it.**

Run: `npx prisma format` then `npx prisma migrate dev --create-only --name supplier_requests`
Expected: a new folder `prisma/migrations/<timestamp>_supplier_requests/` with `migration.sql`. **If Prisma says the database drifted or asks to reset, STOP and tell the user: that would be destructive. Do not confirm a reset.**

- [ ] **Step 4: Append the hand-written guards** to the end of that `migration.sql`:

```sql
-- CHECK constraints ----------------------------------------------------------
ALTER TABLE supplier_requests
  ADD CONSTRAINT supplier_requests_sent_together
    CHECK ((sent_at IS NULL) = (message_text IS NULL) AND (sent_at IS NULL) = (sent_by_id IS NULL)),
  ADD CONSTRAINT supplier_requests_sent_status CHECK (status <> 'SENT' OR sent_at IS NOT NULL),
  ADD CONSTRAINT supplier_requests_channel_needs_sent CHECK (channel IS NULL OR sent_at IS NOT NULL),
  ADD CONSTRAINT supplier_requests_message_not_blank CHECK (message_text IS NULL OR btrim(message_text) <> '');

-- What was sent is write-once, and a sent request is never deleted ------------
CREATE FUNCTION guard_supplier_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.sent_at IS NOT NULL THEN
      RAISE EXCEPTION 'a sent supplier request cannot be deleted' USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.sent_at IS NOT NULL AND (
       NEW.message_text IS DISTINCT FROM OLD.message_text
    OR NEW.sent_at      IS DISTINCT FROM OLD.sent_at
    OR NEW.sent_by_id   IS DISTINCT FROM OLD.sent_by_id
    OR NEW.channel      IS DISTINCT FROM OLD.channel) THEN
    RAISE EXCEPTION 'supplier_requests: the sent message, time and channel are write-once' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER supplier_requests_guard
  BEFORE UPDATE OR DELETE ON supplier_requests FOR EACH ROW EXECUTE FUNCTION guard_supplier_request();

-- A reply must come from the supplier the request was sent to ----------------
CREATE FUNCTION guard_broadcast_request_supplier() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.supplier_request_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM supplier_requests r WHERE r.id = NEW.supplier_request_id AND r.supplier_id = NEW.supplier_id) THEN
    RAISE EXCEPTION 'a reply must be from the supplier the request was sent to' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER broadcasts_request_supplier_guard
  BEFORE INSERT OR UPDATE OF supplier_id, supplier_request_id ON broadcasts FOR EACH ROW EXECUTE FUNCTION guard_broadcast_request_supplier();
```

- [ ] **Step 5: Apply it (additive, not destructive).**

Run: `npx prisma migrate dev`
Expected: applies `supplier_requests`, regenerates the client, no reset prompt. Then run `npx prisma migrate status`; expected: "Database schema is up to date".

- [ ] **Step 6: Check the guards against the project database, inside a transaction that is rolled back** (nothing is left behind). Create `<scratchpad>/check-supplier-requests.mjs`:

```js
import pg from "file:///E:/business-intelligence/node_modules/pg/lib/index.js";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query("BEGIN");

const first = async (sql) => (await client.query(sql)).rows[0];
const enquiry = await first("SELECT id FROM enquiries LIMIT 1");
const suppliers = (await client.query("SELECT id FROM suppliers ORDER BY created_at LIMIT 2")).rows;
const user = await first("SELECT id FROM users LIMIT 1");

if (!enquiry || suppliers.length < 2 || !user) {
  console.log("Needs one enquiry, two suppliers and a user in the project database. Skipped; the browser check in Task 7 covers it.");
} else {
  const [a, b] = suppliers;
  const expectRejected = async (label, sql, params) => {
    await client.query("SAVEPOINT s");
    try {
      await client.query(sql, params);
      console.log(`FAIL - accepted: ${label}`);
    } catch (error) {
      console.log(`ok   - rejected: ${label} (${error.message})`);
    }
    await client.query("ROLLBACK TO SAVEPOINT s");
  };
  const insert = `INSERT INTO supplier_requests (id, enquiry_id, supplier_id, status, sent_at, message_text, sent_by_id, channel, created_by_id, updated_at)
                  VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, now()) RETURNING id`;

  await expectRejected("sent_at without a message", insert, [enquiry.id, a.id, "SENT", new Date(), null, user.id, "EMAIL", user.id]);
  await expectRejected("SENT without sent_at", insert, [enquiry.id, a.id, "SENT", null, null, null, null, user.id]);

  const sent = (await client.query(insert, [enquiry.id, a.id, "SENT", new Date(), "TEST hello", user.id, "EMAIL", user.id])).rows[0];
  await expectRejected("editing the sent message", "UPDATE supplier_requests SET message_text = 'changed' WHERE id = $1", [sent.id]);
  await expectRejected("deleting a sent request", "DELETE FROM supplier_requests WHERE id = $1", [sent.id]);
  await expectRejected("a second request for the same supplier", insert, [enquiry.id, a.id, "DRAFT", null, null, null, null, user.id]);

  const evidence = (await client.query(
    "INSERT INTO evidence_sources (id, kind, channel, raw_text, content_hash, observed_at, created_by_id) VALUES (gen_random_uuid(), 'SUPPLIER_BROADCAST', 'MANUAL_PASTE', 'TEST', 'test', now(), $1) RETURNING id", [user.id])).rows[0];
  const broadcast = "INSERT INTO broadcasts (id, evidence_source_id, supplier_id, supplier_request_id, created_by_id, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, now())";
  await expectRejected("a reply from a different supplier", broadcast, [evidence.id, b.id, sent.id, user.id]);
  await client.query(broadcast, [evidence.id, a.id, sent.id, user.id]);
  console.log("ok   - accepted: a reply from the same supplier");
}

await client.query("ROLLBACK");
await client.end();
```

Run: `node --env-file=E:\business-intelligence\.env <scratchpad>\check-supplier-requests.mjs`
Expected: five `rejected` lines and one `accepted` line (or the "Skipped" message if the database lacks the rows). Any `FAIL` line means a guard is wrong: fix the migration SQL by dropping and recreating **only the new** objects in a follow-up migration, never by editing an applied one.

- [ ] **Step 7: Verify the build state.** Run `npm run typecheck`. Expected: clean. Restart the dev server (`npm run dev`) so it loads the new client.

---

### Task 2: Audit vocabulary, labels and the status pill

**Files:**
- Modify: `src/modules/audit/types.ts`, `src/modules/audit/describe.ts`, `src/lib/labels.ts`, `src/components/application/status-badges.tsx`, `src/modules/enquiries/shared.ts`

**Interfaces:**
- Produces: audit entity type `"SupplierRequest"`; audit actions `supplier_request.added | removed | sent | status_changed`; `SUPPLIER_REQUEST_STATUS_LABEL`; `<SupplierRequestStatusPill status />`; `enquiryReference(number: number): string`.

- [ ] **Step 1: `src/modules/audit/types.ts`.** Add `"SupplierRequest",` after `"EnquiryItem",` in `AUDIT_ENTITY_TYPES`, and add to the `AuditAction` union (before the `email_account.created` line):

```ts
  | "supplier_request.added"
  | "supplier_request.removed"
  | "supplier_request.sent"
  | "supplier_request.status_changed"
```

- [ ] **Step 2: `src/modules/audit/describe.ts`.** In `AUDIT_ACTION_LABEL` add after `"enquiry_item.reopened"`:

```ts
  "supplier_request.added": "Supplier added to sourcing",
  "supplier_request.removed": "Supplier removed from sourcing",
  "supplier_request.sent": "Request sent to supplier",
  "supplier_request.status_changed": "Supplier request status changed",
```

- [ ] **Step 3: `src/lib/labels.ts`.** Add `SupplierRequestStatus` to the type import from `"../generated/prisma/enums"`, then after `ENQUIRY_PRIORITY_LABEL`:

```ts
export const SUPPLIER_REQUEST_STATUS_LABEL: Record<SupplierRequestStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  REPLIED: "Replied",
  NO_STOCK: "No stock",
  DECLINED: "Declined",
};
```

- [ ] **Step 4: `src/components/application/status-badges.tsx`.** Add `SupplierRequestStatus` to the enums import and `SUPPLIER_REQUEST_STATUS_LABEL` to the labels import, then after `EmailBandPill`:

```tsx
/** Waiting (sent, no reply yet) is violet; a reply is green; the two "not this time" outcomes are quiet. */
export const SUPPLIER_REQUEST_TONE: Record<SupplierRequestStatus, PillTone> = { DRAFT: "neutral", SENT: "violet", REPLIED: "green", NO_STOCK: "rose", DECLINED: "neutral" };

export function SupplierRequestStatusPill({ status }: { status: SupplierRequestStatus }) {
  return (
    <SoftPill tone={SUPPLIER_REQUEST_TONE[status]} dot={status !== "DRAFT"}>
      {SUPPLIER_REQUEST_STATUS_LABEL[status]}
    </SoftPill>
  );
}
```

- [ ] **Step 5: `src/modules/enquiries/shared.ts`.** Append:

```ts
/** The human reference shown for an enquiry, e.g. ENQ-00012. */
export const enquiryReference = (number: number): string => `ENQ-${String(number).padStart(5, "0")}`;
```

- [ ] **Step 6: Verify.** Run `npm run typecheck`. Expected: clean.

---

### Task 3: The request message (pure)

**Files:**
- Create: `src/modules/sourcing/message.ts`

**Interfaces:**
- Produces: `type RequestLine`, `lineTitle(line)`, `describeLine(line)`, `buildRequestMessage({ contactName, lines }) -> { subject, body }`, `composeSentText(subject, body) -> string`. The input type has **no customer field**, so customer data cannot reach the text.

- [ ] **Step 1: Create the file.**

```ts
/**
 * The text a buyer sends a supplier. Pure and deterministic: no I/O, no customer data. The input type has no customer field on purpose,
 * so the customer's name, email and enquiry reference cannot reach the message. A requirement's own wording is copied from the customer's
 * request, so the buyer still reads the text before sending it (the message drawer says so).
 */

export type RequestLine = {
  description: string | null;
  brandText: string | null;
  modelText: string | null;
  partNumber: string | null;
  specText: string | null;
  quantity: number | null;
};

export type RequestMessage = { subject: string; body: string };

const includesText = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.toLowerCase());

/** What is being asked for, as one label. Parts that are unknown are left out, never invented. */
export function lineTitle(line: RequestLine): string {
  return line.description?.trim() || [line.brandText, line.modelText].filter(Boolean).join(" ").trim() || line.partNumber?.trim() || "Item";
}

/** "Dell Latitude 5440 i7 16/512 - P/N 83A100SUAK - Qty: 50". Unknown quantity reads "to be confirmed". */
export function describeLine(line: RequestLine): string {
  const title = lineTitle(line);
  const extras = [
    line.modelText && !includesText(title, line.modelText) ? `Model ${line.modelText}` : null,
    line.partNumber && !includesText(title, line.partNumber) ? `P/N ${line.partNumber}` : null,
    line.specText && !includesText(title, line.specText) ? line.specText : null,
  ].filter((part): part is string => Boolean(part));
  const quantity = line.quantity != null ? `Qty: ${line.quantity.toLocaleString("en-US")}` : "Qty: to be confirmed";
  return [title, ...extras, quantity].join(" - ");
}

export function buildRequestMessage(input: { contactName: string | null; lines: readonly RequestLine[] }): RequestMessage {
  const [first, ...rest] = input.lines;
  const subject = first ? `Quotation request: ${lineTitle(first)}${rest.length ? ` +${rest.length} more` : ""}` : "Quotation request";
  const name = input.contactName?.trim();
  const body = [
    name ? `Hello ${name},` : "Hello,",
    "",
    "Could you please quote the following?",
    "",
    ...input.lines.map((line, index) => `${index + 1}. ${describeLine(line)}`),
    "",
    "Please reply with:",
    "- your price per unit, and whether VAT is included",
    "- the quantity you can supply, and whether it is ready stock",
    "- lead time, if it is not ready stock",
    "",
    "Thank you.",
  ].join("\n");
  return { subject, body };
}

/** What is stored when a request is marked sent: the subject line (if there is one), a blank line, then the body. */
export function composeSentText(subject: string | null, body: string): string {
  const trimmed = subject?.trim();
  return trimmed ? `Subject: ${trimmed}\n\n${body}` : body;
}
```

- [ ] **Step 2: Verify.** Run `npm run typecheck`. Then a quick check with a scratch script `<scratchpad>/check-message.ts`, run with `npx tsx <path>` from the project folder:

```ts
import { buildRequestMessage, composeSentText } from "E:/business-intelligence/src/modules/sourcing/message";

const { subject, body } = buildRequestMessage({
  contactName: null,
  lines: [
    { description: "TEST Dell Latitude 5440 i7 16/512", brandText: "Dell", modelText: "5440", partNumber: null, specText: null, quantity: 50 },
    { description: null, brandText: "Lenovo", modelText: "T14", partNumber: "20W000ABCD", specText: "i5 8/256", quantity: null },
  ],
});
console.log(subject);
console.log(body);
console.log(composeSentText(subject, body).split("\n")[0]);
```

Expected: subject `Quotation request: TEST Dell Latitude 5440 i7 16/512 +1 more`; body starts `Hello,`; line 2 reads `Lenovo T14 - P/N 20W000ABCD - i5 8/256 - Qty: to be confirmed`; the composed text starts with `Subject: `.

---

### Task 4: Sourcing service, schemas, queries and actions

**Files:**
- Create: `src/modules/sourcing/schemas.ts`, `src/modules/sourcing/service.ts`, `src/modules/sourcing/queries.ts`, `src/modules/sourcing/actions.ts`
- Modify: `src/modules/enquiries/queries.ts` (`getEnquiry`)

**Interfaces:**
- Consumes: `enquiryScope`, `requireNotArchived`, `touchEnquiry` from `../enquiries/shared`; `writeAudit`; `inTransaction`, `ServiceContext`; `getProductsIntelligence`.
- Produces:
  - Services: `addSupplierRequest(ctx, RequestAddInput)`, `removeSupplierRequest(ctx, RequestIdInput) -> { id, enquiryId }`, `markRequestSent(ctx, { id, messageText, channel, sentAt: Date })`, `setRequestOutcome(ctx, RequestOutcomeInput)`, `reopenRequest(ctx, RequestIdInput)`, and the reply hooks `assertRequestAcceptsReply(c, requestId, supplierId)` and `markRequestReplied(c, requestId, broadcastId)`.
  - Queries: `listRequestsForEnquiry(enquiryId)`, `SupplierRequestRow`, `getSupplierSuggestions(enquiryId)`, `SupplierSuggestion`, `getRequestForReply(requestId)`.
  - Actions: `addSupplierRequestAction`, `removeSupplierRequestAction`, `markRequestSentAction`, `setRequestOutcomeAction`, `reopenRequestAction` (all `(prev, formData) => Promise<ActionResult<{ id: string }>>`).

- [ ] **Step 1: `src/modules/sourcing/schemas.ts`.**

```ts
import { z } from "zod";
import { optionalText, optionalUuid } from "../../core/validation/fields";
import { PreferredChannel } from "../../generated/prisma/enums";

const values = <T extends string>(obj: Record<string, T>) => Object.values(obj) as [T, ...T[]];

export const MAX_REQUEST_TEXT = 10_000;

export const requestAddSchema = z.object({
  enquiryId: z.uuid(),
  supplierId: z.uuid("Choose a supplier"),
  contactId: optionalUuid("Choose a valid contact"),
});

export const requestIdSchema = z.object({ id: z.uuid() });

/** The subject and body are kept separate in the form and stored together (see `composeSentText`). */
export const requestSentSchema = z.object({
  id: z.uuid(),
  subject: optionalText(300),
  body: z
    .string({ error: "Enter the message" })
    .refine((v) => v.trim().length > 0, "Enter the message")
    .refine((v) => v.length <= MAX_REQUEST_TEXT, `The message is too long (maximum ${MAX_REQUEST_TEXT.toLocaleString("en-US")} characters)`),
  channel: z.enum(values(PreferredChannel), { error: "Choose how it was sent" }),
  /** datetime-local text in the business timezone; converted to a UTC instant by the action. */
  sentAt: z.string().min(1, "Enter when it was sent"),
});

export const requestOutcomeSchema = z.object({
  id: z.uuid(),
  status: z.enum(["NO_STOCK", "DECLINED"], { error: "Choose No stock or Declined" }),
  note: optionalText(500),
});

export type RequestAddInput = z.output<typeof requestAddSchema>;
export type RequestIdInput = z.output<typeof requestIdSchema>;
export type RequestSentInput = z.output<typeof requestSentSchema>;
export type RequestOutcomeInput = z.output<typeof requestOutcomeSchema>;
```

- [ ] **Step 2: `src/modules/sourcing/service.ts`.**

```ts
import { ConflictError, InvariantError, NotFoundError, ValidationError, uniqueViolation } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import type { PreferredChannel } from "../../generated/prisma/enums";
import { writeAudit } from "../audit/service";
import { enquiryScope, requireNotArchived, touchEnquiry } from "../enquiries/shared";
import type { RequestAddInput, RequestIdInput, RequestOutcomeInput } from "./schemas";

/**
 * Sourcing requests: "we asked this supplier about this enquiry". The app prepares the text; a person sends it and presses Mark sent.
 * Nothing here creates observations: a reply is a broadcast (see broadcasts/service.ts), reviewed and confirmed as usual. Every change
 * is audited in the same transaction, scoped to the enquiry so it shows on the enquiry's Activity timeline.
 */

async function loadRequest(c: ServiceContext, id: string) {
  const request = await c.db.supplierRequest.findUnique({
    where: { id },
    include: { supplier: { select: { id: true, name: true } }, enquiry: { select: { id: true, archivedAt: true } } },
  });
  if (!request) throw new NotFoundError("Request");
  requireNotArchived(request.enquiry);
  return request;
}

// ───────────────────────────────────────── add / remove ─────────────────────────────────────────

export async function addSupplierRequest(ctx: ServiceContext, input: RequestAddInput) {
  return inTransaction(ctx, async (c) => {
    const enquiry = await c.db.enquiry.findUnique({ where: { id: input.enquiryId }, select: { id: true, archivedAt: true } });
    if (!enquiry) throw new NotFoundError("Enquiry");
    requireNotArchived(enquiry);

    const confirmed = await c.db.enquiryItem.count({ where: { enquiryId: enquiry.id, reviewStatus: "CONFIRMED" } });
    if (confirmed === 0) throw new InvariantError("Confirm at least one requirement before asking suppliers.");

    const supplier = await c.db.supplier.findUnique({ where: { id: input.supplierId }, select: { id: true, name: true, status: true } });
    if (!supplier) throw new NotFoundError("Supplier");
    if (supplier.status !== "ACTIVE") throw new ValidationError("That supplier is not active.", { supplierId: "Choose an active supplier" });

    let contactName: string | null = null;
    if (input.contactId) {
      const contact = await c.db.supplierContact.findUnique({ where: { id: input.contactId }, select: { name: true, supplierId: true, status: true } });
      if (!contact || contact.supplierId !== supplier.id) throw new ValidationError("That contact does not belong to this supplier.", { contactId: "Choose a contact of this supplier" });
      if (contact.status === "ARCHIVED") throw new ValidationError("That contact is archived.", { contactId: "Archived" });
      contactName = contact.name;
    }

    const request = await c.db.supplierRequest
      .create({ data: { enquiryId: enquiry.id, supplierId: supplier.id, contactId: input.contactId, createdById: ctx.actor.id } })
      .catch((error: unknown) => {
        if (uniqueViolation(error)) throw new ConflictError(`${supplier.name} is already on this enquiry.`, { supplierId: "Already added" });
        throw error;
      });

    await writeAudit(c, {
      action: "supplier_request.added",
      entityType: "SupplierRequest",
      entityId: request.id,
      scope: enquiryScope(enquiry.id),
      details: { supplier: supplier.name, contact: contactName },
    });
    await touchEnquiry(c, enquiry.id);
    return request;
  });
}

/** Only a request that has not been sent. A sent request stays (it is a record of what was asked). */
export async function removeSupplierRequest(ctx: ServiceContext, input: RequestIdInput) {
  return inTransaction(ctx, async (c) => {
    const request = await loadRequest(c, input.id);
    if (request.status !== "DRAFT") throw new InvariantError("Only a request that has not been sent can be removed.");

    await c.db.supplierRequest.delete({ where: { id: request.id } });
    await writeAudit(c, {
      action: "supplier_request.removed",
      entityType: "SupplierRequest",
      entityId: request.id,
      scope: enquiryScope(request.enquiryId),
      details: { supplier: request.supplier.name },
    });
    await touchEnquiry(c, request.enquiryId);
    return { id: request.id, enquiryId: request.enquiryId };
  });
}

// ───────────────────────────────────────── sent / outcome ─────────────────────────────────────────

export type MarkSentServiceInput = { id: string; messageText: string; channel: PreferredChannel; sentAt: Date };

/** DRAFT -> SENT. Stores the exact text, channel and time; the database then refuses to change them. */
export async function markRequestSent(ctx: ServiceContext, input: MarkSentServiceInput) {
  return inTransaction(ctx, async (c) => {
    const request = await loadRequest(c, input.id);
    if (request.status !== "DRAFT") throw new InvariantError("This request was already sent.");
    if (input.sentAt.getTime() > Date.now() + 5 * 60_000) throw new ValidationError("It cannot have been sent in the future.", { sentAt: "In the future" });

    const updated = await c.db.supplierRequest.update({
      where: { id: request.id },
      data: { status: "SENT", channel: input.channel, messageText: input.messageText, sentAt: input.sentAt, sentById: ctx.actor.id },
    });
    await writeAudit(c, {
      action: "supplier_request.sent",
      entityType: "SupplierRequest",
      entityId: request.id,
      scope: enquiryScope(request.enquiryId),
      details: { supplier: request.supplier.name, channel: input.channel, sentAt: input.sentAt.toISOString() },
    });
    await touchEnquiry(c, request.enquiryId);
    return updated;
  });
}

/** A person records "no stock" or "declined" (for example after a phone call). It creates no observation; only a confirmed reply line does. */
export async function setRequestOutcome(ctx: ServiceContext, input: RequestOutcomeInput) {
  return inTransaction(ctx, async (c) => {
    const request = await loadRequest(c, input.id);
    if (request.status !== "DRAFT" && request.status !== "SENT") throw new InvariantError("Only a request that is still open can be marked this way.");

    const updated = await c.db.supplierRequest.update({ where: { id: request.id }, data: { status: input.status, note: input.note ?? request.note } });
    await writeAudit(c, {
      action: "supplier_request.status_changed",
      entityType: "SupplierRequest",
      entityId: request.id,
      scope: enquiryScope(request.enquiryId),
      details: { supplier: request.supplier.name, status: { from: request.status, to: input.status }, note: input.note },
    });
    await touchEnquiry(c, request.enquiryId);
    return updated;
  });
}

/** NO_STOCK / DECLINED back to SENT (or DRAFT if it was never sent). REPLIED is only ever set by recording a reply. */
export async function reopenRequest(ctx: ServiceContext, input: RequestIdInput) {
  return inTransaction(ctx, async (c) => {
    const request = await loadRequest(c, input.id);
    if (request.status !== "NO_STOCK" && request.status !== "DECLINED") throw new InvariantError("Only a request marked No stock or Declined can be reopened.");

    const to = request.sentAt ? "SENT" : "DRAFT";
    const updated = await c.db.supplierRequest.update({ where: { id: request.id }, data: { status: to } });
    await writeAudit(c, {
      action: "supplier_request.status_changed",
      entityType: "SupplierRequest",
      entityId: request.id,
      scope: enquiryScope(request.enquiryId),
      details: { supplier: request.supplier.name, status: { from: request.status, to } },
    });
    await touchEnquiry(c, request.enquiryId);
    return updated;
  });
}

// ───────────────────────────────────────── replies (called by broadcasts/service.ts) ─────────────────────────────────────────

/** Before the reply broadcast is created: the request exists, its enquiry is not archived, and it is for the same supplier. */
export async function assertRequestAcceptsReply(c: ServiceContext, requestId: string, supplierId: string): Promise<void> {
  const request = await c.db.supplierRequest.findUnique({ where: { id: requestId }, select: { supplierId: true, enquiry: { select: { archivedAt: true } } } });
  if (!request) throw new NotFoundError("Request");
  if (request.supplierId !== supplierId) {
    throw new ValidationError("This reply is linked to a request for another supplier. Keep the supplier the request was sent to.", { supplierId: "Not the supplier this request was sent to" });
  }
  requireNotArchived(request.enquiry);
}

/** Right after the reply broadcast is created, in the same transaction: the request becomes REPLIED (a second reply changes nothing). */
export async function markRequestReplied(c: ServiceContext, requestId: string, broadcastId: string): Promise<void> {
  const request = await c.db.supplierRequest.findUniqueOrThrow({ where: { id: requestId }, select: { id: true, status: true, enquiryId: true, supplier: { select: { name: true } } } });
  if (request.status !== "REPLIED") {
    await c.db.supplierRequest.update({ where: { id: requestId }, data: { status: "REPLIED" } });
    await writeAudit(c, {
      action: "supplier_request.status_changed",
      entityType: "SupplierRequest",
      entityId: requestId,
      scope: enquiryScope(request.enquiryId),
      details: { supplier: request.supplier.name, status: { from: request.status, to: "REPLIED" }, reply: broadcastId },
    });
  }
  await touchEnquiry(c, request.enquiryId);
}
```

- [ ] **Step 3: `src/modules/sourcing/queries.ts`.**

```ts
import { db } from "../../core/database/client";
import { normalizeName } from "../../lib/normalize";
import { getProductsIntelligence, type SupplierIntelligenceRow } from "../observations/procurement-queries";

/** Everything the Sourcing tab shows for an enquiry's requests. */
export async function listRequestsForEnquiry(enquiryId: string) {
  return db.supplierRequest.findMany({
    where: { enquiryId },
    orderBy: { createdAt: "asc" },
    include: {
      supplier: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      sentBy: { select: { name: true } },
      replies: {
        orderBy: { createdAt: "desc" },
        select: { id: true, archivedAt: true, evidenceSource: { select: { observedAt: true } }, _count: { select: { items: true } } },
      },
    },
  });
}

export type SupplierRequestRow = Awaited<ReturnType<typeof listRequestsForEnquiry>>[number];

export type SupplierSuggestion = { supplierId: string; name: string; reasons: string[]; latestObservedAt: Date | null };

/**
 * Who could be asked, for the enquiry's CONFIRMED requirements: suppliers with a latest price or stock for a linked product (freshest first),
 * then active suppliers who handle the requirement's brand. Suppliers already on the enquiry are left out. Read-only; nothing is stored.
 */
export async function getSupplierSuggestions(enquiryId: string, limit = 12): Promise<SupplierSuggestion[]> {
  const [items, asked] = await Promise.all([
    db.enquiryItem.findMany({ where: { enquiryId, reviewStatus: "CONFIRMED" }, select: { productId: true, brandText: true, product: { select: { brandId: true } } } }),
    db.supplierRequest.findMany({ where: { enquiryId }, select: { supplierId: true } }),
  ]);
  const alreadyAsked = new Set(asked.map((r) => r.supplierId));
  const suggestions = new Map<string, SupplierSuggestion>();

  const productIds = [...new Set(items.map((i) => i.productId).filter((id): id is string => Boolean(id)))];
  const offers: Map<string, SupplierIntelligenceRow[]> = productIds.length ? await getProductsIntelligence(productIds) : new Map();
  for (const rows of offers.values()) {
    for (const row of rows) {
      if (alreadyAsked.has(row.supplierId)) continue;
      const current = suggestions.get(row.supplierId) ?? { supplierId: row.supplierId, name: row.supplierName, reasons: ["has a price or stock on record"], latestObservedAt: null };
      if (!current.latestObservedAt || row.latestObservedAt > current.latestObservedAt) current.latestObservedAt = row.latestObservedAt;
      suggestions.set(row.supplierId, current);
    }
  }

  const brandIds = new Set(items.map((i) => i.product?.brandId).filter((id): id is string => Boolean(id)));
  const brandTexts = [...new Set(items.filter((i) => !i.product?.brandId && i.brandText).map((i) => normalizeName(i.brandText as string)))];
  if (brandTexts.length) {
    for (const brand of await db.brand.findMany({ where: { normalizedName: { in: brandTexts } }, select: { id: true } })) brandIds.add(brand.id);
  }
  if (brandIds.size) {
    const ids = [...brandIds];
    const covering = await db.supplier.findMany({
      where: { status: "ACTIVE", brands: { some: { brandId: { in: ids } } } },
      select: { id: true, name: true, brands: { where: { brandId: { in: ids } }, select: { brand: { select: { name: true } } } } },
    });
    for (const supplier of covering) {
      if (alreadyAsked.has(supplier.id)) continue;
      const current = suggestions.get(supplier.id) ?? { supplierId: supplier.id, name: supplier.name, reasons: [], latestObservedAt: null };
      current.reasons.push(`handles ${supplier.brands.map((b) => b.brand.name).join(", ")}`);
      suggestions.set(supplier.id, current);
    }
  }

  return [...suggestions.values()]
    .sort((a, b) => (b.latestObservedAt?.getTime() ?? 0) - (a.latestObservedAt?.getTime() ?? 0) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** The request behind `/broadcasts/new?request=`: enough to pre-fill the reply form and show what it is a reply to. */
export async function getRequestForReply(requestId: string) {
  return db.supplierRequest.findUnique({
    where: { id: requestId },
    select: { id: true, supplierId: true, contactId: true, supplier: { select: { name: true } }, enquiry: { select: { id: true, number: true, archivedAt: true } } },
  });
}
```

- [ ] **Step 4: `getEnquiry` returns the request count.** In `src/modules/enquiries/queries.ts`, inside `getEnquiry`'s `include`, after the `items` entry add:

```ts
      _count: { select: { supplierRequests: true } },
```

- [ ] **Step 5: `src/modules/sourcing/actions.ts`.**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { ValidationError } from "@/core/errors";
import { getServiceContext } from "@/core/permissions/actor";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { formDataToObject } from "@/core/validation/form-data";
import { zonedInputToUtc } from "@/lib/format";
import { composeSentText } from "./message";
import { requestAddSchema, requestIdSchema, requestOutcomeSchema, requestSentSchema } from "./schemas";
import { addSupplierRequest, markRequestSent, removeSupplierRequest, reopenRequest, setRequestOutcome } from "./service";

/** Thin server actions for the Sourcing tab: FormData -> zod -> service -> revalidate -> ActionResult. Rules live in service.ts. */
type IdResult = ActionResult<{ id: string }>;

function refresh(enquiryId: string) {
  revalidatePath(`/enquiries/${enquiryId}`);
  revalidatePath("/enquiries");
}

export async function addSupplierRequestAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const request = await addSupplierRequest(await getServiceContext(), requestAddSchema.parse(formDataToObject(formData)));
      refresh(request.enquiryId);
      return { id: request.id };
    },
    { successMessage: "Supplier added", formData },
  );
}

export async function removeSupplierRequestAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const removed = await removeSupplierRequest(await getServiceContext(), requestIdSchema.parse(formDataToObject(formData)));
      refresh(removed.enquiryId);
      return { id: removed.id };
    },
    { successMessage: "Supplier removed", formData },
  );
}

export async function markRequestSentAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = requestSentSchema.parse(formDataToObject(formData));
      const sentAt = zonedInputToUtc(input.sentAt);
      if (!sentAt) throw new ValidationError("Enter a valid date and time.", { sentAt: "Not a valid date and time" });
      const request = await markRequestSent(await getServiceContext(), {
        id: input.id,
        messageText: composeSentText(input.subject, input.body),
        channel: input.channel,
        sentAt,
      });
      refresh(request.enquiryId);
      return { id: request.id };
    },
    { successMessage: "Marked as sent", formData },
  );
}

export async function setRequestOutcomeAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const request = await setRequestOutcome(await getServiceContext(), requestOutcomeSchema.parse(formDataToObject(formData)));
      refresh(request.enquiryId);
      return { id: request.id };
    },
    { successMessage: "Request updated", formData },
  );
}

export async function reopenRequestAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const request = await reopenRequest(await getServiceContext(), requestIdSchema.parse(formDataToObject(formData)));
      refresh(request.enquiryId);
      return { id: request.id };
    },
    { successMessage: "Request reopened", formData },
  );
}
```

- [ ] **Step 6: Verify.** Run `npm run typecheck` and `npm run lint`. Expected: clean. Then a scratch script `<scratchpad>/check-sourcing-service.ts` (run with `npx tsx`) that, against the project database, picks an existing **TEST** enquiry that has a confirmed requirement and a **TEST** supplier (create them through the app first, Task 7 step 1), then calls `addSupplierRequest`, `markRequestSent`, `setRequestOutcome`, `reopenRequest`, `removeSupplierRequest` in order with `{ actor, db }` from `src/core/permissions/actor` (`getServiceContext` needs a request scope, so build the context from `db` and the first active user instead) and prints each status; expected sequence `DRAFT -> SENT`, then a second `markRequestSent` throws "already sent", then `NO_STOCK`, `SENT`, and `removeSupplierRequest` on the sent one throws. Leave the request in place if it is `SENT` (it cannot be removed; it is labelled by its TEST supplier).

---

### Task 5: A reply is a broadcast linked to the request

**Files:**
- Modify: `src/modules/broadcasts/schemas.ts`, `src/modules/broadcasts/service.ts`, `src/modules/broadcasts/actions.ts`, `src/modules/broadcasts/queries.ts`, `src/modules/broadcasts/components/broadcast-form.tsx`, `src/app/(workspace)/broadcasts/new/page.tsx`, `src/app/(workspace)/broadcasts/[id]/page.tsx`

**Interfaces:**
- Consumes: `assertRequestAcceptsReply`, `markRequestReplied` (Task 4), `getRequestForReply` (Task 4), `enquiryReference` (Task 2).
- Produces: `createBroadcast(ctx, { ..., supplierRequestId: string | null })`; `getBroadcast(id)` also returns `supplierRequest: { id, enquiry: { id, number } } | null`; `<BroadcastForm request={{ id, enquiryId, enquiryRef }} />`.

- [ ] **Step 1: `schemas.ts`.** In `broadcastCreateSchema` add after `allowDuplicate: checkbox(),`:

```ts
  /** Set when this message is a supplier's reply to a sourcing request. */
  supplierRequestId: optionalUuid("Invalid request"),
```

- [ ] **Step 2: `service.ts`.** Add the import `import { assertRequestAcceptsReply, markRequestReplied } from "../sourcing/service";`. Add `supplierRequestId: string | null` to the input type of `createBroadcast` (after `allowDuplicate: boolean`). After the contact check and before the duplicate check add:

```ts
    if (input.supplierRequestId) await assertRequestAcceptsReply(c, input.supplierRequestId, supplier.id);
```

Add `supplierRequestId: input.supplierRequestId,` to the `data` of `c.db.broadcast.create`, add `request: input.supplierRequestId` to the audit `details`, and after the audit write (before `return`) add:

```ts
    if (input.supplierRequestId) await markRequestReplied(c, input.supplierRequestId, broadcast.id);
```

- [ ] **Step 3: `actions.ts`.** In `createBroadcastAction` pass `supplierRequestId: input.supplierRequestId,` after `allowDuplicate`. (The action already revalidates the whole layout.)

- [ ] **Step 4: `queries.ts`.** In `getBroadcast`'s `include` add:

```ts
      supplierRequest: { select: { id: true, enquiry: { select: { id: true, number: true } } } },
```

- [ ] **Step 5: `broadcast-form.tsx`.** Add a prop and the hidden field. New prop type member and destructure `request`:

```tsx
  request,
}: {
  ...
  /** When set, this message is the reply to a sourcing request and is linked to it on save. */
  request?: { id: string; enquiryId: string; enquiryRef: string } | null;
```

At the top of the form, right after `<FormMessage state={state} />`:

```tsx
      {request ? (
        <>
          <input type="hidden" name="supplierRequestId" value={request.id} />
          <Alert variant="info" className="px-3 py-2 text-xs">
            This is the reply to the request on <span className="font-medium">{request.enquiryRef}</span>. Keep the supplier as it is; the reply is linked to that request when you save.
          </Alert>
        </>
      ) : null}
```

Change the Cancel link to `href={request ? `/enquiries/${request.enquiryId}?view=sourcing` : "/broadcasts"}`. (If `Alert` has no `info` variant in `components/ui/alert.tsx`, use the variant that exists for a neutral notice; check the file.)

- [ ] **Step 6: `broadcasts/new/page.tsx`.** Add imports `getRequestForReply` (`@/modules/sourcing/queries`) and `enquiryReference` (`@/modules/enquiries/shared`). After `const requested = ...` add:

```tsx
  const requestParam = firstParam(searchParams, "request");
  const linked = requestParam && z.uuid().safeParse(requestParam).success ? await getRequestForReply(requestParam) : null;
  const request = linked && !linked.enquiry.archivedAt ? { id: linked.id, enquiryId: linked.enquiry.id, enquiryRef: enquiryReference(linked.enquiry.number) } : null;
```

and make the default supplier the request's: `const defaultSupplierId = linked && request ? linked.supplierId : requested && ... ? requested : null;` (keep the existing expression as the fallback). Pass `request={request}` to `<BroadcastForm />`. Update the subtitle when `request` is set: `Paste the supplier's reply to the request on ${request.enquiryRef}.`

- [ ] **Step 7: `broadcasts/[id]/page.tsx`.** Add imports `SoftPill` is already imported; add `enquiryReference` from `@/modules/enquiries/shared`. In the `meta` fragment add, before the pending pill:

```tsx
            {broadcast.supplierRequest ? (
              <Link href={`/enquiries/${broadcast.supplierRequest.enquiry.id}?view=sourcing`}>
                <SoftPill tone="violet">Reply to {enquiryReference(broadcast.supplierRequest.enquiry.number)}</SoftPill>
              </Link>
            ) : null}
```

- [ ] **Step 7b: Verify.** Run `npm run typecheck` and `npm run lint`. Expected: clean. Load `/broadcasts/new` (unchanged when there is no `?request=`) and confirm a normal broadcast still saves (use a **TEST** supplier and a short TEST message), so the existing flow is not broken.

---

### Task 6: The Sourcing tab

**Files:**
- Create: `src/modules/sourcing/components/sourcing-tab.tsx`, `add-supplier-form.tsx`, `message-drawer.tsx`, `request-actions.tsx`
- Modify: `src/app/(workspace)/enquiries/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 3 (`buildRequestMessage`), Task 4 (queries, actions), Task 2 (`SupplierRequestStatusPill`, `enquiryReference`), `EnquiryDetail` from `@/modules/enquiries/queries`, `listSupplierOptions` and `listContactOptions` from `@/modules/suppliers/queries`.
- Produces: `<SourcingTab enquiry={EnquiryDetail} />` (async server component).

- [ ] **Step 1: Read the patterns first.** Skim `src/components/ui/alert.tsx` (variants), `src/components/data-table/table-shell.tsx`, `src/components/application/states.tsx` (`EmptyState`) and `src/components/application/panel-tabs.tsx` so the new components use what exists. Table rows use `className="h-auto py-2"` on cells like `observations/components/offers.tsx`.

- [ ] **Step 2: `add-supplier-form.tsx`** (client; mirrors `broadcast-form.tsx`):

```tsx
"use client";

import { useActionState, useState } from "react";
import { Combobox } from "@/components/forms/combobox";
import { Field } from "@/components/forms/field";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { FormMessage } from "@/components/forms/form-message";
import type { SelectOption } from "@/components/forms/multi-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, useActionFeedback } from "@/components/forms/use-action-feedback";
import { addSupplierRequestAction } from "../actions";

type ContactOption = SelectOption & { supplierId: string };

/** Pick a supplier (suggested ones first, with the reason) and, optionally, the contact to greet by name. */
export function AddSupplierForm({ enquiryId, suppliers, contacts }: { enquiryId: string; suppliers: SelectOption[]; contacts: ContactOption[] }) {
  const close = useDrawerClose();
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [state, formAction] = useActionState(addSupplierRequestAction, null);
  useActionFeedback(state, close);
  const contactOptions = contacts.filter((c) => c.supplierId === supplierId);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="enquiryId" value={enquiryId} />
      <FormMessage state={state} />
      <Field label="Supplier" htmlFor="sr-supplier" required error={fieldError(state, "supplierId")} hint="Suppliers with a price on record or who handle the brand are listed first.">
        <Combobox id="sr-supplier" name="supplierId" options={suppliers} placeholder="Select a supplier" onValueChange={setSupplierId} />
      </Field>
      <Field label="Contact (optional)" htmlFor="sr-contact" error={fieldError(state, "contactId")} hint="The message greets this person by name.">
        <Combobox
          key={supplierId ?? "none"}
          id="sr-contact"
          name="contactId"
          options={contactOptions}
          placeholder={supplierId ? (contactOptions.length ? "Select a contact" : "No contacts for this supplier") : "Choose a supplier first"}
          disabled={!supplierId || contactOptions.length === 0}
          clearable
        />
      </Field>
      <div className="flex justify-end border-t pt-3">
        <SubmitButton pendingLabel="Adding...">Add supplier</SubmitButton>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: `request-actions.tsx`** (client). Three small components, each a form bound to one action; errors inline, success is a toast via `useActionFeedback`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { removeSupplierRequestAction, reopenRequestAction, setRequestOutcomeAction } from "../actions";

/** Remove a request that has not been sent. */
export function RemoveRequestButton({ id }: { id: string }) {
  const [state, formAction] = useActionState(removeSupplierRequestAction, null);
  useActionFeedback(state);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="ghost" size="xs" pendingLabel="Removing...">
        Remove
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Back to Sent (or Draft) after No stock / Declined. */
export function ReopenRequestButton({ id }: { id: string }) {
  const [state, formAction] = useActionState(reopenRequestAction, null);
  useActionFeedback(state);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="ghost" size="xs" pendingLabel="Reopening...">
        Reopen
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** "No stock" or "Declined", with an optional note. Creates no observation: to keep what they said, record the reply. */
export function OutcomeButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(setRequestOutcomeAction, null);
  useActionFeedback(state, () => setOpen(false));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="xs">
          No stock / Declined
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-xs text-muted-foreground">Nothing is recorded as evidence. If they replied with text worth keeping, use Record reply instead.</p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="id" value={id} />
          <SelectField name="status" allowNone={false} defaultValue="NO_STOCK" options={[{ value: "NO_STOCK", label: "No stock" }, { value: "DECLINED", label: "Declined" }]} />
          <Input name="note" placeholder="Note (optional)" aria-label="Note" />
          <FormMessage state={state} />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingLabel="Saving...">
              Save
            </SubmitButton>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: `message-drawer.tsx`** (client). The drawer for a DRAFT is editable and ends in **Mark sent**; for a sent request it shows the stored text read-only. Copy uses `navigator.clipboard` inside try/catch and shows an inline message if the browser blocks it:

```tsx
"use client";

import { Copy } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { FormDrawer, useDrawerClose } from "@/components/forms/form-drawer";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PREFERRED_CHANNEL_LABEL, toOptions } from "@/lib/labels";
import { markRequestSentAction } from "../actions";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [blocked, setBlocked] = useState(false);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setBlocked(false);
            toast.success(`${label} copied`);
          } catch {
            setBlocked(true);
          }
        }}
      >
        <Copy aria-hidden /> Copy {label.toLowerCase()}
      </Button>
      {blocked ? <span className="text-xs text-danger">The browser blocked copying. Select the text and copy it by hand.</span> : null}
    </span>
  );
}

function SendForm({ id, initialSubject, initialBody, defaultSentAt }: { id: string; initialSubject: string; initialBody: string; defaultSentAt: string }) {
  const close = useDrawerClose();
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [state, formAction] = useActionState(markRequestSentAction, null);
  useActionFeedback(state, close);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        Built from the confirmed requirements. It never includes the customer's name, email or reference, but the requirement wording is copied from the customer's request, so read it before you send.
      </p>
      <Field label="Subject (email)" htmlFor="rq-subject" error={fieldError(state, "subject")}>
        <div className="flex items-start gap-2">
          <Input id="rq-subject" name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <CopyButton text={subject} label="Subject" />
        </div>
      </Field>
      <Field label="Message" htmlFor="rq-body" required error={fieldError(state, "body")}>
        <Textarea id="rq-body" name="body" rows={14} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-xs" />
      </Field>
      <CopyButton text={body} label="Message" />
      <div className="grid grid-cols-2 gap-3 border-t pt-3">
        <Field label="Sent via" htmlFor="rq-channel" required error={fieldError(state, "channel")}>
          <SelectField id="rq-channel" name="channel" allowNone={false} defaultValue="EMAIL" options={toOptions(PREFERRED_CHANNEL_LABEL)} />
        </Field>
        <Field label="Sent at (Dubai time)" htmlFor="rq-sentAt" required error={fieldError(state, "sentAt")}>
          <Input id="rq-sentAt" name="sentAt" type="datetime-local" defaultValue={defaultSentAt} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">Copy it, send it yourself, then press Mark sent. The text, channel and time are locked once saved.</p>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving...">Mark sent</SubmitButton>
      </div>
    </form>
  );
}

export function RequestMessageDrawer({
  request,
  initialSubject,
  initialBody,
  defaultSentAt,
  sentText,
  sentSummary,
}: {
  request: { id: string; supplierName: string; sent: boolean };
  initialSubject: string;
  initialBody: string;
  defaultSentAt: string;
  /** The stored text of a sent request (read-only). */
  sentText: string | null;
  /** "Email, 3 hours ago by Ismail". */
  sentSummary: string | null;
}) {
  return (
    <FormDrawer
      trigger={
        <Button variant={request.sent ? "ghost" : "outline"} size="xs">
          {request.sent ? "View message" : "Prepare message"}
        </Button>
      }
      title={`${request.sent ? "Sent to" : "Request to"} ${request.supplierName}`}
      description={request.sent ? sentSummary ?? undefined : "Copy it, send it from your own email or WhatsApp, then mark it sent."}
    >
      {request.sent && sentText ? (
        <div className="space-y-3">
          <pre className="rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">{sentText}</pre>
          <CopyButton text={sentText} label="Message" />
        </div>
      ) : (
        <SendForm id={request.id} initialSubject={initialSubject} initialBody={initialBody} defaultSentAt={defaultSentAt} />
      )}
    </FormDrawer>
  );
}
```

- [ ] **Step 5: `sourcing-tab.tsx`** (async server component). Content: a summary line, **Add supplier**, a notice when requirements are still pending, and the table. Use these rules exactly:
  - Confirmed requirements = `enquiry.items.filter(i => i.reviewStatus === "CONFIRMED")`; pending count from the same list. With none confirmed and no requests: `EmptyState` titled "Confirm a requirement first" with a link to `/enquiries/${enquiry.id}` (Requirements). **Add supplier** is disabled when archived or nothing is confirmed.
  - Supplier options = every active supplier not already on the enquiry (`listSupplierOptions()` minus `requests`), with suggestions first and labelled `"<name> · <reasons joined by ', '>"`; the rest plain.
  - Summary: `"{n} asked · {waiting} waiting · {replied} replied"` where waiting = status `SENT`.
  - Columns: **Supplier** (link to `/suppliers/[id]`, the contact's name under it), **Status** (`SupplierRequestStatusPill`), **Sent** (`channel · formatRelativeAge(sentAt)` with the full Dubai time in `title`, or "Not sent"), **Reply** (one link per reply to `/broadcasts/[id]`: "Reply · {relative age of observedAt}" plus "(archived)" when archived; empty: "No reply yet"), **Note**, **Actions**.
  - Actions per status: `DRAFT` -> `RequestMessageDrawer` (prepare), `OutcomeButton`, `RemoveRequestButton`. `SENT` -> `RequestMessageDrawer` (view), a **Record reply** button linking to `/broadcasts/new?supplier=${supplierId}&request=${id}`, `OutcomeButton`. `REPLIED` -> view message (only if it was sent), **Record another reply** link. `NO_STOCK` / `DECLINED` -> view message (only if sent), **Record reply** link, `ReopenRequestButton`. When the enquiry is archived every action is hidden and the tab is read-only.
  - The drawer's initial text for a `DRAFT` is `buildRequestMessage({ contactName: request.contact?.name ?? null, lines })` where `lines` are the confirmed items; `defaultSentAt` = `toZonedInputValue(new Date())`; for a sent request `sentText` = `request.messageText` and `sentSummary` = `${PREFERRED_CHANNEL_LABEL[channel]}, ${formatDateTime(sentAt)}, by ${sentBy.name}`.

  Skeleton to complete with the rules above (imports omitted for brevity; use the same UI imports as `offers.tsx`):

```tsx
export async function SourcingTab({ enquiry }: { enquiry: EnquiryDetail }) {
  const [requests, suggestions, supplierOptions, contactOptions] = await Promise.all([
    listRequestsForEnquiry(enquiry.id),
    getSupplierSuggestions(enquiry.id),
    listSupplierOptions(),
    listContactOptions(),
  ]);
  const archived = Boolean(enquiry.archivedAt);
  const confirmed = enquiry.items.filter((i) => i.reviewStatus === "CONFIRMED");
  const pending = enquiry.items.filter((i) => i.reviewStatus === "PENDING").length;
  const askedIds = new Set(requests.map((r) => r.supplier.id));
  const reasonOf = new Map(suggestions.map((s) => [s.supplierId, s.reasons.join(", ")]));
  const suggestedFirst = [...suggestions.map((s) => s.supplierId)];
  const options = [
    ...suggestedFirst.flatMap((id) => supplierOptions.filter((o) => o.value === id)).map((o) => ({ value: o.value, label: `${o.label} · ${reasonOf.get(o.value)}` })),
    ...supplierOptions.filter((o) => !askedIds.has(o.value) && !reasonOf.has(o.value)),
  ];
  // ... summary, notices, empty state, table, and the actions described above
}
```

- [ ] **Step 6: Wire it into the enquiry page.** In `src/app/(workspace)/enquiries/[id]/page.tsx`:
  - Replace `const view = firstParam(searchParams, "view") === "activity" ? "activity" : "items";` with:
    ```tsx
      const viewParam = firstParam(searchParams, "view");
      const view = viewParam === "activity" ? "activity" : viewParam === "sourcing" ? "sourcing" : "items";
    ```
  - In `tabs` insert the Sourcing tab **between** Requirements and Activity: `{ key: "sourcing", label: "Sourcing", count: enquiry._count.supplierRequests },`
  - Change the render to `view === "activity" ? (...) : view === "sourcing" ? <SourcingTab enquiry={enquiry} /> : (...)` and add the import `import { SourcingTab } from "@/modules/sourcing/components/sourcing-tab";`
  - Keep `ReviewKeys` and the rest as they are (the `j` / `k` keys simply find nothing on this tab).

- [ ] **Step 7: Verify.** `npm run typecheck`, `npm run lint`. Load `/enquiries/<id>` and `/enquiries/<id>?view=sourcing` for a **TEST** enquiry; expected: the tab appears between Requirements and Activity, with the count, and the empty state when nothing is confirmed.

---

### Task 7: Verify end to end, update the docs, final build

**Files:**
- Modify: `docs/modules/ENQUIRIES.md`, `docs/architecture/DATA_MODEL.md`, `docs/design/SCREENS.md`, `docs/plans/STABILIZATION.md`, `docs/plans/ROADMAP.md`, `docs/plans/active/CURRENT.md`

- [ ] **Step 1: Manual check in a browser** (Chrome via Playwright from outside the repo, as in the earlier milestones, or by hand), using the project database. Create only what is needed and label it `TEST`: supplier `TEST Supplier A` with one contact `TEST Contact` (in `/suppliers`), and an enquiry pasted at `/enquiries/new` with the text `TEST` on the first line followed by two short requirement lines (for example `TEST Dell Latitude 5440 x 10` and `TEST Lenovo ThinkPad T14 x 5`). Confirm both requirements in the workspace.
  1. **DoD 1:** before confirming, the Sourcing tab shows "Confirm a requirement first"; after confirming, the tab is usable and shows a count of 0.
  2. **DoD 2:** Add supplier (with the TEST contact). Open **Prepare message**: both requirements are listed with quantities, the greeting uses the contact's name, and the text contains **no** customer name, email or `ENQ-` reference. Edit a word, **Copy** works, choose channel, **Mark sent**. Reopen the drawer: the stored text is read-only and equals what was edited. Try to change it another way (a second submit): the service says it was already sent.
  3. **DoD 3:** **Record reply** opens `/broadcasts/new` with the supplier and the "reply to ENQ-…" notice. Paste `TEST Dell Latitude 5440 AED 2450 + VAT 10 pcs ready`, save; the request becomes **Replied**, the broadcast page shows the "Reply to ENQ-…" pill linking back, and after linking a product and confirming the line the enquiry's requirement shows the price and stock under Supplier intelligence with an evidence link.
  4. **DoD 4:** on a second TEST supplier: No stock, then Reopen, then Remove (a Draft); confirm a Sent request has no Remove; archive the enquiry and confirm the tab becomes read-only.
  5. **DoD 5:** the enquiry's **Activity** tab lists: supplier added, request sent, status changed to Replied (with the broadcast created), and the No stock / Reopen / Removed entries.
  Record any console error or failed request; there must be none.

- [ ] **Step 2: Docs.**
  - `docs/architecture/DATA_MODEL.md`: add **section 12, Sourcing requests (2026-09-21)**: the table, the enum, `broadcasts.supplier_request_id`, and the three guards (CHECKs, write-once sent text and no delete, supplier-match trigger), plus the deliberate choices (a reply is a broadcast; one request per supplier per enquiry; no new evidence kind; no stored RFQ status beyond the five).
  - `docs/modules/ENQUIRIES.md`: add a "Sourcing requests" section (flow, rules, what it does not do) and update its "Not built" line.
  - `docs/design/SCREENS.md`: add the **Sourcing** tab of the enquiry workspace and the reply banner on `/broadcasts/new`; update the "Tabs:" sentence of the workspace section.
  - `docs/plans/STABILIZATION.md`: add "Added by the Sourcing Requests milestone": Vitest on `buildRequestMessage` / `composeSentText`; integration on the request service (state changes, archived enquiry, unique per supplier, reply linking); DB guards (`guard_supplier_request`, `guard_broadcast_request_supplier`, the CHECKs); Playwright for the sourcing journey; confirm the customer's name never appears in a generated message for real enquiries.
  - `docs/plans/ROADMAP.md` and `CURRENT.md`: set the Status to "Built and verified 2026-09-21" (or list exactly what was not verified).

- [ ] **Step 3: Final checks.** Stop this project's dev server only (not the `corewai-store` one), then run in order and read every output: `npm run typecheck`, `npm run lint`, `npm run build`, `npx vitest run src/config/navigation.test.ts`. Restart `npm run dev` in the background. Expected: all clean, `/enquiries/[id]` still dynamic, the migration listed as applied by `npx prisma migrate status`.

- [ ] **Step 4: Report** what was verified and what was not (be explicit about anything skipped), and list the `TEST` records that were created so they can be removed.

---

## Self-review

- **Spec coverage:** data (Task 1); audit (2); message rules including no customer data (3); add, remove, sent, outcome, reopen and the reply hooks (4); reply-as-broadcast, the back-link and the notice (5); the tab, suggestions, message drawer, actions, read-only when archived, no new sidebar item (6); the six Definition-of-Done items and the docs list (7). Out-of-scope items appear nowhere in the tasks.
- **Placeholders:** none. Task 6 step 5 gives the exact rules and a code skeleton because the table markup is long and mirrors `offers.tsx`; the executing agent completes it from those rules and must run typecheck and lint before moving on.
- **Consistency:** names used across tasks: `SupplierRequest`, `SupplierRequestStatus`, `supplierRequestId`, `addSupplierRequest`, `removeSupplierRequest`, `markRequestSent`, `setRequestOutcome`, `reopenRequest`, `assertRequestAcceptsReply`, `markRequestReplied`, `listRequestsForEnquiry`, `getSupplierSuggestions`, `getRequestForReply`, `buildRequestMessage`, `composeSentText`, `enquiryReference`, `SupplierRequestStatusPill`, `SUPPLIER_REQUEST_STATUS_LABEL`. The audit actions are the four in `CURRENT.md`.
