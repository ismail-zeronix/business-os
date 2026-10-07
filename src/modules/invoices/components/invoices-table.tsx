import Link from "next/link";
import { InvoiceStatusPill } from "@/components/application/status-badges";
import { Unknown } from "@/components/application/states";
import { TableShell } from "@/components/data-table/table-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime, formatMoney, formatRelativeAge } from "@/lib/format";
import { quotationLabel } from "../../quotations/shared";
import type { InvoiceListRow } from "../queries";
import { invoiceReference } from "../shared";

/** Compact invoice table. The reference cell is the (stretched) link, so the whole row is clickable without client JavaScript. */
export function InvoicesTable({ rows }: { rows: InvoiceListRow[] }) {
  const now = new Date();
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-36">Invoice</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="w-32">Quotation</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-16 text-right">Lines</TableHead>
            <TableHead className="w-36 text-right">Total (incl. VAT)</TableHead>
            <TableHead className="w-32">Due</TableHead>
            <TableHead className="w-32">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="relative">
              <TableCell>
                <Link href={`/invoices/${row.id}`} className="block truncate font-mono text-xs font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/60 focus-visible:after:ring-inset">
                  {invoiceReference(row)}
                </Link>
              </TableCell>
              <TableCell>{row.customerName ? <span className="block truncate">{row.customerName}</span> : <Unknown dash />}</TableCell>
              <TableCell className="relative z-10">
                <Link href={`/quotations/${row.quotation.id}`} className="font-mono text-xs text-muted-foreground hover:underline">
                  {quotationLabel(row.quotation)}
                </Link>
              </TableCell>
              <TableCell>
                <InvoiceStatusPill status={row.status} />
              </TableCell>
              <TableCell className="num text-right">{row.lineCount}</TableCell>
              <TableCell className="num text-right">{formatMoney(row.total, row.currencyCode)}</TableCell>
              <TableCell className="num text-xs">{row.dueDate ? formatDate(row.dueDate) : <span className="text-muted-foreground">Not set</span>}</TableCell>
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
