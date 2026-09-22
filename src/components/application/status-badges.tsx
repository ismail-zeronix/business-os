import type { EmailBand, EnquiryPriority, EnquiryStatus, ExtractionConfidence, ItemReviewStatus, MatchBasis, QuotationStatus, RecordStatus, StockStatus, SupplierRequestStatus, VatState } from "@/generated/prisma/enums";
import { SoftPill, type PillTone } from "@/components/application/soft-pill";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatRelativeAge } from "@/lib/format";
import { getFreshnessBand, type FreshnessBand } from "@/lib/freshness";
import {
  CONFIDENCE_LABEL,
  EMAIL_BAND_LABEL,
  ENQUIRY_PRIORITY_LABEL,
  ENQUIRY_STATUS_LABEL,
  QUOTATION_STATUS_LABEL,
  RECORD_STATUS_LABEL,
  REVIEW_STATUS_LABEL,
  STOCK_STATUS_LABEL,
  SUPPLIER_REQUEST_STATUS_LABEL,
  VAT_STATE_LABEL,
} from "@/lib/labels";

/**
 * The status vocabulary (docs/design/UI_SYSTEM.md section 6). Every status chip in the app comes from here so tone and wording never drift.
 * Colour carries meaning only. "Unknown" is always rendered, muted, never blank.
 */

export function RecordStatusBadge({ status }: { status: RecordStatus }) {
  const variant = status === "ACTIVE" ? "success" : status === "ARCHIVED" ? "muted" : "neutral";
  return <Badge variant={variant}>{RECORD_STATUS_LABEL[status]}</Badge>;
}

export function ReviewStatusBadge({ status }: { status: ItemReviewStatus }) {
  const variant = status === "PENDING" ? "warning" : status === "CONFIRMED" ? "success" : "neutral";
  return <Badge variant={variant}>{REVIEW_STATUS_LABEL[status]}</Badge>;
}

/** Match state of a broadcast item against the product master. */
export function MatchBadge({ productId, basis }: { productId: string | null; basis: MatchBasis | null }) {
  if (!productId) return <Badge variant="warning">Unmatched</Badge>;
  if (basis === "PART_NUMBER") return <Badge variant="success">Exact</Badge>;
  if (basis === "MODEL" || basis === "ALIAS") return <Badge variant="info">Probable</Badge>;
  if (basis === "NEW_PRODUCT") return <Badge variant="success">New product</Badge>;
  return <Badge variant="success">Confirmed by you</Badge>; // MANUAL: an explicit human relink to an existing product
}

export function StockBadge({ status, quantity }: { status: StockStatus; quantity?: number | null }) {
  // A quantity with no stated status ("25pcs") is real information and must stay visible; only the status is unknown.
  if (status === "UNKNOWN") {
    return quantity != null ? (
      <Badge variant="neutral" className="num" title="Quantity stated; stock status not stated">
        {quantity.toLocaleString("en-US")} {quantity === 1 ? "pc" : "pcs"}
      </Badge>
    ) : (
      <Badge variant="muted">Unknown</Badge>
    );
  }
  const variant =
    status === "IN_STOCK" || status === "AVAILABLE"
      ? "success"
      : status === "LIMITED"
        ? "warning"
        : status === "INCOMING"
          ? "info"
          : status === "OUT_OF_STOCK"
            ? "danger"
            : "neutral"; // ON_REQUEST
  return (
    <Badge variant={variant}>
      {STOCK_STATUS_LABEL[status]}
      {quantity != null ? <span className="num">· {quantity.toLocaleString("en-US")}</span> : null}
    </Badge>
  );
}

export function VatBadge({ state }: { state: VatState }) {
  return <Badge variant={state === "UNKNOWN" ? "muted" : "neutral"}>{VAT_STATE_LABEL[state]}</Badge>;
}

export function ConfidenceBadge({ confidence }: { confidence: ExtractionConfidence | null }) {
  if (!confidence) return null;
  return <Badge variant="outline">{CONFIDENCE_LABEL[confidence]} confidence</Badge>;
}

const FRESHNESS_VARIANT: Record<FreshnessBand, "success" | "neutral" | "warning" | "muted"> = {
  fresh: "success",
  recent: "neutral",
  aging: "warning",
  stale: "muted",
};

/**
 * Observation age from the supplier's own timestamp, banded fresh / recent / aging / stale. Stale data stays visible but de-emphasised.
 * The absolute Dubai-time timestamp is in the tooltip. Computed on the server, so `now` is the request time.
 */
export function FreshnessBadge({ observedAt, now = new Date() }: { observedAt: Date; now?: Date }) {
  const band = getFreshnessBand(observedAt, now);
  return (
    <Badge variant={FRESHNESS_VARIANT[band]} title={`Observed ${formatDateTime(observedAt)}`} className="num">
      {formatRelativeAge(observedAt, now)}
      {band === "stale" ? " · Stale" : null}
    </Badge>
  );
}

// ── Design v2 (pilot): soft pills. One tone per meaning, defined here and nowhere else. ─────────────────────────────────────────────

/** NEW asks for attention (amber); working states are cool colours; with-the-customer states are warm/indigo; outcomes are settled. */
export const ENQUIRY_STATUS_TONE: Record<EnquiryStatus, PillTone> = {
  NEW: "amber",
  ASSIGNED: "sky",
  SOURCING: "blue",
  WAITING_SUPPLIER: "violet",
  QUOTATION_READY: "teal",
  QUOTED: "indigo",
  NEGOTIATION: "orange",
  FOLLOW_UP: "sky",
  WON: "green",
  LOST: "rose",
  ON_HOLD: "neutral",
};

export const ENQUIRY_PRIORITY_TONE: Record<EnquiryPriority, PillTone> = { URGENT: "red", HIGH: "orange", NORMAL: "neutral", LOW: "neutral" };
export const EMAIL_BAND_TONE: Record<EmailBand, PillTone> = { LIKELY: "green", REVIEW: "amber", LOW: "neutral" };

export function EnquiryStatusPill({ status }: { status: EnquiryStatus }) {
  return (
    <SoftPill tone={ENQUIRY_STATUS_TONE[status]} dot>
      {ENQUIRY_STATUS_LABEL[status]}
    </SoftPill>
  );
}

/** NORMAL is the quiet default: shown as plain muted text, so a coloured pill always means "look at this". */
export function PriorityPill({ priority }: { priority: EnquiryPriority }) {
  if (priority === "NORMAL") return <span className="text-xs text-muted-foreground">Normal</span>;
  return (
    <SoftPill tone={ENQUIRY_PRIORITY_TONE[priority]} dot={priority !== "LOW"}>
      {ENQUIRY_PRIORITY_LABEL[priority]}
    </SoftPill>
  );
}

export function EmailBandPill({ band, score }: { band: EmailBand; score?: number }) {
  return (
    <SoftPill tone={EMAIL_BAND_TONE[band]} dot title={score !== undefined ? `Score ${score} of 100` : undefined}>
      {EMAIL_BAND_LABEL[band]}
    </SoftPill>
  );
}

/** Waiting (sent, no reply yet) is violet; a reply is green; the two "not this time" outcomes are quiet. */
export const SUPPLIER_REQUEST_TONE: Record<SupplierRequestStatus, PillTone> = { DRAFT: "neutral", SENT: "violet", REPLIED: "green", NO_STOCK: "rose", DECLINED: "neutral" };

export function SupplierRequestStatusPill({ status }: { status: SupplierRequestStatus }) {
  return (
    <SoftPill tone={SUPPLIER_REQUEST_TONE[status]} dot={status !== "DRAFT"}>
      {SUPPLIER_REQUEST_STATUS_LABEL[status]}
    </SoftPill>
  );
}

/** A draft is still being worked on (amber), an issued quotation is what the customer has (green), a superseded one was replaced by a newer revision (quiet). */
export const QUOTATION_STATUS_TONE: Record<QuotationStatus, PillTone> = { DRAFT: "amber", ISSUED: "green", SUPERSEDED: "neutral" };

export function QuotationStatusPill({ status }: { status: QuotationStatus }) {
  return (
    <SoftPill tone={QUOTATION_STATUS_TONE[status]} dot>
      {QUOTATION_STATUS_LABEL[status]}
    </SoftPill>
  );
}

export function RetractedBadge() {
  return <Badge variant="danger">Retracted</Badge>;
}

export function TemporaryBadge() {
  return (
    <Badge variant="warning" title="Created from a broadcast; not yet curated">
      Temporary
    </Badge>
  );
}
