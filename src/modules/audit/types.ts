import type { Prisma } from "../../generated/prisma/client";

/** Entity types that can appear in the audit log. Extend deliberately; the audit page filters on these. */
export const AUDIT_ENTITY_TYPES = [
  "Supplier",
  "SupplierContact",
  "Brand",
  "Category",
  "Product",
  "ProductAlias",
  "Broadcast",
  "BroadcastItem",
  "PriceObservation",
  "StockObservation",
  "Customer",
  "CustomerContact",
  "Enquiry",
  "EnquiryItem",
  "SupplierRequest",
  "ProcurementDecision",
  "Quotation",
  "User",
  "EmailAccount",
  "SmtpAccount",
  "EmailMessage",
  "AiProviderSetting",
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/** Namespaced action names, defined in one place so they never drift (docs/architecture/DATA_MODEL.md section 7). */
export type AuditAction =
  | "supplier.created"
  | "supplier.updated"
  | "supplier.status_changed"
  | "supplier.brands_changed"
  | "supplier.categories_changed"
  | "supplier_contact.created"
  | "supplier_contact.updated"
  | "supplier_contact.archived"
  | "supplier_contact.brands_changed"
  | "supplier_contact.categories_changed"
  | "brand.created"
  | "brand.updated"
  | "brand.status_changed"
  | "category.created"
  | "category.updated"
  | "category.status_changed"
  | "product.created"
  | "product.updated"
  | "product.status_changed"
  | "product_alias.added"
  | "product_alias.removed"
  | "broadcast.created"
  | "broadcast.archived"
  | "broadcast.bulk_confirmed"
  | "broadcast_item.created"
  | "broadcast_item.updated"
  | "broadcast_item.linked"
  | "broadcast_item.confirmed"
  | "broadcast_item.ignored"
  | "broadcast_item.reopened"
  | "observation.created"
  | "observation.retracted"
  | "customer.created"
  | "customer.updated"
  | "customer.status_changed"
  | "customer_contact.created"
  | "customer_contact.updated"
  | "customer_contact.archived"
  | "enquiry.created"
  | "enquiry.updated"
  | "enquiry.status_changed"
  | "enquiry.note_added"
  | "enquiry.archived"
  | "enquiry_item.created"
  | "enquiry_item.updated"
  | "enquiry_item.linked"
  | "enquiry_item.confirmed"
  | "enquiry_item.ignored"
  | "enquiry_item.reopened"
  | "supplier_request.added"
  | "supplier_request.removed"
  | "supplier_request.sent"
  | "supplier_request.status_changed"
  | "procurement_decision.chosen"
  | "procurement_decision.cleared"
  | "quotation.created"
  | "quotation.updated"
  | "quotation.line_added"
  | "quotation.line_updated"
  | "quotation.line_removed"
  | "quotation.issued"
  | "quotation.revised"
  | "quotation.emailed"
  | "quotation.email_failed"
  | "smtp_account.created"
  | "smtp_account.updated"
  | "smtp_account.password_changed"
  | "smtp_account.status_changed"
  | "smtp_account.tested"
  | "user.signature_changed"
  | "user.created"
  | "user.updated"
  | "user.password_changed"
  | "user.password_reset"
  | "user.status_changed"
  | "user.signed_in"
  | "email_account.created"
  | "email_account.updated"
  | "email_account.password_changed"
  | "email_account.status_changed"
  | "email_account.synced"
  | "email_message.enquiry_created"
  | "email_message.dismissed"
  | "email_message.restored"
  | "ai_provider.created"
  | "ai_provider.updated"
  | "ai_provider.key_changed"
  | "ai_provider.activated"
  | "ai_provider.deactivated";

/** The aggregate that "owns" a change, so an entity's Activity tab can include its children (a contact edit is scoped to its Supplier). */
export type AuditScope = { type: AuditEntityType; id: string };

export type AuditEntry = {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  scope?: AuditScope;
  /** Field diffs as { field: { from, to } }, reasons and other context. Must be JSON-serialisable. */
  details?: Prisma.InputJsonValue;
};
