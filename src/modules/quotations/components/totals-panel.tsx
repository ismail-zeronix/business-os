import type { ReactNode } from "react";
import { Panel } from "@/components/application/page-canvas";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { computeTotals, summariseMargin } from "../pricing";
import type { QuotationDetail } from "../queries";

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className={`flex items-baseline justify-between gap-6 ${strong ? "border-t pt-1.5 text-sm font-semibold" : "text-sm"}`}>
    <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
    <dd className="num">{value}</dd>
  </div>
);

const Caption = ({ children }: { children: string }) => <h3 className="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{children}</h3>;

/**
 * One card, two halves: what the customer will pay (subtotal, VAT, total) and, on a shaded half marked internal, what it earns.
 * In "customer" view the margin half is dropped entirely — this is the same-page preview of what the customer sees, so internal
 * figures never render, not even hidden in markup. For a draft, an optional footer carries the page's primary/secondary actions
 * (Issue, Edit details, Preview) so they live next to the numbers they affect instead of in page-level chrome.
 */
export function TotalsPanel({
  quotation,
  view = "internal",
  draftActions,
}: {
  quotation: QuotationDetail;
  view?: "customer" | "internal";
  draftActions?: { primary?: ReactNode; secondary?: ReactNode };
}) {
  const currency = quotation.currencyCode;
  const totals = computeTotals(quotation.lines, quotation.vatPercent);
  const vat = Number(quotation.vatPercent.toString());
  const showMargin = view === "internal";
  const margin = showMargin
    ? summariseMargin(
        quotation.lines.map((line) => ({
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          costAmount: line.costObservation?.amount ?? null,
          costComparable: line.costObservation?.currencyCode === currency,
        })),
      )
    : null;

  return (
    <Panel>
      <div className={cn("grid grid-cols-1", showMargin && "md:grid-cols-2")}>
        <section aria-label="Customer totals" className="p-4">
          <Caption>Customer totals</Caption>
          <dl className="space-y-1.5">
            <Row label="Subtotal (excl. VAT)" value={formatMoney(totals.subtotal, currency)} />
            <Row label={`VAT ${vat}%`} value={formatMoney(totals.vat, currency)} />
            <Row label="Total" value={formatMoney(totals.total, currency)} strong />
          </dl>
          {totals.incompleteLines > 0 ? (
            <p className="mt-2 text-xs text-warning">
              {totals.incompleteLines} line{totals.incompleteLines === 1 ? "" : "s"} not counted (no quantity or price).
            </p>
          ) : null}
        </section>

        {showMargin && margin ? (
          <section aria-label="Margin, internal" className="border-t bg-surface p-4 md:border-t-0 md:border-l">
            <Caption>Margin · internal, never printed</Caption>
            {margin.coveredLines === 0 ? (
              <p className="text-sm text-muted-foreground">Unknown until a line has a quantity, a price and a cost.</p>
            ) : (
              <>
                <dl className="space-y-1.5">
                  <Row label="Revenue (excl. VAT)" value={formatMoney(margin.revenue, currency)} />
                  <Row label="Cost" value={formatMoney(margin.cost, currency)} />
                  <Row label={margin.marginPercent ? `Margin (${margin.marginPercent}%)` : "Margin"} value={formatMoney(margin.margin, currency)} strong />
                </dl>
                <p className="mt-2 text-xs text-muted-foreground" title={`Lines without a cost in ${currency}, or without a price, are left out.`}>
                  Based on {margin.coveredLines} of {margin.totalLines} line{margin.totalLines === 1 ? "" : "s"}.
                </p>
              </>
            )}
          </section>
        ) : null}
      </div>

      {draftActions ? (
        <div className="flex items-center justify-between gap-2 border-t p-3">
          <div className="flex items-center gap-2">{draftActions.secondary}</div>
          <div className="flex items-center gap-2">{draftActions.primary}</div>
        </div>
      ) : null}
    </Panel>
  );
}
