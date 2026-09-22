import { PanelRight } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/application/states";
import { EnquiryStatusPill, PriorityPill } from "@/components/application/status-badges";
import { InitialsAvatar } from "@/components/application/soft-pill";
import { TableShell } from "@/components/data-table/table-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatRelativeAge } from "@/lib/format";
import { EVIDENCE_CHANNEL_LABEL } from "@/lib/labels";
import type { EnquiryListRow } from "../queries";

export const enquiryReference = (number: number) => `ENQ-${String(number).padStart(5, "0")}`;

function Requirement({ row }: { row: EnquiryListRow }) {
  if (row.requirements.length === 0) {
    return (
      <>
        <span className="block truncate text-muted-foreground">No requirements recognised</span>
        {row.subject ? <span className="block truncate text-xs text-muted-foreground">{row.subject}</span> : null}
      </>
    );
  }
  const more = row.counts.total - 1;
  return (
    <>
      <span className="block truncate font-medium" title={row.requirements.join(" · ")}>
        {row.requirements[0]}
      </span>
      <span className="block truncate text-xs text-muted-foreground">{more > 0 ? `+${more} more ${more === 1 ? "requirement" : "requirements"}` : (row.subject ?? "1 requirement")}</span>
    </>
  );
}

/** How far the review has got: a thin bar of reviewed / total, with the count. Pending work is the part of the bar that is missing. */
function Progress({ counts }: { counts: EnquiryListRow["counts"] }) {
  if (counts.total === 0) return <span className="text-muted-foreground">—</span>;
  const reviewed = counts.confirmed + counts.ignored;
  return (
    <div className="flex items-center gap-2" title={`${counts.confirmed} confirmed, ${counts.ignored} ignored, ${counts.pending} pending`}>
      <span aria-hidden className="h-1.5 w-14 overflow-hidden rounded-full bg-zinc-200">
        <span className={counts.pending === 0 ? "block h-full rounded-full bg-emerald-500" : "block h-full rounded-full bg-brand"} style={{ width: `${Math.round((reviewed / counts.total) * 100)}%` }} />
      </span>
      <span className="num text-xs text-muted-foreground">
        {reviewed}/{counts.total}
      </span>
    </div>
  );
}

/**
 * Design v2 (pilot). The operational inbox: who asked, what they need, how far the review is, where it stands and how long it has waited
 * (age is from when the customer sent it). The reference cell is the (stretched) row link, so the whole row opens the workspace without
 * JavaScript; the trailing button opens the quick view. `bare` drops the outer border so the table can sit inside a <Panel>.
 */
export function EnquiriesTable({ rows, showCustomer = true, bare = false, peekHref }: { rows: EnquiryListRow[]; showCustomer?: boolean; bare?: boolean; peekHref?: (enquiryId: string) => string }) {
  const now = new Date();
  const table = (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-10 w-[25%] bg-transparent px-4">{showCustomer ? "Customer" : "Enquiry"}</TableHead>
          <TableHead className="h-10 w-[27%] bg-transparent px-4">Requirement</TableHead>
          <TableHead className="h-10 w-[13%] bg-transparent px-4">Review</TableHead>
          <TableHead className="h-10 w-[12%] bg-transparent px-4">Status</TableHead>
          <TableHead className="h-10 w-[9%] bg-transparent px-4">Priority</TableHead>
          <TableHead className="h-10 w-[9%] bg-transparent px-4 text-right">Age</TableHead>
          {peekHref ? <TableHead className="h-10 w-[5%] min-w-12 bg-transparent px-2" aria-label="Quick view" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const who = row.customerName ?? row.requesterName ?? row.requesterEmail;
          return (
            <TableRow key={row.id} className="relative border-border/70 hover:bg-zinc-50/80">
              <TableCell className="h-[60px] px-4 py-2">
                <div className="flex items-center gap-3">
                  {showCustomer ? <InitialsAvatar name={who ?? "?"} muted={!row.customerName} /> : null}
                  <div className="min-w-0">
                    {showCustomer ? (
                      <span className={row.customerName ? "block truncate font-medium" : "block truncate font-medium text-muted-foreground"} title={row.customerName ? undefined : "Not a saved customer"}>
                        {who ?? "No customer"}
                      </span>
                    ) : null}
                    <Link
                      href={`/enquiries/${row.id}`}
                      className="block truncate text-xs text-muted-foreground after:absolute after:inset-0 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/60 focus-visible:after:ring-inset"
                    >
                      <span className="font-mono">{enquiryReference(row.number)}</span> · {EVIDENCE_CHANNEL_LABEL[row.channel]}
                    </Link>
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-4 py-2">
                <Requirement row={row} />
              </TableCell>
              <TableCell className="px-4 py-2">
                <Progress counts={row.counts} />
              </TableCell>
              <TableCell className="px-4 py-2">
                <EnquiryStatusPill status={row.status} />
              </TableCell>
              <TableCell className="px-4 py-2">
                <PriorityPill priority={row.priority} />
              </TableCell>
              <TableCell className="num px-4 py-2 text-right text-xs text-muted-foreground" title={formatDateTime(row.observedAt)}>
                {formatRelativeAge(row.observedAt, now)}
              </TableCell>
              {peekHref ? (
                <TableCell className="w-[5%] min-w-12 px-2 py-2">
                  <Link
                    href={peekHref(row.id)}
                    scroll={false}
                    aria-label={`Quick view of ${enquiryReference(row.number)}`}
                    title="Quick view"
                    className="relative z-10 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-zinc-100 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    <PanelRight className="size-4" strokeWidth={1.5} aria-hidden />
                  </Link>
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
  return bare ? table : <TableShell className="rounded-lg">{table}</TableShell>;
}

export function NoEnquiries({ title = "No enquiries yet", description = "Paste a customer request to start recording what people need.", action, bare = false }: { title?: string; description?: string; action?: React.ReactNode; bare?: boolean }) {
  const empty = <EmptyState title={title} description={description} action={action} />;
  return bare ? <div className="py-10">{empty}</div> : <TableShell>{empty}</TableShell>;
}
