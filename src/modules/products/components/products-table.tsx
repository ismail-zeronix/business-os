import Link from "next/link";
import { Unknown } from "@/components/application/states";
import { FreshnessBadge, RecordStatusBadge, TemporaryBadge } from "@/components/application/status-badges";
import { TableShell } from "@/components/data-table/table-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProductListRow } from "../queries";

/** Compact product table. The name is the stretched link (whole row clickable without client JS); part numbers use the mono face. */
export function ProductsTable({ rows }: { rows: ProductListRow[] }) {
  const now = new Date();
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[34%]">Product</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Suppliers</TableHead>
            <TableHead>Latest observation</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="relative">
              <TableCell>
                <Link href={`/products/${row.id}`} className="block truncate font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/60 focus-visible:after:ring-inset">
                  {row.name}
                </Link>
                {row.partNumber ? <span className="block truncate font-mono text-xs text-muted-foreground">{row.partNumber}</span> : null}
              </TableCell>
              <TableCell>{row.brandName ?? <Unknown dash />}</TableCell>
              <TableCell>{row.categoryName ?? <Unknown dash />}</TableCell>
              <TableCell className="num text-right">{row.supplierCount > 0 ? row.supplierCount : <span className="text-muted-foreground">0</span>}</TableCell>
              <TableCell>{row.latestObservedAt ? <FreshnessBadge observedAt={row.latestObservedAt} now={now} /> : <span className="text-muted-foreground">No observations</span>}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <RecordStatusBadge status={row.status} />
                  {row.isTemporary ? <TemporaryBadge /> : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}
