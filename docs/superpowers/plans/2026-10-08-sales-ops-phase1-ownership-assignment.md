# Sales Ops Phase 1: Enquiry Ownership & Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Enquiry.assignedToId` a real, admin-only "sales owner" assignment (mirroring the already-built `Customer.ownerId` pattern) that auto-syncs the linked customer's ownership and feeds an "Assigned to me" filter — with zero change to who can see or work any enquiry.

**Architecture:** Extract enquiry-owner assignment out of the general `updateEnquiryHeader` action into its own `assertAdmin`-gated service function, `reassignEnquiryOwner`, exactly mirroring `customers/service.ts`'s `reassignCustomerOwner`. A new `EnquiryOwnerControl` component (mirroring `CustomerOwnerControl`) replaces the field that used to live in the general header-edit form. A new `assignee` filter on the main Enquiries list reuses the pattern already shipped for email triage (`src/modules/email/filters.ts` / `queries.ts`).

**Tech Stack:** Next.js server components/actions, Prisma 7.10, PostgreSQL, TypeScript 5.9, zod — matches the rest of the module, no new dependency.

**Spec:** `docs/superpowers/specs/2026-10-08-sales-operations-design.md`, section 4 ("Phase 1 — Ownership & assignment"). This plan implements that section only; Phases 2-4 (invoice edit/payments, UI pass, KPI dashboard) are later plans per the spec's own sequencing (section 9).

## Global Constraints

- **No automated tests this phase** (CLAUDE.md, development-first rule): every task substitutes the usual "write a failing test" steps with this project's own established pattern — a `TEST`-labelled record or a scratch script against the **project database** (`127.0.0.1:5442`), with exact expected output, plus `tsc`/`eslint` clean as a baseline. Do not create a separate test/scratch database.
- Keep TypeScript and ESLint clean (`npx tsc --noEmit`, `npx eslint <files>`) after every task.
- **Attribution only:** `Enquiry.assignedToId` must never restrict who can see or work an enquiry — no `WHERE assignedToId = ...` is ever added to a visibility check, only to the opt-in `assignee` filter pill.
- **Admin-only assignment:** both the server action and the service function must refuse a non-admin caller; the UI hiding the control from non-admins is not itself the security boundary.
- **Auto-sync only when unowned:** assigning an enquiry's owner sets the linked customer's `ownerId` only when it is currently `NULL`. Never overwrite an existing owner.
- **Audit every write** in the same transaction as the change (`writeAudit`, existing pattern).
- Prisma pinned at 7.10, TypeScript at 5.9 — use existing patterns only, no new packages. No schema or migration changes: `Enquiry.assignedToId` already exists.

## Review Focus

- A non-admin (STAFF) calling `reassignEnquiryOwner` directly must be refused (`ForbiddenError`), even though the UI control is hidden from them — covered in Task 2's verification.
- Reassigning an **archived** enquiry's owner must be refused, same as every other header edit on an archived enquiry — covered in Task 2's verification.
- Auto-sync must never overwrite a customer a **different** rep already owns — it only fires when the linked customer's `ownerId` is currently `NULL` — covered in Task 2's verification.
- An enquiry with **no linked customer** (`customerId` is `NULL`, an unmatched requester) must reassign cleanly with no crash trying to sync a nonexistent customer — covered in Task 2's verification.
- Submitting the **same** `assignedToId` the enquiry already has must be a true no-op — no audit row, no customer-sync side effect — so an admin re-opening the picker without changing anything doesn't spam the activity timeline — covered in Task 2's verification.

---

### Task 1: Schema and audit vocabulary

**Files:**
- Modify: `src/modules/enquiries/schemas.ts`
- Modify: `src/modules/audit/types.ts`
- Modify: `src/modules/audit/describe.ts`

**Interfaces:**
- Produces (consumed by Tasks 2-3): `enquiryOwnerSchema`, `EnquiryOwnerInput` from `./schemas`; the `AuditAction` member `"enquiry.owner_changed"`.
- `EnquiryHeaderInput` loses its `assignedToId` field (consumed by Task 2, which must stop reading it).

- [ ] **Step 1: Remove `assignedToId` from `enquiryHeaderSchema` and add `enquiryOwnerSchema`**

In `src/modules/enquiries/schemas.ts`, remove this line from `enquiryHeaderSchema` (currently line 64):

```ts
  assignedToId: optionalUuid("Choose a valid owner"),
```

So `enquiryHeaderSchema` reads (the `notes` line right after it is unchanged):

```ts
export const enquiryHeaderSchema = z.object({
  id: z.uuid(),
  customerId: optionalUuid("Choose a valid customer"),
  contactId: optionalUuid("Choose a valid contact"),
  requesterName: optionalText(200),
  requesterEmail: optionalEmail(),
  subject: optionalText(300),
  priority: requiredEnum(ENQUIRY_PRIORITIES, "priority"),
  requiredBy: optionalDate(),
  deliveryLocation: optionalText(200),
  blocker: optionalText(500),
  nextAction: optionalText(500),
  notes: optionalText(2000),
});
```

Add a new schema right after `enquirySuggestionSchema` (currently line 72), before `customerFromRequesterSchema`:

```ts
/** Empty string (the "Unassigned" choice in the picker) means make the enquiry unassigned again. */
export const enquiryOwnerSchema = z.object({ id: z.uuid(), assignedToId: z.preprocess((value) => (value === "" ? null : value), z.uuid().nullable()) });
```

Add its type export next to the other type exports near the bottom of the file (after `export type EnquirySuggestionInput = z.output<typeof enquirySuggestionSchema>;`, currently line 103):

```ts
export type EnquiryOwnerInput = z.output<typeof enquiryOwnerSchema>;
```

- [ ] **Step 2: Add the audit action**

In `src/modules/audit/types.ts`, add `"enquiry.owner_changed"` to the `AuditAction` union, right after `| "enquiry.archived"` (currently line 86):

```ts
  | "enquiry.archived"
  | "enquiry.owner_changed"
  | "enquiry.bulk_confirmed"
```

In `src/modules/audit/describe.ts`, add its label to `AUDIT_ACTION_LABEL`, right after `"enquiry.archived": "Enquiry archived",` (currently line 57):

```ts
  "enquiry.archived": "Enquiry archived",
  "enquiry.owner_changed": "Enquiry owner changed",
  "enquiry.bulk_confirmed": "Ready requirements bulk-confirmed",
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit` and `npx eslint src/modules/enquiries/schemas.ts src/modules/audit/types.ts src/modules/audit/describe.ts`
Expected: both clean. `tsc` will show errors in `src/modules/enquiries/service.ts`, `actions.ts`, `components/enquiry-header-form.tsx` and `components/header-panel.tsx` (they still reference the removed `assignedToId` field) — that's expected until Tasks 2 and 5 fix them. Confirm the errors are confined to those four files and are about `assignedToId`/`EnquiryHeaderInput`, nothing else.

- [ ] **Step 4: Commit**

```bash
git add src/modules/enquiries/schemas.ts src/modules/audit/types.ts src/modules/audit/describe.ts
git commit -m "feat: enquiry owner schema and audit action (sales ops phase 1)"
```

---

### Task 2: Service — `reassignEnquiryOwner`, and strip owner handling out of `updateEnquiryHeader`

**Files:**
- Modify: `src/modules/enquiries/service.ts`

**Interfaces:**
- Consumes: `assertAdmin` from `../../core/permissions/roles` (existing); `EnquiryOwnerInput` from `./schemas` (Task 1); `requireNotArchived` from `./shared` (existing, already imported in this file).
- Produces (consumed by Task 3): `reassignEnquiryOwner(ctx: ServiceContext, input: EnquiryOwnerInput): Promise<{ id: string; ... }>`.

- [ ] **Step 1: Add the `assertAdmin` import and the `EnquiryOwnerInput` type import**

In `src/modules/enquiries/service.ts`, add this import near the top (after the existing `writeAudit` import, line 6):

```ts
import { assertAdmin } from "../../core/permissions/roles";
```

Change the existing type-only import from `./schemas` (currently line 15) to add `EnquiryOwnerInput`:

```ts
import type { CustomerFromRequesterInput, EnquiryArchiveInput, EnquiryHeaderInput, EnquiryNoteInput, EnquiryOwnerInput, EnquirySuggestionInput, EnquiryStatusInput } from "./schemas";
```

- [ ] **Step 2: Remove owner handling from `updateEnquiryHeader`**

Replace the whole function (currently lines 124-159) with:

```ts
export async function updateEnquiryHeader(ctx: ServiceContext, input: EnquiryHeaderInput) {
  return inTransaction(ctx, async (c) => {
    const { id, customerId, contactId, ...fields } = input;
    const existing = await c.db.enquiry.findUnique({
      where: { id },
      include: { customer: { select: { name: true } }, contact: { select: { name: true } } },
    });
    if (!existing) throw new NotFoundError("Enquiry");
    requireNotArchived(existing);

    await assertCustomerAndContact(c, customerId, contactId, { customerId: existing.customerId, contactId: existing.contactId });

    const details: Record<string, Prisma.InputJsonValue> = { ...diffFields(existing, fields, HEADER_FIELDS) };
    if (customerId !== existing.customerId) {
      const next = customerId ? await c.db.customer.findUnique({ where: { id: customerId }, select: { name: true } }) : null;
      details.customer = { from: existing.customer?.name ?? null, to: next?.name ?? null };
    }
    if (contactId !== existing.contactId) {
      const next = contactId ? await c.db.customerContact.findUnique({ where: { id: contactId }, select: { name: true } }) : null;
      details.contact = { from: existing.contact?.name ?? null, to: next?.name ?? null };
    }
    if (Object.keys(details).length === 0) return existing;

    const updated = await c.db.enquiry.update({ where: { id }, data: { ...fields, customerId, contactId, lastActivityAt: new Date() } });
    await writeAudit(c, { action: "enquiry.updated", entityType: "Enquiry", entityId: id, details });
    return updated;
  });
}
```

(This removes the `assignedToId` destructure, the owner-validity check, the `details.owner` diff block, and `assignedToId` from the final `update` call — everything else is unchanged.)

- [ ] **Step 3: Add `reassignEnquiryOwner`**

Add this new function right after `updateEnquiryHeader`:

```ts
/**
 * Who this enquiry is assigned to - attribution only (KPI reporting, "assigned to me" filtering). Unlike `Customer.ownerId`,
 * this never restricts who can see or work the enquiry: procurement still needs every enquiry visible regardless of sales
 * ownership (docs/superpowers/specs/2026-10-08-sales-operations-design.md, section 4). ADMIN only. Assigning to someone also
 * sets the linked Customer's owner, but only when that customer is currently unowned - never silently taking a customer away
 * from a rep who already owns them.
 */
export async function reassignEnquiryOwner(ctx: ServiceContext, input: EnquiryOwnerInput) {
  assertAdmin(ctx);
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.enquiry.findUnique({
      where: { id: input.id },
      select: { id: true, archivedAt: true, customerId: true, assignedToId: true, assignedTo: { select: { name: true } } },
    });
    if (!existing) throw new NotFoundError("Enquiry");
    requireNotArchived(existing);
    if (input.assignedToId === existing.assignedToId) return existing;

    let nextName: string | null = null;
    if (input.assignedToId) {
      const user = await c.db.user.findUnique({ where: { id: input.assignedToId }, select: { status: true, name: true } });
      if (!user || user.status !== "ACTIVE") throw new ValidationError("That owner is not available.", { assignedToId: "Choose an active user" });
      nextName = user.name;
    }

    const updated = await c.db.enquiry.update({ where: { id: input.id }, data: { assignedToId: input.assignedToId } });
    await writeAudit(c, { action: "enquiry.owner_changed", entityType: "Enquiry", entityId: input.id, details: { owner: { from: existing.assignedTo?.name ?? null, to: nextName } } });

    if (existing.customerId && input.assignedToId) {
      const customer = await c.db.customer.findUnique({ where: { id: existing.customerId }, select: { ownerId: true } });
      if (customer && customer.ownerId === null) {
        await c.db.customer.update({ where: { id: existing.customerId }, data: { ownerId: input.assignedToId } });
        await writeAudit(c, { action: "customer.owner_changed", entityType: "Customer", entityId: existing.customerId, details: { owner: { from: null, to: nextName }, via: "enquiry" } });
      }
    }

    return updated;
  });
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit` and `npx eslint src/modules/enquiries/service.ts`
Expected: both clean. (`tsc` should now also be clean on `actions.ts` and the two components touched by Task 1's leftover errors — no, those still fail until Tasks 3 and 5; only confirm `service.ts` itself is clean and that no *new* errors appeared elsewhere.)

- [ ] **Step 5: Verify against the project database**

Create scratch file `scratchpad/verify-enquiry-owner.ts` (not committed):

```ts
import { db } from "../src/core/database/client";
import { ForbiddenError } from "../src/core/errors";
import { reassignEnquiryOwner } from "../src/modules/enquiries/service";

async function main() {
  const admin = await db.user.findFirst({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true, name: true } });
  const staff = await db.user.findFirst({ where: { role: "STAFF", status: "ACTIVE" }, select: { id: true, name: true } });
  if (!admin || !staff) throw new Error("Need at least one active ADMIN and one active STAFF user in the project database to verify this.");

  const enquiry = await db.enquiry.findFirst({
    where: { customerId: { not: null }, customer: { ownerId: null }, archivedAt: null },
    select: { id: true, customerId: true },
  });
  if (!enquiry) throw new Error("No open enquiry with an unowned linked customer found - pick one by hand and edit this script's `where`.");

  const adminCtx = { actor: { id: admin.id, email: "admin@test.local", name: admin.name, role: "ADMIN" as const }, db };
  const staffCtx = { actor: { id: staff.id, email: "staff@test.local", name: staff.name, role: "STAFF" as const }, db };

  // Case 1: non-admin direct call is refused.
  try {
    await reassignEnquiryOwner(staffCtx, { id: enquiry.id, assignedToId: staff.id });
    console.log("case1 FAIL: non-admin was not refused");
  } catch (error) {
    console.log("case1 non-admin refused:", error instanceof ForbiddenError);
  }

  // Case 2: admin assigns to staff; the unowned linked customer should follow.
  await reassignEnquiryOwner(adminCtx, { id: enquiry.id, assignedToId: staff.id });
  const afterAssign = await db.enquiry.findUnique({ where: { id: enquiry.id }, select: { assignedToId: true } });
  const customerAfterAssign = await db.customer.findUnique({ where: { id: enquiry.customerId! }, select: { ownerId: true } });
  console.log("case2 enquiry assignedToId set:", afterAssign?.assignedToId === staff.id);
  console.log("case2 customer owner auto-synced:", customerAfterAssign?.ownerId === staff.id);

  // Case 3: resubmitting the same owner is a true no-op (no new audit row).
  const auditBefore = await db.auditLog.count({ where: { entityType: "Enquiry", entityId: enquiry.id, action: "enquiry.owner_changed" } });
  await reassignEnquiryOwner(adminCtx, { id: enquiry.id, assignedToId: staff.id });
  const auditAfter = await db.auditLog.count({ where: { entityType: "Enquiry", entityId: enquiry.id, action: "enquiry.owner_changed" } });
  console.log("case3 same-owner resubmit is a no-op:", auditBefore === auditAfter);

  // Case 4: a second enquiry on the SAME customer, assigned to someone else, must not move the customer (already owned).
  const secondStaff = await db.user.findFirst({ where: { role: "STAFF", status: "ACTIVE", id: { not: staff.id } }, select: { id: true } });
  const otherEnquiry = await db.enquiry.findFirst({ where: { customerId: enquiry.customerId, id: { not: enquiry.id }, archivedAt: null }, select: { id: true } });
  if (secondStaff && otherEnquiry) {
    await reassignEnquiryOwner(adminCtx, { id: otherEnquiry.id, assignedToId: secondStaff.id });
    const customerAfterSecond = await db.customer.findUnique({ where: { id: enquiry.customerId! }, select: { ownerId: true } });
    console.log("case4 customer owner left alone (already owned):", customerAfterSecond?.ownerId === staff.id);
  } else {
    console.log("case4 skipped: need a second active user and a second enquiry on the same customer");
  }

  // Case 5: an enquiry with no linked customer reassigns cleanly, no crash.
  const noCustomerEnquiry = await db.enquiry.findFirst({ where: { customerId: null, archivedAt: null }, select: { id: true } });
  if (noCustomerEnquiry) {
    await reassignEnquiryOwner(adminCtx, { id: noCustomerEnquiry.id, assignedToId: admin.id });
    console.log("case5 enquiry with no customer reassigned without crashing: true");
  } else {
    console.log("case5 skipped: no customer-less open enquiry found");
  }

  // Case 6: an archived enquiry is refused.
  const archived = await db.enquiry.findFirst({ where: { archivedAt: { not: null } }, select: { id: true } });
  if (archived) {
    try {
      await reassignEnquiryOwner(adminCtx, { id: archived.id, assignedToId: admin.id });
      console.log("case6 FAIL: archived enquiry was not refused");
    } catch {
      console.log("case6 archived enquiry refused: true");
    }
  } else {
    console.log("case6 skipped: no archived enquiry found");
  }
}
main().finally(() => db.$disconnect());
```

Run: `npx tsx scratchpad/verify-enquiry-owner.ts`
Expected: `case1 non-admin refused: true`, `case2 enquiry assignedToId set: true`, `case2 customer owner auto-synced: true`, `case3 same-owner resubmit is a no-op: true`, `case4 customer owner left alone (already owned): true` (or a `skipped` line naming why, if the project database doesn't currently have two active STAFF users and a second enquiry on the same customer), `case5 enquiry with no customer reassigned without crashing: true` (or `skipped`), `case6 archived enquiry refused: true` (or `skipped`). Investigate and fix `service.ts` if any non-skipped line disagrees. This leaves two `TEST`-worthy side effects on the project database (the enquiry/customer reassigned in cases 2-5) — note them in the task's completion message so they can be reviewed or reverted by hand; do not write a cleanup step that touches other people's data. Delete the scratch file after (do not commit it).

- [ ] **Step 6: Commit**

```bash
git add src/modules/enquiries/service.ts
git commit -m "feat: admin-only enquiry owner reassignment with customer auto-sync"
```

---

### Task 3: Server action — `reassignEnquiryOwnerAction`

**Files:**
- Modify: `src/modules/enquiries/actions.ts`

**Interfaces:**
- Consumes: `enquiryOwnerSchema` from `./schemas` (Task 1), `reassignEnquiryOwner` from `./service` (Task 2).
- Produces (consumed by Task 4's component): `reassignEnquiryOwnerAction(_prev: IdResult | null, formData: FormData): Promise<IdResult>`.

- [ ] **Step 1: Add the schema import and the action**

In `src/modules/enquiries/actions.ts`, add `enquiryOwnerSchema` to the existing multi-line import from `./schemas` (currently lines 22-36), inserted alphabetically between `enquiryNoteSchema` and `enquiryStatusSchema`:

```ts
  enquiryNoteSchema,
  enquiryOwnerSchema,
  enquiryStatusSchema,
```

Add `reassignEnquiryOwner` to the existing import from `./service` (currently line 37):

```ts
import { addEnquiryNote, applyHeaderSuggestion, createCustomerFromRequester, createEnquiry, reassignEnquiryOwner, setEnquiryArchived, setEnquiryStatus, updateEnquiryHeader } from "./service";
```

Add the new action function, right after `updateEnquiryHeaderAction` (currently ends at line 85):

```ts
/** Sales-ops attribution only, not visibility - ADMIN only (enforced again in the service). */
export async function reassignEnquiryOwnerAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = enquiryOwnerSchema.parse(formDataToObject(formData));
      const enquiry = await reassignEnquiryOwner(await getServiceContext(), input);
      refreshEnquiry(enquiry.id, true);
      return { id: enquiry.id };
    },
    { successMessage: "Owner updated", formData },
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit` and `npx eslint src/modules/enquiries/actions.ts`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/modules/enquiries/actions.ts
git commit -m "feat: server action for admin-only enquiry owner reassignment"
```

---

### Task 4: UI component — `EnquiryOwnerControl`

**Files:**
- Create: `src/modules/enquiries/components/owner-control.tsx`

**Interfaces:**
- Consumes: `reassignEnquiryOwnerAction` from `../actions` (Task 3); `SelectOption` from `@/components/forms/multi-select` (existing).
- Produces (consumed by Task 5): `EnquiryOwnerControl({ enquiryId, ownerId, ownerName, users, disabled }): JSX.Element`.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import type { SelectOption } from "@/components/forms/multi-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { reassignEnquiryOwnerAction } from "../actions";

/**
 * Who this enquiry is assigned to - attribution only (KPI reporting, "assigned to me" filtering). Unlike `CustomerOwnerControl`,
 * this never restricts who can see or work the enquiry: everyone keeps full visibility for sourcing. ADMIN only.
 */
export function EnquiryOwnerControl({
  enquiryId,
  ownerId,
  ownerName,
  users,
  disabled,
}: {
  enquiryId: string;
  ownerId: string | null;
  ownerName: string | null;
  users: SelectOption[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(reassignEnquiryOwnerAction, null);
  useActionFeedback(state, () => setOpen(false));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} title={disabled ? "Restore the enquiry to reassign it" : undefined}>
          Owner: {ownerName ?? "Unassigned"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-xs text-muted-foreground">Who this enquiry is assigned to, for sales reporting. It never hides the enquiry from anyone else - everyone keeps full visibility for sourcing.</p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="id" value={enquiryId} />
          <SelectField name="assignedToId" noneLabel="Unassigned" defaultValue={ownerId} options={users} />
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

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit` and `npx eslint src/modules/enquiries/components/owner-control.tsx`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/modules/enquiries/components/owner-control.tsx
git commit -m "feat: EnquiryOwnerControl, admin-only owner picker for the enquiry header"
```

---

### Task 5: Wire the control into the enquiry detail page; remove the field from the general edit form

**Files:**
- Modify: `src/modules/enquiries/components/enquiry-header-form.tsx`
- Modify: `src/modules/enquiries/components/header-panel.tsx`
- Modify: `src/app/(workspace)/enquiries/[id]/page.tsx`

**Interfaces:**
- Consumes: `EnquiryOwnerControl` from `./owner-control` (Task 4).
- `EnquiryHeaderForm`'s prop type drops `owners` and `EnquiryHeaderInitial` drops `assignedToId` — no other task depends on either.

- [ ] **Step 1: Remove the Owner field and `owners` prop from `EnquiryHeaderForm`**

In `src/modules/enquiries/components/enquiry-header-form.tsx`, remove `assignedToId: string | null;` from `EnquiryHeaderInitial` (currently line 33), so the type reads:

```ts
export type EnquiryHeaderInitial = {
  id: string;
  customerId: string | null;
  contactId: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  subject: string | null;
  priority: string;
  /** yyyy-mm-dd */
  requiredBy: string | null;
  deliveryLocation: string | null;
  blocker: string | null;
  nextAction: string | null;
  notes: string | null;
};
```

Change the function signature (currently line 41) to drop `owners`:

```ts
export function EnquiryHeaderForm({ enquiry, customers, contacts }: { enquiry: EnquiryHeaderInitial; customers: SelectOption[]; contacts: ContactOption[] }) {
```

Remove the Owner field block entirely (currently lines 90-92):

```tsx
        <Field label="Owner" htmlFor="ehf-owner" error={err("assignedToId")}>
          <SelectField id="ehf-owner" name="assignedToId" noneLabel="Unassigned" defaultValue={fieldValue(state, "assignedToId", enquiry.assignedToId) || null} options={owners} />
        </Field>
```

(`SelectField` stays imported — the Priority field a few lines below still uses it. `ENQUIRY_PRIORITY_LABEL`/`toOptions` are likewise still used by the Priority field. No import changes in this file beyond what the removed field itself stops needing, which is nothing else.)

- [ ] **Step 2: Render `EnquiryOwnerControl` admin-only in `EnquiryHeaderPanel`, drop `assignedToId` from the form's data**

In `src/modules/enquiries/components/header-panel.tsx`, add this import after the existing `EnquiryHeaderForm` import (currently line 13):

```ts
import { EnquiryOwnerControl } from "./owner-control";
```

Change the component's prop type (currently lines 18-28) to add `isAdmin`:

```ts
export function EnquiryHeaderPanel({
  enquiry,
  customers,
  contacts,
  owners,
  isAdmin,
}: {
  enquiry: EnquiryDetail;
  customers: SelectOption[];
  contacts: ContactOption[];
  owners: SelectOption[];
  isAdmin: boolean;
}) {
```

Add the control as the first child of `<TopbarActions>` (currently line 35), before the `canPromote` block:

```tsx
      <TopbarActions>
        {isAdmin ? <EnquiryOwnerControl enquiryId={enquiry.id} ownerId={enquiry.assignedTo?.id ?? null} ownerName={enquiry.assignedTo?.name ?? null} users={owners} disabled={archived} /> : null}
        {canPromote ? (
```

Remove `assignedToId: enquiry.assignedToId,` from the object passed into `<EnquiryHeaderForm>` (currently line 70), and remove the `owners={owners}` prop passed to it (currently line 75) since that component no longer takes it:

```tsx
          <EnquiryHeaderForm
            enquiry={{
              id: enquiry.id,
              customerId: enquiry.customerId,
              contactId: enquiry.contactId,
              requesterName: enquiry.requesterName,
              requesterEmail: enquiry.requesterEmail,
              subject: enquiry.subject,
              priority: enquiry.priority,
              requiredBy: enquiry.requiredBy ? enquiry.requiredBy.toISOString().slice(0, 10) : null,
              deliveryLocation: enquiry.deliveryLocation,
              blocker: enquiry.blocker,
              nextAction: enquiry.nextAction,
              notes: enquiry.notes,
            }}
            customers={customers}
            contacts={contacts}
          />
```

(The read-only `{ label: "Owner", value: enquiry.assignedTo?.name }` row inside the `KeyValue` further down, currently line 99, is unchanged — everyone keeps seeing the current owner, only admins get the control to change it.)

- [ ] **Step 3: Pass `isAdmin` from the page**

In `src/app/(workspace)/enquiries/[id]/page.tsx`, change line 53 from:

```ts
  await requireActor();
```

to:

```ts
  const actor = await requireActor();
```

Change the `<EnquiryHeaderPanel>` call (currently line 162) from:

```tsx
      <EnquiryHeaderPanel enquiry={enquiry} customers={customers} contacts={contacts} owners={owners} />
```

to:

```tsx
      <EnquiryHeaderPanel enquiry={enquiry} customers={customers} contacts={contacts} owners={owners} isAdmin={actor.role === "ADMIN"} />
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit` and `npx eslint src/modules/enquiries/components/enquiry-header-form.tsx src/modules/enquiries/components/header-panel.tsx "src/app/(workspace)/enquiries/[id]/page.tsx"`
Expected: both clean, with no leftover errors anywhere in the project about `assignedToId` on `EnquiryHeaderInput`/`EnquiryHeaderInitial` (confirms Task 1's schema change and this task's form/panel changes now agree everywhere).

- [ ] **Step 5: Browser check**

Sign in as an admin, open any enquiry, confirm the "Owner: ..." button appears in the top bar and its popover reassigns the owner; sign in (or switch) as a STAFF user and confirm the button is absent and the "Edit" drawer no longer has an Owner field. If sign-in is blocked in this session (as it has been for earlier phases in this project, per `docs/plans/active/CURRENT.md`), record that explicitly instead of skipping the note.

- [ ] **Step 6: Commit**

```bash
git add src/modules/enquiries/components/enquiry-header-form.tsx src/modules/enquiries/components/header-panel.tsx "src/app/(workspace)/enquiries/[id]/page.tsx"
git commit -m "feat: admin-only owner control on the enquiry page, remove it from the general edit form"
```

---

### Task 6: "Assigned to me" filter on the main Enquiries list

**Files:**
- Modify: `src/modules/enquiries/queries.ts`
- Modify: `src/modules/enquiries/filters.ts`
- Modify: `src/app/(workspace)/enquiries/page.tsx`

**Interfaces:**
- Produces: `EnquiryAssigneeFilter` type, `EnquiryListParams.assignee?: EnquiryAssigneeFilter`, `listEnquiries(params, currentUserId?)`, `countEnquiriesByView(params, currentUserId?)` — both now take an optional second argument; existing call sites that omit it (`customers/[id]/page.tsx`'s `CustomerEnquiries`) keep working unchanged since `assignee` stays `undefined` there.

- [ ] **Step 1: Add the `assignee` filter to `queries.ts`**

In `src/modules/enquiries/queries.ts`, add this type export right after `export const ENQUIRY_VIEWS: readonly EnquiryView[] = [...]` (currently line 13):

```ts
export type EnquiryAssigneeFilter = "all" | "mine" | "unassigned";
```

Add `assignee` to `EnquiryListParams` (currently lines 15-24):

```ts
export type EnquiryListParams = {
  view: EnquiryView;
  page: number;
  q?: string;
  customerId?: string;
  /** Multi-value filters from the filter pills. Empty or absent = no restriction. */
  statuses?: EnquiryStatus[];
  priorities?: EnquiryPriority[];
  channels?: EvidenceChannel[];
  /** Who it's assigned to (Enquiry.assignedToId) - attribution only. "mine" needs the caller's id, passed separately to listEnquiries/countEnquiriesByView (not part of the URL-derived params so it can never be spoofed via a query string). */
  assignee?: EnquiryAssigneeFilter;
};
```

Change `filterWhere` (currently lines 68-93) to take and use `currentUserId`:

```ts
function filterWhere(params: FilterParams, currentUserId?: string): Prisma.EnquiryWhereInput {
  const q = params.q?.trim();
  const contains = (value: string) => ({ contains: escapeLike(value), mode: "insensitive" as const });
  const number = q ? /^ENQ-?0*(\d+)$/i.exec(q)?.[1] : undefined;

  return {
    AND: [
      params.customerId ? { customerId: params.customerId } : {},
      params.statuses?.length ? { status: { in: params.statuses } } : {},
      params.priorities?.length ? { priority: { in: params.priorities } } : {},
      params.channels?.length ? { evidenceSource: { channel: { in: params.channels } } } : {},
      params.assignee === "unassigned" ? { assignedToId: null } : {},
      params.assignee === "mine" ? { assignedToId: currentUserId ?? "__none__" } : {},
      q
        ? {
            OR: [
              ...(number ? [{ number: Number(number) }] : []),
              { subject: contains(q) },
              { requesterName: contains(q) },
              { requesterEmail: contains(q) },
              { customer: { name: contains(q) } },
              { items: { some: { OR: [{ description: contains(q) }, { modelText: contains(q) }, { partNumber: contains(q) }, { brandText: contains(q) }] } } },
            ],
          }
        : {},
    ],
  };
}
```

Change `countEnquiriesByView` (currently lines 99-103):

```ts
export async function countEnquiriesByView(params: FilterParams, currentUserId?: string): Promise<Record<EnquiryView, number>> {
  const filters = filterWhere(params, currentUserId);
  const counts = await Promise.all(ENQUIRY_VIEWS.map((view) => db.enquiry.count({ where: { AND: [viewWhere(view), filters] } })));
  return Object.fromEntries(ENQUIRY_VIEWS.map((view, index) => [view, counts[index]!])) as Record<EnquiryView, number>;
}
```

Change the first line of `listEnquiries` (currently lines 106-107):

```ts
export async function listEnquiries(params: EnquiryListParams, currentUserId?: string): Promise<{ rows: EnquiryListRow[]; total: number }> {
  const where: Prisma.EnquiryWhereInput = { AND: [viewWhere(params.view), filterWhere(params, currentUserId)] };
```

(The rest of `listEnquiries`, and `listEnquiriesNeedingAttention`, are unchanged.)

- [ ] **Step 2: Parse the `assignee` URL param in `filters.ts`**

Replace the full content of `src/modules/enquiries/filters.ts` with:

```ts
import { z } from "zod";
import { EnquiryPriority, EnquiryStatus, EvidenceChannel } from "../../generated/prisma/enums";
import { firstParam, parsePage, type SearchParams } from "../../lib/search-params";
import { ENQUIRY_VIEWS, type EnquiryAssigneeFilter, type EnquiryListParams, type EnquiryView } from "./queries";

const isUuid = (value: string | undefined) => (value !== undefined && z.uuid().safeParse(value).success ? value : undefined);

const ASSIGNEES: readonly EnquiryAssigneeFilter[] = ["all", "mine", "unassigned"];

/** A comma-separated URL value as a list of members of an enum. Unknown members are dropped, never passed to the database. */
function listOf<T extends string>(members: Record<string, T>, value: string | undefined): T[] {
  const allowed = new Set<string>(Object.values(members));
  return [...new Set((value ?? "").split(",").map((v) => v.trim()).filter((v) => allowed.has(v)))] as T[];
}

/** Turns untrusted URL params into safe query params. Anything invalid is ignored rather than passed to the database. */
export function parseEnquiryFilters(searchParams: SearchParams): EnquiryListParams {
  const requested = firstParam(searchParams, "view");
  const assignee = firstParam(searchParams, "assignee");
  return {
    view: (ENQUIRY_VIEWS as readonly string[]).includes(requested ?? "") ? (requested as EnquiryView) : "attention",
    q: firstParam(searchParams, "q"),
    customerId: isUuid(firstParam(searchParams, "customer")),
    statuses: listOf(EnquiryStatus, firstParam(searchParams, "status")),
    priorities: listOf(EnquiryPriority, firstParam(searchParams, "priority")),
    channels: listOf(EvidenceChannel, firstParam(searchParams, "source")),
    assignee: (ASSIGNEES as readonly string[]).includes(assignee ?? "") ? (assignee as EnquiryAssigneeFilter) : "all",
    page: parsePage(searchParams),
  };
}

/** True when any search or filter (not the tab or page) is set, so the UI can offer "Clear". */
export function hasActiveEnquiryFilters(params: EnquiryListParams): boolean {
  return Boolean(params.q || params.customerId || params.statuses?.length || params.priorities?.length || params.channels?.length || (params.assignee && params.assignee !== "all"));
}
```

- [ ] **Step 3: Add the filter pill and thread the actor's id through `page.tsx`**

In `src/app/(workspace)/enquiries/page.tsx`, change `FILTER_KEYS` (currently line 49) to carry `assignee` into tab links:

```ts
const FILTER_KEYS = ["q", "status", "priority", "source", "customer", "assignee"] as const;
```

Change the start of `EnquiriesPage` (currently line 52) to capture the actor:

```ts
export default async function EnquiriesPage(props: PageProps<"/enquiries">) {
  const actor = await requireActor();
```

Change the counts call (currently line 67):

```ts
  const [counts, triageCount] = await Promise.all([countEnquiriesByView(params, actor.id), countEmailTriage()]);
```

In the `EnquiryList` function, capture the actor and thread its id into `listEnquiries`, add the `assignee` pill, and add `assignee: undefined` to the clear link (currently lines 86-108):

```tsx
async function EnquiryList({ searchParams, newEnquiry }: { searchParams: SearchParams; newEnquiry: React.ReactNode }) {
  const params = parseEnquiryFilters(searchParams);
  const actor = await getCurrentActor();
  const [{ rows, total }, customers] = await Promise.all([listEnquiries(params, actor.id), listCustomerOptions()]);
  const filtered = hasActiveEnquiryFilters(params);
  const clearHref = buildHref("/enquiries", searchParams, { q: undefined, status: undefined, priority: undefined, source: undefined, customer: undefined, assignee: undefined, page: undefined });
  const peekHref = (id: string) => buildHref("/enquiries", searchParams, { peek: id });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <SearchInput placeholder="Search enquiries" className="w-72"  />
        <FilterPill param="status" label="Status" options={ENQUIRY_STATUS_ORDER.map((value) => ({ value, label: ENQUIRY_STATUS_LABEL[value], tone: ENQUIRY_STATUS_TONE[value] }))} />
        <FilterPill param="priority" label="Priority" options={(["URGENT", "HIGH", "NORMAL", "LOW"] as const).map((value) => ({ value, label: ENQUIRY_PRIORITY_LABEL[value], tone: ENQUIRY_PRIORITY_TONE[value] }))} />
        <FilterPill param="source" label="Source" options={toOptions(EVIDENCE_CHANNEL_LABEL)} />
        <FilterPill param="customer" label="Customer" mode="single" options={customers} searchable />
        <FilterPill
          param="assignee"
          label="Assigned"
          mode="single"
          defaultValue="all"
          options={[
            { value: "all", label: "Anyone" },
            { value: "mine", label: "Assigned to me" },
            { value: "unassigned", label: "Unassigned" },
          ]}
        />
        {filtered ? (
          <Button asChild variant="ghost" size="sm" className="rounded-lg text-muted-foreground">
            <Link href={clearHref}>
              <X aria-hidden /> Clear
            </Link>
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        filtered ? (
          <NoEnquiries bare title="No enquiries match" description="Try a different search or filter, or clear them." />
        ) : (
          <NoEnquiries bare title={EMPTY[params.view].title} description={EMPTY[params.view].description} action={params.view === "archived" ? undefined : newEnquiry} />
        )
      ) : (
        <>
          <EnquiriesTable rows={rows} bare peekHref={peekHref} />
          <Pagination pathname="/enquiries" searchParams={searchParams} page={params.page} total={total} />
        </>
      )}
    </>
  );
}
```

(`getCurrentActor` is already imported at the top of this file for `EmailTriage`, so no new import is needed.)

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit` and `npx eslint src/modules/enquiries/queries.ts src/modules/enquiries/filters.ts "src/app/(workspace)/enquiries/page.tsx"`
Expected: both clean.

- [ ] **Step 5: Verify against the project database**

Create scratch file `scratchpad/verify-enquiry-assignee-filter.ts` (not committed):

```ts
import { db } from "../src/core/database/client";
import { listEnquiries } from "../src/modules/enquiries/queries";

async function main() {
  const staff = await db.user.findFirst({ where: { role: "STAFF", status: "ACTIVE" }, select: { id: true, name: true } });
  if (!staff) throw new Error("Need at least one active STAFF user in the project database to verify this.");

  const mine = await listEnquiries({ view: "all", page: 1, assignee: "mine" }, staff.id);
  const unassigned = await listEnquiries({ view: "all", page: 1, assignee: "unassigned" });
  const all = await listEnquiries({ view: "all", page: 1, assignee: "all" });

  console.log("mine total:", mine.total, "- every row actually assigned to", staff.name + ":", mine.rows.length === 0 || mine.total > 0);
  console.log("unassigned total:", unassigned.total);
  console.log("all total (no filter) >= mine + unassigned:", all.total >= mine.total + unassigned.total);
}
main().finally(() => db.$disconnect());
```

Run: `npx tsx scratchpad/verify-enquiry-assignee-filter.ts`
Expected: three plausible counts, with `all total >= mine + unassigned` printing `true` (an enquiry assigned to someone else makes up the rest). Cross-check `mine total` against a direct count of enquiries where `assignedToId` is Task 2's `staff.id`, since Task 2's scratch run should have left at least one assigned to that user. Delete the scratch file after (do not commit it).

- [ ] **Step 6: Browser check**

Sign in, open `/enquiries`, confirm the "Assigned" pill appears alongside Status/Priority/Source/Customer and that choosing "Assigned to me" / "Unassigned" changes the list and the URL (`?assignee=mine` etc.), and that switching tabs or paging keeps the chosen assignee filter. If sign-in is blocked in this session, record that explicitly instead of skipping the note.

- [ ] **Step 7: Commit**

```bash
git add src/modules/enquiries/queries.ts src/modules/enquiries/filters.ts "src/app/(workspace)/enquiries/page.tsx"
git commit -m "feat: Assigned to me / Unassigned filter on the main Enquiries list"
```

---

### Task 7: Update the active plan and close out

**Files:**
- Modify: `docs/plans/active/CURRENT.md`

- [ ] **Step 1: Record Phase 1 as shipped**

Add a new dated subsection under the existing "Structured requirements..." milestone text (or as its own short section, matching the file's existing style), stating: Phase 1 of the Sales Operations plan (`docs/superpowers/specs/2026-10-08-sales-operations-design.md`) is built — enquiry owner reassignment is admin-only with customer auto-sync, and the main Enquiries list has an "Assigned to me / Unassigned" filter. Link the plan file. Note the exact browser-check status from Tasks 5 and 6 (done, or "blocked, sign-in required" per this project's existing convention) and list anything left behind on the project database by the verification scripts (the enquiry/customer reassigned in Task 2, Step 5).

- [ ] **Step 2: Commit**

```bash
git add docs/plans/active/CURRENT.md
git commit -m "docs: record sales ops phase 1 (enquiry ownership & assignment) as shipped"
```
