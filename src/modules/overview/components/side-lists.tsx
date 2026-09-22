import Link from "next/link";
import { EmptyState } from "@/components/application/states";
import { EmailBandPill, FreshnessBadge } from "@/components/application/status-badges";
import { InitialsAvatar, SoftPill } from "@/components/application/soft-pill";
import { formatDateTime, formatRelativeAge } from "@/lib/format";
import { buildHref, type SearchParams } from "@/lib/search-params";
import type { BroadcastListRow } from "@/modules/broadcasts/queries";
import type { EmailListRow } from "@/modules/email/queries";
import { enquiryReference } from "@/modules/enquiries/components/enquiries-table";
import { EvidenceLink } from "@/modules/observations/components/offers";
import type { RecentObservation } from "@/modules/observations/procurement-queries";
import type { WaitingRequestRow } from "../queries";

const LIST = "divide-y divide-border/70";
const ROW = "flex items-center justify-between gap-3 px-4 py-3 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset";

/** Sourcing requests sent and not answered yet, longest wait first. The enquiry is the row link; the age is from when the request was sent. */
export function WaitingList({ rows, now }: { rows: WaitingRequestRow[]; now: Date }) {
  if (rows.length === 0) return <EmptyState title="No supplier is being waited on" description="Requests you send from an enquiry's Sourcing tab appear here until the supplier replies." />;
  return (
    <ul className={LIST}>
      {rows.map((row) => (
        <li key={row.id}>
          <Link href={`/enquiries/${row.enquiryId}?view=sourcing`} className={ROW}>
            <div className="flex min-w-0 items-center gap-3">
              <InitialsAvatar name={row.supplierName} size={32} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{row.supplierName}</div>
                <div className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{enquiryReference(row.enquiryNumber)}</span> · {row.customerName ?? "No customer"}
                </div>
              </div>
            </div>
            <span className="num shrink-0 text-xs text-muted-foreground" title={row.sentAt ? formatDateTime(row.sentAt) : undefined}>
              {row.sentAt ? `Sent ${formatRelativeAge(row.sentAt, now)}` : "Sent time unknown"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Supplier messages with items still waiting for a person to confirm. */
export function BroadcastList({ rows, now }: { rows: BroadcastListRow[]; now: Date }) {
  if (rows.length === 0) return <EmptyState title="Nothing to review" description="Paste a supplier message to add more." />;
  return (
    <ul className={LIST}>
      {rows.map((row) => (
        <li key={row.id}>
          <Link href={`/broadcasts/${row.id}`} className={ROW}>
            <div className="flex min-w-0 items-center gap-3">
              <InitialsAvatar name={row.supplierName} size={32} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{row.supplierName}</div>
                <div className="num truncate text-xs text-muted-foreground">{formatDateTime(row.observedAt)}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <SoftPill tone="amber">{row.counts.pending} pending</SoftPill>
              <FreshnessBadge observedAt={row.observedAt} now={now} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The newest confirmed price and stock statements, each with a link to the original message. */
export function LatestPriceList({ rows, now, searchParams }: { rows: RecentObservation[]; now: Date; searchParams: SearchParams }) {
  if (rows.length === 0) return <EmptyState title="No observations yet" description="Confirmed broadcast items appear here as supplier prices and stock." />;
  return (
    <ul className={LIST}>
      {rows.map((row) => (
        <li key={`${row.kind}-${row.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <Link href={`/products/${row.productId}`} className="block truncate text-sm font-medium hover:underline">
              {row.productName}
            </Link>
            <div className="truncate text-xs text-muted-foreground">
              {row.supplierName} · <span className="num">{row.summary}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <FreshnessBadge observedAt={row.observedAt} now={now} />
            <EvidenceLink href={buildHref("/", { ...searchParams, tab: "prices" }, { evidence: row.id })} label="Open evidence" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Emails that may be enquiries. Nothing here becomes an enquiry until a person creates it (in the email queue). */
export function EmailList({ rows, now }: { rows: EmailListRow[]; now: Date }) {
  if (rows.length === 0) return <EmptyState title="No emails to triage" description="Sync mail to fetch new messages." />;
  return (
    <ul className={LIST}>
      {rows.map((row) => {
        const sender = row.fromName ?? row.fromAddress ?? "Unknown sender";
        return (
          <li key={row.id}>
            <Link href={`/enquiries?view=email&email=${row.id}`} className={ROW}>
              <div className="flex min-w-0 items-center gap-3">
                <InitialsAvatar name={sender} size={32} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{sender}</div>
                  <div className="truncate text-xs text-muted-foreground">{row.subject ?? "No subject"}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <EmailBandPill band={row.band} score={row.score} />
                <span className="num text-xs text-muted-foreground" title={formatDateTime(row.receivedAt)}>
                  {formatRelativeAge(row.receivedAt, now)}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
