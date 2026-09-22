import Link from "next/link";
import { EmptyState, Unknown } from "@/components/application/states";
import { FreshnessBadge } from "@/components/application/status-badges";
import { TableShell } from "@/components/data-table/table-shell";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { EVIDENCE_CHANNEL_LABEL } from "@/lib/labels";
import type { BroadcastListRow } from "../queries";

/** Broadcast list: when it was received, from whom, and how far the review has got. The received-at cell is the (stretched) row link. */
export function BroadcastsTable({ rows, showSupplier = true }: { rows: BroadcastListRow[]; showSupplier?: boolean }) {
  const now = new Date();
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Received</TableHead>
            {showSupplier ? <TableHead>Supplier</TableHead> : null}
            <TableHead>Contact</TableHead>
            <TableHead>Via</TableHead>
            <TableHead className="text-right">Items</TableHead>
            <TableHead>Review progress</TableHead>
            <TableHead>Saved by</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="relative">
              <TableCell className="w-56">
                <Link href={`/broadcasts/${row.id}`} className="flex items-center gap-2 after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/60 focus-visible:after:ring-inset">
                  <span className="num truncate font-medium">{formatDateTime(row.observedAt)}</span>
                  <FreshnessBadge observedAt={row.observedAt} now={now} />
                </Link>
              </TableCell>
              {showSupplier ? <TableCell className="truncate">{row.supplierName}</TableCell> : null}
              <TableCell className="truncate">{row.contactName ?? <Unknown dash />}</TableCell>
              <TableCell>{EVIDENCE_CHANNEL_LABEL[row.channel]}</TableCell>
              <TableCell className="num text-right">{row.counts.total}</TableCell>
              <TableCell>
                {row.counts.total === 0 ? (
                  <span className="text-muted-foreground">No items extracted</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    {row.counts.pending > 0 ? <Badge variant="warning">{row.counts.pending} pending</Badge> : null}
                    {row.counts.confirmed > 0 ? <Badge variant="success">{row.counts.confirmed} confirmed</Badge> : null}
                    {row.counts.ignored > 0 ? <Badge variant="neutral">{row.counts.ignored} ignored</Badge> : null}
                    {row.archived ? <Badge variant="muted">Archived</Badge> : null}
                  </span>
                )}
              </TableCell>
              <TableCell className="truncate text-muted-foreground">{row.createdByName}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}

export function NoBroadcasts({ title = "No broadcasts yet", description = "Paste your first supplier message to start building price and stock intelligence.", action }: { title?: string; description?: string; action?: React.ReactNode }) {
  return (
    <TableShell>
      <EmptyState title={title} description={description} action={action} />
    </TableShell>
  );
}
