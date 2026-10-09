import type { EmailBand, EnquiryPriority, EnquiryStatus, ExtractionConfidence, InvoiceStatus, ItemReviewStatus, MatchBasis, QuotationStatus, RecordStatus, StockStatus, SupplierRequestStatus, TaskPriority, TaskStatus, VatState } from "@/generated/prisma/enums";
import type { SpecVerdict } from "@/modules/specs/verdict";
import type { TaskUrgency } from "@/modules/tasks/urgency";
import { SoftPill, type PillTone } from "@/components/application/soft-pill";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime, formatRelativeAge } from "@/lib/format";
import { getFreshnessBand, type FreshnessBand } from "@/lib/freshness";
import { cn } from "@/lib/utils";
import {
  CONFIDENCE_LABEL,
  EMAIL_BAND_LABEL,
  ENQUIRY_PRIORITY_LABEL,
  ENQUIRY_STATUS_LABEL,
  INVOICE_STATUS_LABEL,
  QUOTATION_STATUS_LABEL,
  RECORD_STATUS_LABEL,
  REVIEW_STATUS_LABEL,
  SPEC_VERDICT_LABEL,
  STOCK_STATUS_LABEL,
  SUPPLIER_REQUEST_STATUS_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
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

/** How well a candidate product's own specification satisfies a requirement's MUST attributes (src/modules/specs/verdict.ts). */
export const SPEC_VERDICT_TONE: Record<SpecVerdict, PillTone> = {
  EXACT: "green",
  UPGRADE: "sky",
  COMPATIBLE: "teal",
  PARTIAL: "amber",
  MISMATCH: "rose",
  UNKNOWN: "neutral",
};

export function SpecVerdictPill({ verdict, title }: { verdict: SpecVerdict; title?: string }) {
  return (
    <SoftPill tone={SPEC_VERDICT_TONE[verdict]} dot={verdict !== "UNKNOWN"} title={title}>
      {SPEC_VERDICT_LABEL[verdict]}
    </SoftPill>
  );
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

/** A draft is still being worked on (amber), issued is sent/current (sky), paid is done (green), cancelled is quiet. */
export const INVOICE_STATUS_TONE: Record<InvoiceStatus, PillTone> = { DRAFT: "amber", ISSUED: "sky", PAID: "green", CANCELLED: "neutral" };

export function InvoiceStatusPill({ status }: { status: InvoiceStatus }) {
  return (
    <SoftPill tone={INVOICE_STATUS_TONE[status]} dot>
      {INVOICE_STATUS_LABEL[status]}
    </SoftPill>
  );
}

/**
 * How far a broadcast's review has got, for the PageHeader `meta` slot: a thin bar of reviewed / total plus the count,
 * sized to sit comfortably next to the other `meta` SoftPills (e.g. the `{counts.pending} pending` pill on the Broadcast
 * review page). Same visual idea as enquiries-table.tsx's row-scoped `Progress` helper, but exported and differently
 * typed for this navbar use case — that one stays private to its table and is not reused here.
 */
export function ReviewProgressPill({ counts }: { counts: { total: number; pending: number; confirmed: number; ignored: number } }) {
  if (counts.total === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const reviewed = counts.confirmed + counts.ignored;
  return (
    <div
      className="flex h-6 items-center gap-1.5 text-xs text-muted-foreground"
      title={`${counts.confirmed} confirmed, ${counts.ignored} ignored, ${counts.pending} pending`}
    >
      <span aria-hidden className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full", counts.pending === 0 ? "bg-emerald-500" : "bg-brand")}
          style={{ width: `${Math.round((reviewed / counts.total) * 100)}%` }}
        />
      </span>
      <span className="num">
        {reviewed}/{counts.total} reviewed
      </span>
    </div>
  );
}

export const TASK_PRIORITY_TONE: Record<TaskPriority, PillTone> = { URGENT: "red", HIGH: "orange", NORMAL: "neutral", LOW: "neutral" };

/** NORMAL is the quiet default: plain muted text, so a coloured pill always means "look at this" - same rule as Enquiry's PriorityPill. */
export function TaskPriorityPill({ priority }: { priority: TaskPriority }) {
  if (priority === "NORMAL") return <span className="text-xs text-muted-foreground">Normal</span>;
  return (
    <SoftPill tone={TASK_PRIORITY_TONE[priority]} dot={priority !== "LOW"}>
      {TASK_PRIORITY_LABEL[priority]}
    </SoftPill>
  );
}

export const TASK_STATUS_TONE: Record<TaskStatus, PillTone> = { OPEN: "sky", DONE: "green", CANCELLED: "neutral" };

export function TaskStatusPill({ status }: { status: TaskStatus }) {
  return (
    <SoftPill tone={TASK_STATUS_TONE[status]} dot={status !== "CANCELLED"}>
      {TASK_STATUS_LABEL[status]}
    </SoftPill>
  );
}

const TASK_URGENCY_VARIANT: Record<TaskUrgency, "neutral" | "warning" | "danger"> = { normal: "neutral", aging: "warning", overdue: "danger" };

/**
 * How late a task is: a due date wins when one is set ("Due 12 Oct" / "Overdue 3 days ago"), otherwise the age of
 * whatever the urgency is computed from (an enquiry's last activity, an email's receipt, a task's creation).
 */
export function TaskUrgencyBadge({ urgency, dueAt, anchorAt, now = new Date() }: { urgency: TaskUrgency; dueAt: Date | null; anchorAt: Date; now?: Date }) {
  const label = dueAt ? (urgency === "overdue" ? `Overdue, due ${formatDate(dueAt)}` : `Due ${formatDate(dueAt)}`) : formatRelativeAge(anchorAt, now);
  return (
    <Badge variant={TASK_URGENCY_VARIANT[urgency]} className="num" title={dueAt ? `Due ${formatDateTime(dueAt)}` : `Since ${formatDateTime(anchorAt)}`}>
      {label}
    </Badge>
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
