import Link from "next/link";
import { VatBadge } from "@/components/application/status-badges";
import { TableShell } from "@/components/data-table/table-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatMoney, formatRelativeAge } from "@/lib/format";
import { EvidenceLink } from "@/modules/observations/components/offers";
import { centsToAmount, lineMarginCents, lineTotalCents } from "../pricing";
import type { QuotationDetail, QuotationLineDetail } from "../queries";
import { LineEditorRow } from "./line-editor-row";

/** The supplier's price this line costs from: amount, VAT state, who, how old, and the evidence. Internal: it never appears on the customer's copy. */
function CostCell({ line, currencyCode, evidenceHref, now }: { line: QuotationLineDetail; currencyCode: string; evidenceHref: (observationId: string) => string; now: Date }) {
  const cost = line.costObservation;
  if (!cost) return <span className="text-muted-foreground">No cost on record</span>;
  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="num font-medium">{formatMoney(cost.amount.toString(), cost.currencyCode)}</span>
        <VatBadge state={cost.vatState} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
        <Link href={`/suppliers/${cost.supplier.id}`} className="truncate hover:underline">
          {cost.supplier.name}
        </Link>
        <span title={formatDateTime(cost.observedAt)}>{formatRelativeAge(cost.observedAt, now)}</span>
        <EvidenceLink href={evidenceHref(cost.id)} label="Open the evidence for this cost" />
      </div>
      {cost.currencyCode !== currencyCode ? <p className="text-warning">In {cost.currencyCode}, not {currencyCode}: enter the price yourself.</p> : null}
    </div>
  );
}

const HEAD = "h-auto py-2";
/** Internal columns (cost, markup, margin) are shaded, so nothing else has to say they are internal. */
const INTERNAL = "bg-surface/80";

/** "1150" -> "1150.00": prices and markups always show two decimals. */
const twoDecimals = (value: { toString(): string } | null): string | null => (value === null ? null : Number(value.toString()).toFixed(2));

/**
 * The lines of a quotation, INTERNAL view: cost, markup and margin sit beside the customer's columns. A draft is editable line by line; an
 * issued or superseded quotation is read-only. The customer's copy is the print page, which reads none of the internal columns.
 */
export function LinesTable({ quotation, evidenceHref, now }: { quotation: QuotationDetail; evidenceHref: (observationId: string) => string; now: Date }) {
  const editable = quotation.status === "DRAFT" && !quotation.enquiry?.archivedAt;
  const currency = quotation.currencyCode;

  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={`${HEAD} w-8`}>#</TableHead>
            <TableHead className={`${HEAD} w-[26%]`}>Description</TableHead>
            <TableHead className={`${HEAD} w-20 text-right`}>Qty</TableHead>
            <TableHead className={`${HEAD} w-[19%] ${INTERNAL}`}>Cost</TableHead>
            <TableHead className={`${HEAD} w-24 text-right ${INTERNAL}`}>Markup %</TableHead>
            <TableHead className={`${HEAD} w-28 text-right`}>Unit price</TableHead>
            <TableHead className={`${HEAD} w-28 text-right`}>Total</TableHead>
            <TableHead className={`${HEAD} w-28 text-right ${INTERNAL}`}>Margin</TableHead>
            {editable ? <TableHead className={`${HEAD} w-36`}>Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotation.lines.map((line) => {
            const cost = line.costObservation;
            const costAmount = cost ? cost.amount.toString() : null;
            const costComparable = cost?.currencyCode === currency;
            const costCell = <CostCell line={line} currencyCode={currency} evidenceHref={evidenceHref} now={now} />;
            if (editable) {
              // The key changes when the saved values change, so the row starts again from what the server holds (after Save or Refresh cost).
              const key = [line.id, line.description, line.partNumber, line.quantity, line.unitPrice?.toString(), line.markupPercent?.toString(), line.costPriceObservationId].join("|");
              return (
                <LineEditorRow
                  key={key}
                  line={{
                    id: line.id,
                    position: line.position,
                    description: line.description,
                    partNumber: line.partNumber,
                    quantity: line.quantity,
                    unitPrice: twoDecimals(line.unitPrice),
                    markupPercent: twoDecimals(line.markupPercent),
                  }}
                  currencyCode={currency}
                  costAmount={costAmount}
                  costComparable={costComparable}
                  costCell={costCell}
                  canRefresh={Boolean(line.enquiryItemId)}
                />
              );
            }
            const total = lineTotalCents(line.quantity, line.unitPrice);
            const margin = lineMarginCents({ quantity: line.quantity, unitPrice: line.unitPrice, costAmount, costComparable });
            return (
              <TableRow key={line.id} className="align-top">
                <TableCell className="h-auto py-2 text-xs text-muted-foreground num">{line.position}</TableCell>
                <TableCell className="h-auto py-2 whitespace-normal">
                  <span className="block">{line.description}</span>
                  {line.partNumber ? <span className="block font-mono text-[11px] text-muted-foreground">{line.partNumber}</span> : null}
                </TableCell>
                <TableCell className="num h-auto py-2 text-right">{line.quantity ?? "—"}</TableCell>
                <TableCell className={`h-auto py-2 text-xs ${INTERNAL}`}>{costCell}</TableCell>
                <TableCell className={`num h-auto py-2 text-right ${INTERNAL}`}>{line.markupPercent ? `${twoDecimals(line.markupPercent)}%` : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="num h-auto py-2 text-right">{line.unitPrice ? formatMoney(line.unitPrice.toString(), currency) : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="num h-auto py-2 text-right">{total === null ? <span className="text-muted-foreground">—</span> : formatMoney(centsToAmount(total), currency)}</TableCell>
                <TableCell className={`num h-auto py-2 text-right ${INTERNAL}`}>{margin === null ? <span className="text-muted-foreground">—</span> : formatMoney(centsToAmount(margin), currency)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableShell>
  );
}
