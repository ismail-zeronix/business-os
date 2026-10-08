import Link from "next/link";
import { InitialsAvatar } from "@/components/application/soft-pill";
import { RecordStatusBadge } from "@/components/application/status-badges";
import { Unknown } from "@/components/application/states";
import { TableShell } from "@/components/data-table/table-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatRelativeAge } from "@/lib/format";
import type { CustomerListRow } from "../queries";

/** Compact customer table. The name cell is the (stretched) link, so the whole row is clickable without client JavaScript. */
export function CustomersTable({ rows }: { rows: CustomerListRow[] }) {
  const now = new Date();
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[26%]">Customer</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead className="text-right">Contacts</TableHead>
            <TableHead className="text-right">Open enquiries</TableHead>
            <TableHead>Last enquiry</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const location = [row.emirate, row.country].filter(Boolean).join(", ");
            return (
              <TableRow key={row.id} className="relative">
                <TableCell>
                  <Link href={`/customers/${row.id}`} className="block truncate font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/60 focus-visible:after:ring-inset">
                    {row.name}
                  </Link>
                  {row.legalName && row.legalName !== row.name ? <span className="block truncate text-xs text-muted-foreground">{row.legalName}</span> : null}
                </TableCell>
                <TableCell>{location || <Unknown dash />}</TableCell>
                <TableCell className="text-xs">
                  {row.owner ? (
                    <div className="flex items-center gap-2">
                      <InitialsAvatar name={row.owner.name} size={24} />
                      <span className="truncate">{row.owner.name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Shared</span>
                  )}
                </TableCell>
                <TableCell className="num text-right">{row.contactCount}</TableCell>
                <TableCell className="num text-right">{row.openEnquiries || <span className="text-muted-foreground">0</span>}</TableCell>
                <TableCell className="num text-xs" title={row.lastEnquiryAt ? formatDateTime(row.lastEnquiryAt) : undefined}>
                  {row.lastEnquiryAt ? formatRelativeAge(row.lastEnquiryAt, now) : <span className="text-muted-foreground">No enquiries</span>}
                </TableCell>
                <TableCell>
                  <RecordStatusBadge status={row.status} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableShell>
  );
}
