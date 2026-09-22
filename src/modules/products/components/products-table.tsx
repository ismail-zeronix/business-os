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
            <TableHead className="w-[35%]">Product</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Part Number</TableHead>
            <TableHead className="text-right">Suppliers</TableHead>
            <TableHead>Latest observation</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="relative">
              <TableCell>
                <Link href={`/products/${row.id}`} className="block py-2 font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/60 focus-visible:after:ring-inset">
                  <div className="text-sm text-gray-900 break-words">{row.name}</div>
                  {row.description && (
                    <div className="text-xs text-gray-500 break-words mt-1 whitespace-pre-wrap">{row.description}</div>
                  )}
                </Link>
              </TableCell>
              <TableCell>
                {row.supplierName ? (
                  <>
                    {row.supplierName}
                    {row.supplierCount > 1 && <span className="text-muted-foreground text-xs"> +{row.supplierCount - 1}</span>}
                  </>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>{row.categoryName ?? <Unknown dash />}</TableCell>
              <TableCell>{row.model ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs">{row.partNumber ?? "—"}</TableCell>
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
