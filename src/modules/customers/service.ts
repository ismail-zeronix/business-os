import { ConflictError, NotFoundError, uniqueViolation } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { diffFields, hasChanges } from "../../lib/diff";
import { CALL_DIRECTION_LABEL, CALL_OUTCOME_LABEL } from "../../lib/labels";
import { normalizeName } from "../../lib/normalize";
import { writeAudit } from "../audit/service";
import type { CustomerCallInput, CustomerCreateInput, CustomerNoteInput, CustomerStatusInput, CustomerUpdateInput } from "./schemas";

/** Fields whose changes are recorded in the audit log. */
const PROFILE_FIELDS = ["name", "legalName", "trn", "country", "emirate", "website", "phone", "email", "notes"] as const;

const duplicateNameMessage = (archived: boolean) =>
  archived
    ? "A customer with this name exists but is archived. Restore it instead of creating a duplicate."
    : "A customer with this name already exists. If this is a different company or branch, make the name distinct.";

async function assertNameFree(c: ServiceContext, normalizedName: string, exceptId?: string) {
  const existing = await c.db.customer.findUnique({ where: { normalizedName }, select: { id: true, status: true } });
  if (existing && existing.id !== exceptId) throw new ConflictError(duplicateNameMessage(existing.status === "ARCHIVED"), { name: "Already in use" });
}

export async function createCustomer(ctx: ServiceContext, input: CustomerCreateInput) {
  try {
    return await inTransaction(ctx, async (c) => {
      const normalizedName = normalizeName(input.name);
      await assertNameFree(c, normalizedName);
      const customer = await c.db.customer.create({ data: { ...input, normalizedName } });
      await writeAudit(c, { action: "customer.created", entityType: "Customer", entityId: customer.id, details: { name: customer.name } });
      return customer;
    });
  } catch (error) {
    if (uniqueViolation(error)) throw new ConflictError(duplicateNameMessage(false), { name: "Already in use" });
    throw error;
  }
}

export async function updateCustomer(ctx: ServiceContext, input: CustomerUpdateInput) {
  try {
    return await inTransaction(ctx, async (c) => {
      const { id, ...profile } = input;
      const existing = await c.db.customer.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Customer");

      const normalizedName = normalizeName(profile.name);
      await assertNameFree(c, normalizedName, id);

      const changes = diffFields(existing, profile, PROFILE_FIELDS);
      if (!hasChanges(changes)) return existing;

      const updated = await c.db.customer.update({ where: { id }, data: { ...profile, normalizedName } });
      await writeAudit(c, { action: "customer.updated", entityType: "Customer", entityId: id, details: changes });
      return updated;
    });
  } catch (error) {
    if (uniqueViolation(error)) throw new ConflictError(duplicateNameMessage(false), { name: "Already in use" });
    throw error;
  }
}

export async function setCustomerStatus(ctx: ServiceContext, input: CustomerStatusInput) {
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.customer.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundError("Customer");
    if (existing.status === input.status) return existing;
    const updated = await c.db.customer.update({ where: { id: input.id }, data: { status: input.status } });
    await writeAudit(c, {
      action: "customer.status_changed",
      entityType: "Customer",
      entityId: input.id,
      details: { status: { from: existing.status, to: input.status } },
    });
    return updated;
  });
}

/** A note is an append-only audit entry (no notes table), same as an enquiry note. It appears in the customer's Activity tab. */
export async function addCustomerNote(ctx: ServiceContext, input: CustomerNoteInput) {
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.customer.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!existing) throw new NotFoundError("Customer");
    await writeAudit(c, { action: "customer.note_added", entityType: "Customer", entityId: input.id, details: { note: input.note } });
  });
}

/** A call is logged the same way as a note, with direction and outcome recorded alongside the free text. */
export async function logCustomerCall(ctx: ServiceContext, input: CustomerCallInput) {
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.customer.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!existing) throw new NotFoundError("Customer");
    await writeAudit(c, {
      action: "customer.call_logged",
      entityType: "Customer",
      entityId: input.id,
      details: { direction: CALL_DIRECTION_LABEL[input.direction], outcome: CALL_OUTCOME_LABEL[input.outcome], note: input.note ?? undefined },
    });
  });
}
