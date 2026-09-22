import Link from "next/link";
import { FreshnessBadge, RecordStatusBadge } from "@/components/application/status-badges";
import { Unknown } from "@/components/application/states";
import { TableShell } from "@/components/data-table/table-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SUPPLIER_TYPE_LABEL } from "@/lib/labels";
import type { SupplierListRow } from "../queries";

/** "Dell, HP +2" with the full list in the tooltip. */
function ChipList({ items, max = 2 }: { items: { id: string; name: string }[]; max?: number }) {
  if (items.length === 0) return <Unknown dash />;
  const shown = items.slice(0, max).map((i) => i.name).join(", ");
  const extra = items.length - max;
  return (
    <span title={items.map((i) => i.name).join(", ")} className="block truncate">
      {shown}
      {extra > 0 ? <span className="text-muted-foreground"> +{extra}</span> : null}
    </span>
  );
}

/** Compact supplier table. The name cell is the (stretched) link, so the whole row is clickable without client JavaScript. */
export function SuppliersTable({ rows }: { rows: SupplierListRow[] }) {
  const now = new Date();
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[24%]">Supplier</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Brands</TableHead>
            <TableHead>Categories</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Payment terms</TableHead>
            <TableHead>Last evidence</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const location = [row.emirate, row.country].filter(Boolean).join(", ");
            return (
              <TableRow key={row.id} className="relative">
                <TableCell>
                  <Link href={`/suppliers/${row.id}`} className="block truncate font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/60 focus-visible:after:ring-inset">
                    {row.name}
                  </Link>
                  {row.legalName && row.legalName !== row.name ? <span className="block truncate text-xs text-muted-foreground">{row.legalName}</span> : null}
                </TableCell>
                <TableCell>{row.type ? SUPPLIER_TYPE_LABEL[row.type] : <Unknown dash />}</TableCell>
                <TableCell>
                  <ChipList items={row.brands} />
                </TableCell>
                <TableCell>
                  <ChipList items={row.categories} />
                </TableCell>
                <TableCell>{location || <Unknown dash />}</TableCell>
                <TableCell className="truncate">{row.paymentTerms ?? <Unknown dash />}</TableCell>
                <TableCell>{row.lastEvidenceAt ? <FreshnessBadge observedAt={row.lastEvidenceAt} now={now} /> : <span className="text-muted-foreground">No evidence</span>}</TableCell>
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
