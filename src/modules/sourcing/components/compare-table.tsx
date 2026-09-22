import { SoftPill } from "@/components/application/soft-pill";
import { SupplierRequestStatusPill, StockBadge, VatBadge } from "@/components/application/status-badges";
import { TableShell } from "@/components/data-table/table-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatMoney, formatRelativeAge } from "@/lib/format";
import type { EnquiryDetail } from "@/modules/enquiries/queries";
import { EvidenceLink, PriceCell, StockCell } from "@/modules/observations/components/offers";
import type { SupplierIntelligenceRow } from "@/modules/observations/procurement-queries";
import type { DecisionRow, SupplierRequestRow } from "../queries";
import { ChooseButton, ClearChoiceButton } from "./choose-button";

type Line = EnquiryDetail["items"][number];

/**
 * Side by side: one row per confirmed requirement, one column per supplier asked. Every cell is that supplier's latest price and stock for
 * the requirement's product, exactly as stated (with VAT state, age and an evidence link). Nothing is ranked and no "best price" is shown:
 * currency and VAT state make prices non-comparable. The buyer chooses; the choice keeps the price and stock they saw.
 */
export function CompareTable({
  lines,
  requests,
  intelligence,
  decisions,
  evidenceHref,
  archived,
  now,
}: {
  lines: Line[];
  requests: SupplierRequestRow[];
  intelligence: Map<string, SupplierIntelligenceRow[]>;
  decisions: DecisionRow[];
  evidenceHref: (observationId: string) => string;
  archived: boolean;
  now: Date;
}) {
  const decisionByItem = new Map(decisions.map((d) => [d.enquiryItemId, d]));

  return (
    <section aria-label="Compare" className="space-y-2">
      <div>
        <h2 className="text-sm font-medium">Compare</h2>
        <p className="text-xs text-muted-foreground">Latest price and stock from each supplier, as they stated it. Nothing is ranked; you choose.</p>
      </div>
      <TableShell>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-auto w-[20%] min-w-44 py-2">Requirement</TableHead>
              {requests.map((request) => (
                <TableHead key={request.id} className="h-auto min-w-52 space-y-1 py-2">
                  <span className="block truncate font-medium text-foreground">{request.supplier.name}</span>
                  <SupplierRequestStatusPill status={request.status} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              const decision = decisionByItem.get(line.id) ?? null;
              const offers = line.productId ? (intelligence.get(line.productId) ?? []) : [];
              return (
                <TableRow key={line.id} className="align-top">
                  <TableCell className="h-auto py-2">
                    <span className="block font-medium">{line.description ?? line.modelText ?? line.partNumber ?? "Requirement"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {line.quantity != null ? `${line.quantity.toLocaleString("en-US")} pcs` : "Quantity unknown"}
                      {line.product ? ` · ${line.product.name}` : ""}
                    </span>
                    {!line.productId ? <span className="mt-1 block text-xs text-warning">Link a product to compare</span> : null}
                  </TableCell>
                  {requests.map((request) => {
                    const offer = offers.find((o) => o.supplierId === request.supplier.id) ?? null;
                    const chosen = decision?.supplierId === request.supplier.id ? decision : null;
                    const closed = request.status === "NO_STOCK" || request.status === "DECLINED";
                    const changed = chosen ? chosen.priceObservationId !== (offer?.price?.id ?? null) || chosen.stockObservationId !== (offer?.stock?.id ?? null) : false;
                    return (
                      <TableCell key={request.id} className={chosen ? "h-auto bg-success-bg/60 py-2" : "h-auto py-2"}>
                        {!line.productId ? (
                          <span className="text-muted-foreground">—</span>
                        ) : offer ? (
                          <div className="space-y-1.5">
                            <PriceCell price={offer.price} evidenceHref={evidenceHref} now={now} />
                            <StockCell stock={offer.stock} evidenceHref={evidenceHref} now={now} />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No price or stock on record</span>
                        )}

                        {chosen ? (
                          <div className="mt-2 space-y-1 border-t border-success-border pt-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <SoftPill tone="green" dot>
                                Chosen
                              </SoftPill>
                              {archived ? null : <ClearChoiceButton id={chosen.id} />}
                            </div>
                            {chosen.note ? <p>{chosen.note}</p> : null}
                            <p className="text-muted-foreground" title={formatDateTime(chosen.createdAt)}>
                              by {chosen.decidedBy.name} · {formatRelativeAge(chosen.createdAt, now)}
                            </p>
                            {changed ? (
                              <div className="rounded-md bg-background/70 p-1.5">
                                <p className="mb-1 font-medium">When chosen</p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {chosen.priceObservation ? (
                                    <>
                                      <span className="num">{formatMoney(chosen.priceObservation.amount.toString(), chosen.priceObservation.currencyCode)}</span>
                                      <VatBadge state={chosen.priceObservation.vatState} />
                                      <EvidenceLink href={evidenceHref(chosen.priceObservation.id)} label="Open the evidence for the price when chosen" />
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground">No price</span>
                                  )}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  {chosen.stockObservation ? (
                                    <>
                                      <StockBadge status={chosen.stockObservation.status} quantity={chosen.stockObservation.quantity} />
                                      <EvidenceLink href={evidenceHref(chosen.stockObservation.id)} label="Open the evidence for the stock when chosen" />
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground">No stock info</span>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : closed ? (
                          <p className="mt-2 text-xs text-muted-foreground">Marked {request.status === "NO_STOCK" ? "No stock" : "Declined"}: cannot be chosen.</p>
                        ) : archived ? null : (
                          <div className="mt-2">
                            <ChooseButton
                              enquiryItemId={line.id}
                              supplierId={request.supplier.id}
                              supplierName={request.supplier.name}
                              priceObservationId={offer?.price?.id ?? null}
                              stockObservationId={offer?.stock?.id ?? null}
                              replacing={Boolean(decision)}
                            />
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableShell>
    </section>
  );
}
