import type {
  AiProvider,
  EmailBand,
  EmailSecurity,
  EmailTriageStatus,
  EnquiryPriority,
  EnquiryStatus,
  EvidenceChannel,
  EvidenceKind,
  ExtractionConfidence,
  ItemReviewStatus,
  MatchBasis,
  PreferredChannel,
  QuotationStatus,
  RecordStatus,
  StockStatus,
  SupplierRequestStatus,
  SupplierType,
  UserRole,
  VatState,
} from "../generated/prisma/enums";

/** Human labels for enums: one place, so wording never drifts between screens (docs/design/UI_SYSTEM.md section 6). Pure, client-safe. */

export const RECORD_STATUS_LABEL: Record<RecordStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
};

export const SUPPLIER_TYPE_LABEL: Record<SupplierType, string> = {
  AUTHORIZED_DISTRIBUTOR: "Authorized Distributor",
  DISTRIBUTOR: "Distributor",
  STOCKIST: "Stockist",
  RESELLER: "Reseller",
  TRADER: "Trader",
  IMPORTER: "Importer",
  MARKETPLACE_SELLER: "Marketplace Seller",
  SERVICE_PROVIDER: "Service Provider",
  PROJECT_PARTNER: "Project Partner",
};

export const PREFERRED_CHANNEL_LABEL: Record<PreferredChannel, string> = {
  PHONE: "Phone",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
};

/** What kind of proof a price rests on. A direct confirmation is a person typing what a supplier told them, with a note as the record. */
export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  SUPPLIER_BROADCAST: "Supplier message",
  SUPPLIER_CONFIRMATION: "Direct confirmation (typed in, with a note)",
  CUSTOMER_ENQUIRY: "Customer enquiry",
  CUSTOMER_EMAIL: "Customer email",
};

export const EVIDENCE_CHANNEL_LABEL: Record<EvidenceChannel, string> = {
  MANUAL_PASTE: "Manual entry",
  PHONE: "Phone call",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  OTHER: "Other",
};

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  IN_STOCK: "In stock",
  LIMITED: "Limited",
  AVAILABLE: "Available",
  INCOMING: "Incoming",
  ON_REQUEST: "On request",
  OUT_OF_STOCK: "Out of stock",
  UNKNOWN: "Unknown",
};

export const VAT_STATE_LABEL: Record<VatState, string> = {
  INCLUDED: "Incl. VAT",
  EXCLUDED: "Excl. VAT",
  UNKNOWN: "VAT unknown",
};

export const REVIEW_STATUS_LABEL: Record<ItemReviewStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  IGNORED: "Ignored",
};

export const CONFIDENCE_LABEL: Record<ExtractionConfidence, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

/** How an item came to be linked to its product. */
export const MATCH_BASIS_LABEL: Record<MatchBasis, string> = {
  PART_NUMBER: "Part number",
  MODEL: "Model",
  ALIAS: "Alias",
  MANUAL: "Chosen by you",
  NEW_PRODUCT: "New product",
};

export const ENQUIRY_STATUS_LABEL: Record<EnquiryStatus, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  SOURCING: "Sourcing",
  WAITING_SUPPLIER: "Waiting supplier",
  QUOTATION_READY: "Quote ready",
  QUOTED: "Quoted",
  NEGOTIATION: "Negotiation",
  FOLLOW_UP: "Follow up",
  WON: "Won",
  LOST: "Lost",
  ON_HOLD: "On hold",
};

/** Stable order for status selects: the working flow first, then outcomes. */
export const ENQUIRY_STATUS_ORDER: readonly EnquiryStatus[] = ["NEW", "ASSIGNED", "SOURCING", "WAITING_SUPPLIER", "QUOTATION_READY", "QUOTED", "NEGOTIATION", "FOLLOW_UP", "ON_HOLD", "WON", "LOST"];

export const ENQUIRY_PRIORITY_LABEL: Record<EnquiryPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const SUPPLIER_REQUEST_STATUS_LABEL: Record<SupplierRequestStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  REPLIED: "Replied",
  NO_STOCK: "No stock",
  DECLINED: "Declined",
};

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  SUPERSEDED: "Superseded",
};

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Admin",
  STAFF: "Staff",
};

export const EMAIL_BAND_LABEL: Record<EmailBand, string> = {
  LIKELY: "Likely enquiry",
  REVIEW: "Review",
  LOW: "Low",
};

export const EMAIL_TRIAGE_LABEL: Record<EmailTriageStatus, string> = {
  NEW: "To triage",
  ENQUIRY_CREATED: "Enquiry created",
  DISMISSED: "Dismissed",
};

export const EMAIL_SECURITY_LABEL: Record<EmailSecurity, string> = {
  SSL_TLS: "SSL/TLS",
  STARTTLS: "STARTTLS",
};

export const AI_PROVIDER_LABEL: Record<AiProvider, string> = {
  ANTHROPIC: "Anthropic Claude",
  OPENAI: "OpenAI",
  GEMINI: "Google Gemini",
};

/** Options for <select> controls, in a stable, deliberate order. */
export function toOptions<T extends string>(labels: Record<T, string>, order?: readonly T[]): { value: T; label: string }[] {
  const keys = (order ?? (Object.keys(labels) as T[])) as readonly T[];
  return keys.map((value) => ({ value, label: labels[value] }));
}
