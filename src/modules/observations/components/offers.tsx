import { FileText } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/application/states";
import { FreshnessBadge, RetractedBadge, StockBadge, VatBadge } from "@/components/application/status-badges";
import { TableShell } from "@/components/data-table/table-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatMoney, formatRelativeAge } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HistoryRow, LatestPrice, LatestStock, ProductOfferRow, SupplierIntelligenceRow } from "../procurement-queries";

type EvidenceHref = (observationId: string) => string;

/** Small icon link that opens the evidence drawer for one observation. */
export function EvidenceLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} scroll={false} aria-label={label} title={label} className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none">
      <FileText className="size-3.5" strokeWidth={1.5} aria-hidden />
    </Link>
  );
}

/** Price with currency and VAT state exactly as stated; never converted or compared across suppliers. */
export function PriceCell({ price, evidenceHref, now }: { price: LatestPrice | null; evidenceHref: EvidenceHref; now: Date }) {
  if (!price) return <span className="text-muted-foreground">No price</span>;
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="num font-medium">{formatMoney(price.amount, price.currencyCode)}</span>
          <VatBadge state={price.vatState} />
        </div>
        <div className="num text-xs text-muted-foreground" title={formatDateTime(price.observedAt)}>
          {formatRelativeAge(price.observedAt, now)}
        </div>
      </div>
      <EvidenceLink href={evidenceHref(price.id)} label="Open the evidence for this price" />
    </div>
  );
}

export function StockCell({ stock, evidenceHref, now }: { stock: LatestStock | null; evidenceHref: EvidenceHref; now: Date }) {
  if (!stock) return <span className="text-muted-foreground">No stock info</span>;
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <StockBadge status={stock.status} quantity={stock.quantity} />
        <div className="num mt-0.5 text-xs text-muted-foreground" title={formatDateTime(stock.observedAt)}>
          {formatRelativeAge(stock.observedAt, now)}
        </div>
      </div>
      <EvidenceLink href={evidenceHref(stock.id)} label="Open the evidence for this stock information" />
    </div>
  );
}

/** SUPPLIER INTELLIGENCE for one product: what each supplier most recently said about price and stock, with age and evidence. */
export function ProductIntelligenceTable({ rows, evidenceHref }: { rows: SupplierIntelligenceRow[]; evidenceHref: EvidenceHref }) {
  const now = new Date();
  if (rows.length === 0) {
    return (
      <TableShell>
        <EmptyState title="No supplier observations for this product" description="Observations appear here once a broadcast item linked to this product is confirmed." />
      </TableShell>
    );
  }
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[24%]">Supplier</TableHead>
            <TableHead className="w-[30%]">Price</TableHead>
            <TableHead className="w-[26%]">Stock</TableHead>
            <TableHead>Observed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.supplierId} className="align-top">
              <TableCell className="h-auto py-2">
                <Link href={`/suppliers/${row.supplierId}`} className="block truncate font-medium hover:underline">
                  {row.supplierName}
                </Link>
              </TableCell>
              <TableCell className="h-auto py-2">
                <PriceCell price={row.price} evidenceHref={evidenceHref} now={now} />
              </TableCell>
              <TableCell className="h-auto py-2">
                <StockCell stock={row.stock} evidenceHref={evidenceHref} now={now} />
              </TableCell>
              <TableCell className="h-auto py-2">
                <FreshnessBadge observedAt={row.latestObservedAt} now={now} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}

/** One supplier's latest quote per product (also that supplier's product list). */
export function SupplierOffersTable({ rows, evidenceHref }: { rows: ProductOfferRow[]; evidenceHref: EvidenceHref }) {
  const now = new Date();
  if (rows.length === 0) {
    return (
      <TableShell>
        <EmptyState title="No prices or stock recorded for this supplier yet" description="Confirmed broadcast items appear here as the supplier's latest price and stock per product." />
      </TableShell>
    );
  }
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[30%]">Product</TableHead>
            <TableHead className="w-[26%]">Price</TableHead>
            <TableHead className="w-[26%]">Stock</TableHead>
            <TableHead>Observed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.productId} className="align-top">
              <TableCell className="h-auto py-2">
                <Link href={`/products/${row.productId}`} className="block truncate font-medium hover:underline">
                  {row.productName}
                </Link>
                {row.partNumber ? <span className="block truncate font-mono text-xs text-muted-foreground">{row.partNumber}</span> : null}
              </TableCell>
              <TableCell className="h-auto py-2">
                <PriceCell price={row.price} evidenceHref={evidenceHref} now={now} />
              </TableCell>
              <TableCell className="h-auto py-2">
                <StockCell stock={row.stock} evidenceHref={evidenceHref} now={now} />
              </TableCell>
              <TableCell className="h-auto py-2">
                <FreshnessBadge observedAt={row.latestObservedAt} now={now} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}

/** Full observation history for a product. Retracted rows stay visible, struck through and tagged; nothing is hidden. */
export function HistoryTable({ rows, evidenceHref }: { rows: HistoryRow[]; evidenceHref: EvidenceHref }) {
  const now = new Date();
  if (rows.length === 0) return null;
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Stated</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10 text-right">
              <span className="sr-only">Evidence</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.kind}-${row.id}`} className={cn(row.retracted && "text-muted-foreground")}>
              <TableCell className="num">
                <span title={formatDateTime(row.observedAt)}>{formatRelativeAge(row.observedAt, now)}</span>
              </TableCell>
              <TableCell className="truncate">{row.supplierName}</TableCell>
              <TableCell className="capitalize">{row.kind}</TableCell>
              <TableCell className={cn("num", row.retracted && "line-through")}>
                {row.summary} {row.vatState ? <VatBadge state={row.vatState} /> : null}
              </TableCell>
              <TableCell>
                {row.retracted ? (
                  <span className="flex items-center gap-1.5" title={row.retractionReason ?? undefined}>
                    <RetractedBadge />
                    {row.retractionReason ? <span className="truncate text-xs">{row.retractionReason}</span> : null}
                  </span>
                ) : (
                  <span className="text-xs">Active</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <EvidenceLink href={evidenceHref(row.id)} label="Open evidence" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}

