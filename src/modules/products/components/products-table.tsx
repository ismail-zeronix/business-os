import Link from "next/link";
import { Unknown } from "@/components/application/states";
import { FreshnessBadge, RecordStatusBadge, TemporaryBadge, VatBadge } from "@/components/application/status-badges";
import { TableShell } from "@/components/data-table/table-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import type { ProductListRow } from "../queries";

/** Compact product table. The name is the stretched link (whole row clickable without client JS); part numbers use the mono face. */
export function ProductsTable({ rows }: { rows: ProductListRow[] }) {
  const now = new Date();
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[28%]">Product</TableHead>
            <TableHead>Part Number</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Latest observation</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const subtitle = [row.brandName, row.categoryName, row.model].filter(Boolean).join(" · ");
            return (
              <TableRow key={row.id} className="relative">
                <TableCell>
                  <Link href={`/products/${row.id}`} className="block py-2 font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/60 focus-visible:after:ring-inset">
                    <div className="text-sm text-foreground break-words">{row.name}</div>
                    {subtitle && <div className="text-xs text-muted-foreground break-words mt-0.5">{subtitle}</div>}
                    {row.description && (
                      <div className="text-xs text-muted-foreground break-words mt-1 whitespace-pre-wrap">{row.description}</div>
                    )}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs">{row.partNumber ?? <Unknown dash />}</TableCell>
                <TableCell>
                  {row.supplierName ? (
                    <>
                      {row.supplierName}
                      {row.supplierCount > 1 && <span className="text-muted-foreground text-xs"> +{row.supplierCount - 1}</span>}
                    </>
                  ) : (
                    <Unknown dash />
                  )}
                </TableCell>
                <TableCell>
                  {row.latestPrice ? (
                    <div className="flex items-center gap-2">
                      <span className="num font-medium">{formatMoney(row.latestPrice.amount, row.latestPrice.currencyCode)}</span>
                      <VatBadge state={row.latestPrice.vatState} />
                    </div>
                  ) : (
                    <Unknown dash />
                  )}
                </TableCell>
                <TableCell>{row.latestObservedAt ? <FreshnessBadge observedAt={row.latestObservedAt} now={now} /> : <span className="text-muted-foreground">No observations</span>}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <RecordStatusBadge status={row.status} />
                    {row.isTemporary ? <TemporaryBadge /> : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableShell>
  );
}
