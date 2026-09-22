import Link from "next/link";
import { QuotationStatusPill } from "@/components/application/status-badges";
import { Unknown } from "@/components/application/states";
import { TableShell } from "@/components/data-table/table-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { enquiryReference } from "@/modules/enquiries/shared";
import { formatDate, formatDateTime, formatMoney, formatRelativeAge } from "@/lib/format";
import type { QuotationListRow } from "../queries";
import { quotationLabel } from "../shared";

/** Compact quotation table. The reference cell is the (stretched) link, so the whole row is clickable without client JavaScript. */
export function QuotationsTable({ rows }: { rows: QuotationListRow[] }) {
  const now = new Date();
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-36">Quotation</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="w-28">Enquiry</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-16 text-right">Lines</TableHead>
            <TableHead className="w-36 text-right">Total (incl. VAT)</TableHead>
            <TableHead className="w-32">Valid until</TableHead>
            <TableHead className="w-32">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="relative">
              <TableCell>
                <Link href={`/quotations/${row.id}`} className="block truncate font-mono text-xs font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/60 focus-visible:after:ring-inset">
                  {quotationLabel(row)}
                </Link>
              </TableCell>
              <TableCell>{row.customerName ? <span className="block truncate">{row.customerName}</span> : <Unknown dash />}</TableCell>
              <TableCell className="relative z-10">
                {row.enquiry ? (
                  <Link href={`/enquiries/${row.enquiry.id}`} className="font-mono text-xs text-muted-foreground hover:underline">
                    {enquiryReference(row.enquiry.number)}
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">Manual</span>
                )}
              </TableCell>
              <TableCell>
                <QuotationStatusPill status={row.status} />
              </TableCell>
              <TableCell className="num text-right">{row.lineCount}</TableCell>
              <TableCell className="num text-right" title={row.incompleteLines ? `${row.incompleteLines} line(s) not priced yet are not counted` : undefined}>
                {formatMoney(row.total, row.currencyCode)}
                {row.incompleteLines ? <span className="text-warning"> *</span> : null}
              </TableCell>
              <TableCell className="num text-xs">{row.validUntil ? formatDate(row.validUntil) : <span className="text-muted-foreground">Not set</span>}</TableCell>
              <TableCell className="num text-xs" title={formatDateTime(row.updatedAt)}>
                {formatRelativeAge(row.updatedAt, now)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}
