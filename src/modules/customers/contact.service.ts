import { InvariantError, NotFoundError } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { diffFields, hasChanges } from "../../lib/diff";
import { writeAudit } from "../audit/service";
import type { CustomerContactCreateInput, CustomerContactStatusInput, CustomerContactUpdateInput } from "./schemas";

const CONTACT_FIELDS = ["name", "jobTitle", "department", "phone", "whatsapp", "email", "preferredChannel", "notes"] as const;

/** Contact changes are audited with scope = the owning customer, so they appear in the customer's Activity tab. */
const customerScope = (customerId: string) => ({ type: "Customer" as const, id: customerId });

/** Lower-cased email used to match an incoming email's sender to a known customer contact. */
export const normalizeEmailAddress = (email: string | null): string | null => (email ? email.trim().toLowerCase() : null);

export async function addCustomerContact(ctx: ServiceContext, input: CustomerContactCreateInput) {
  return inTransaction(ctx, async (c) => {
    const { customerId, ...profile } = input;
    const customer = await c.db.customer.findUnique({ where: { id: customerId }, select: { id: true, status: true } });
    if (!customer) throw new NotFoundError("Customer");
    if (customer.status === "ARCHIVED") throw new InvariantError("This customer is archived. Restore it before adding contacts.");

    const contact = await c.db.customerContact.create({ data: { ...profile, customerId, normalizedEmail: normalizeEmailAddress(profile.email) } });
    await writeAudit(c, {
      action: "customer_contact.created",
      entityType: "CustomerContact",
      entityId: contact.id,
      scope: customerScope(customerId),
      details: { name: contact.name },
    });
    return contact;
  });
}

export async function updateCustomerContact(ctx: ServiceContext, input: CustomerContactUpdateInput) {
  return inTransaction(ctx, async (c) => {
    const { id, ...profile } = input;
    const existing = await c.db.customerContact.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Contact");

    const changes = diffFields(existing, profile, CONTACT_FIELDS);
    if (!hasChanges(changes)) return existing;

    const updated = await c.db.customerContact.update({ where: { id }, data: { ...profile, normalizedEmail: normalizeEmailAddress(profile.email) } });
    await writeAudit(c, { action: "customer_contact.updated", entityType: "CustomerContact", entityId: id, scope: customerScope(existing.customerId), details: changes });
    return updated;
  });
}

/** Archive (soft-delete), deactivate or restore a contact. Contacts referenced by enquiries are never hard-deleted. */
export async function setCustomerContactStatus(ctx: ServiceContext, input: CustomerContactStatusInput) {
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.customerContact.findUnique({ where: { id: input.id }, select: { id: true, customerId: true, status: true } });
    if (!existing) throw new NotFoundError("Contact");
    if (existing.status === input.status) return existing;
    const updated = await c.db.customerContact.update({ where: { id: input.id }, data: { status: input.status } });
    await writeAudit(c, {
      action: input.status === "ARCHIVED" ? "customer_contact.archived" : "customer_contact.updated",
      entityType: "CustomerContact",
      entityId: input.id,
      scope: customerScope(existing.customerId),
      details: { status: { from: existing.status, to: input.status } },
    });
    return updated;
  });
}
