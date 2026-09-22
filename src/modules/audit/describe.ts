/**
 * Turns an audit row into readable text for Activity timelines and the Audit page. Pure functions, no I/O.
 * Details are stored as JSON: { field: { from, to } } diffs, { added: [], removed: [] } association changes, and small context objects.
 */

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "supplier.created": "Supplier created",
  "supplier.updated": "Supplier updated",
  "supplier.status_changed": "Supplier status changed",
  "supplier.brands_changed": "Supplier brands changed",
  "supplier.categories_changed": "Supplier categories changed",
  "supplier_contact.created": "Contact added",
  "supplier_contact.updated": "Contact updated",
  "supplier_contact.archived": "Contact archived",
  "supplier_contact.brands_changed": "Contact brands changed",
  "supplier_contact.categories_changed": "Contact categories changed",
  "brand.created": "Brand created",
  "brand.updated": "Brand renamed",
  "brand.status_changed": "Brand status changed",
  "category.created": "Category created",
  "category.updated": "Category renamed",
  "category.status_changed": "Category status changed",
  "product.created": "Product created",
  "product.updated": "Product updated",
  "product.status_changed": "Product status changed",
  "product_alias.added": "Alias added",
  "product_alias.removed": "Alias removed",
  "broadcast.created": "Broadcast created",
  "broadcast.archived": "Broadcast archived",
  "broadcast.bulk_confirmed": "Ready items bulk-confirmed",
  "broadcast_item.created": "Broadcast item added",
  "broadcast_item.updated": "Broadcast item edited",
  "broadcast_item.linked": "Broadcast item linked to product",
  "broadcast_item.confirmed": "Broadcast item confirmed",
  "broadcast_item.ignored": "Broadcast item ignored",
  "broadcast_item.reopened": "Broadcast item reopened",
  "observation.created": "Observation recorded",
  "observation.retracted": "Observation retracted",
  "customer.created": "Customer created",
  "customer.updated": "Customer updated",
  "customer.status_changed": "Customer status changed",
  "customer_contact.created": "Customer contact added",
  "customer_contact.updated": "Customer contact updated",
  "customer_contact.archived": "Customer contact archived",
  "enquiry.created": "Enquiry created",
  "enquiry.updated": "Enquiry updated",
  "enquiry.status_changed": "Enquiry status changed",
  "enquiry.note_added": "Note added",
  "enquiry.archived": "Enquiry archived",
  "enquiry_item.created": "Requirement added",
  "enquiry_item.updated": "Requirement edited",
  "enquiry_item.linked": "Requirement linked to product",
  "enquiry_item.confirmed": "Requirement confirmed",
  "enquiry_item.ignored": "Requirement ignored",
  "enquiry_item.reopened": "Requirement reopened",
  "supplier_request.added": "Supplier added to sourcing",
  "supplier_request.removed": "Supplier removed from sourcing",
  "supplier_request.sent": "Request sent to supplier",
  "supplier_request.status_changed": "Supplier request status changed",
  "procurement_decision.chosen": "Supplier chosen",
  "procurement_decision.cleared": "Supplier choice cleared",
  "quotation.created": "Quotation created",
  "quotation.updated": "Quotation details updated",
  "quotation.line_added": "Quotation line added",
  "quotation.line_updated": "Quotation line updated",
  "quotation.line_removed": "Quotation line removed",
  "quotation.issued": "Quotation issued",
  "quotation.revised": "Quotation revised",
  "quotation.emailed": "Quotation emailed",
  "quotation.email_failed": "Quotation email failed",
  "smtp_account.created": "Outgoing email account added",
  "smtp_account.updated": "Outgoing email account updated",
  "smtp_account.password_changed": "Outgoing email password replaced",
  "smtp_account.status_changed": "Outgoing email account status changed",
  "smtp_account.tested": "Outgoing email account tested",
  "user.signature_changed": "Email signature changed",
  "user.created": "User added",
  "user.updated": "User updated",
  "user.password_changed": "Password changed",
  "user.password_reset": "Password reset by an admin",
  "user.status_changed": "User status changed",
  "user.signed_in": "Signed in",
  "email_account.created": "Email account added",
  "email_account.updated": "Email account updated",
  "email_account.password_changed": "Email account password replaced",
  "email_account.status_changed": "Email account status changed",
  "email_account.synced": "Mailbox synced",
  "email_message.enquiry_created": "Enquiry created from email",
  "email_message.dismissed": "Email dismissed",
  "email_message.restored": "Email restored to triage",
  "ai_provider.created": "AI provider added",
  "ai_provider.updated": "AI provider model changed",
  "ai_provider.key_changed": "AI provider key replaced",
  "ai_provider.activated": "AI provider switched",
  "ai_provider.deactivated": "AI switched off",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action;
}

/** "paymentTerms" -> "Payment terms" */
export function humanizeField(field: string): string {
  const spaced = field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const show = (value: unknown): string => (value === null || value === undefined || value === "" ? "—" : String(value));
const list = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

/** One short line per detail entry, e.g. "Payment terms: — → 30 days" or "Brands: added Dell, removed HP". */
export function describeDetails(details: unknown): string[] {
  if (!isRecord(details)) return [];
  const lines: string[] = [];
  for (const [key, value] of Object.entries(details)) {
    const label = humanizeField(key);
    if (isRecord(value) && ("from" in value || "to" in value)) {
      lines.push(`${label}: ${show(value.from)} → ${show(value.to)}`);
    } else if (isRecord(value) && ("added" in value || "removed" in value)) {
      const parts = [
        list(value.added).length ? `added ${list(value.added).join(", ")}` : null,
        list(value.removed).length ? `removed ${list(value.removed).join(", ")}` : null,
      ].filter(Boolean);
      if (parts.length) lines.push(`${label}: ${parts.join(", ")}`);
    } else if (Array.isArray(value)) {
      if (value.length) lines.push(`${label}: ${list(value).join(", ")}`);
    } else if (value !== null && value !== undefined && value !== "") {
      lines.push(`${label}: ${show(value)}`);
    }
  }
  return lines;
}
