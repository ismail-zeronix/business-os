import { InvariantError, NotFoundError, ValidationError } from "../../core/errors";
import type { ServiceContext } from "../../core/database/tx";

/** Enquiry item and header changes are audited with scope = the enquiry, so they appear in its Activity tab. */
export const enquiryScope = (enquiryId: string) => ({ type: "Enquiry" as const, id: enquiryId });

/** Marks the enquiry as just worked on (the inbox orders and reports "last activity" from this). */
export async function touchEnquiry(c: ServiceContext, enquiryId: string): Promise<void> {
  await c.db.enquiry.update({ where: { id: enquiryId }, data: { lastActivityAt: new Date() } });
}

/** The human reference shown for an enquiry, e.g. ENQ-00012. */
export const enquiryReference = (number: number): string => `ENQ-${String(number).padStart(5, "0")}`;

export const ARCHIVED_MESSAGE = "This enquiry is archived. Restore it to make changes.";

export function requireNotArchived(enquiry: { archivedAt: Date | null }): void {
  if (enquiry.archivedAt) throw new InvariantError(ARCHIVED_MESSAGE);
}

/**
 * Validates a customer / contact selection. A contact needs its customer; both must exist, must not be archived (unless unchanged,
 * `alreadyCustomerId` / `alreadyContactId`), and the contact must belong to the customer.
 */
export async function assertCustomerAndContact(
  c: ServiceContext,
  customerId: string | null,
  contactId: string | null,
  already: { customerId?: string | null; contactId?: string | null } = {},
): Promise<void> {
  if (contactId && !customerId) throw new ValidationError("Choose the customer this contact belongs to.", { contactId: "Choose a customer first" });

  if (customerId) {
    const customer = await c.db.customer.findUnique({ where: { id: customerId }, select: { status: true } });
    if (!customer) throw new NotFoundError("Customer");
    if (customer.status === "ARCHIVED" && already.customerId !== customerId) throw new ValidationError("That customer is archived.", { customerId: "Archived" });
  }
  if (contactId) {
    const contact = await c.db.customerContact.findUnique({ where: { id: contactId }, select: { customerId: true, status: true } });
    if (!contact || contact.customerId !== customerId) throw new ValidationError("That contact does not belong to this customer.", { contactId: "Choose a contact of this customer" });
    if (contact.status === "ARCHIVED" && already.contactId !== contactId) throw new ValidationError("That contact is archived.", { contactId: "Archived" });
  }
}
