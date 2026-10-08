import Link from "next/link";
import { SoftPill } from "@/components/application/soft-pill";
import { StockBadge, VatBadge } from "@/components/application/status-badges";
import { TableShell } from "@/components/data-table/table-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SupplierRequestStatus } from "@/generated/prisma/enums";
import { formatDateTime, formatMoney, formatRelativeAge } from "@/lib/format";
import type { EnquiryDetail } from "@/modules/enquiries/queries";
import { EvidenceLink, PriceCell, StockCell } from "@/modules/observations/components/offers";
import type { SupplierIntelligenceRow } from "@/modules/observations/procurement-queries";
import type { DecisionRow } from "../queries";
import { ChooseButton, ClearChoiceButton } from "./choose-button";

type Line = EnquiryDetail["items"][number];

/** One supplier's offer (or decision-only presence) for a single requirement row's "Supplier offers" column. */
type SupplierBlock = { supplierId: string; supplierName: string; offer: SupplierIntelligenceRow | null };

/**
 * The Sourcing tab's requirement-by-requirement workspace: always exactly 3 columns — Requirement, Matched product,
 * Supplier offers — however many suppliers are involved, so it never needs horizontal scroll. Supplier offers are
 * scoped to the row's own linked product (not every supplier on the enquiry), and the set shown is the union of
 * everyone with a current price/stock offer for that product AND anyone with an existing decision for this exact
 * requirement — so a previously chosen supplier is never dropped from view just because their offer later aged out
 * of the intelligence snapshot. Nothing is ranked and no "best price" is shown: currency and VAT state make prices
 * non-comparable. The buyer chooses directly; a supplier who was never explicitly asked gets a request row started
 * silently by the choice itself.
 */
export function SourcingMatchTable({
  lines,
  intelligence,
  decisions,
  requestStatusBySupplier,
  evidenceHref,
  archived,
  now,
}: {
  lines: Line[];
  intelligence: Map<string, SupplierIntelligenceRow[]>;
  decisions: DecisionRow[];
  /** Status of the enquiry-level request to each supplier, when one exists. Used only to gate the "Marked No stock/Declined" state — the
   * "Not asked yet" pill itself is intentionally not reproduced here: the Asked suppliers table below already shows the full ask/reply lifecycle. */
  requestStatusBySupplier: Map<string, SupplierRequestStatus>;
  evidenceHref: (observationId: string) => string;
  archived: boolean;
  now: Date;
}) {
  const decisionByItem = new Map(decisions.map((d) => [d.enquiryItemId, d]));

  return (
    <section aria-label="Matching suppliers" className="space-y-2">
      <div>
        <h2 className="text-sm font-medium">Matching suppliers</h2>
        <p className="text-xs text-muted-foreground">Suppliers with a known price or stock for each requirement&rsquo;s product, or already chosen. Choose directly — sending a message is not required for a known price.</p>
      </div>
      <TableShell>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-auto w-[26%] min-w-44 py-2">Requirement</TableHead>
              <TableHead className="h-auto w-[22%] min-w-40 py-2">Matched product</TableHead>
              <TableHead className="h-auto py-2">Supplier offers</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              const decision = decisionByItem.get(line.id) ?? null;
              const offers = line.productId ? (intelligence.get(line.productId) ?? []) : [];

              const blocks: SupplierBlock[] = offers.map((o) => ({ supplierId: o.supplierId, supplierName: o.supplierName, offer: o }));
              if (decision && !blocks.some((b) => b.supplierId === decision.supplierId)) {
                blocks.push({ supplierId: decision.supplierId, supplierName: decision.supplier.name, offer: null });
              }

              return (
                <TableRow key={line.id} className="align-top">
                  <TableCell className="h-auto py-2">
                    <span className="block font-medium">{line.description ?? line.modelText ?? line.partNumber ?? "Requirement"}</span>
                    <span className="block text-xs text-muted-foreground">{line.quantity != null ? `${line.quantity.toLocaleString("en-US")} pcs` : "Quantity unknown"}</span>
                    {!line.productId ? <span className="mt-1 block text-xs text-warning">Link a product to compare</span> : null}
                  </TableCell>

                  <TableCell className="h-auto py-2">
                    {line.product ? (
                      <>
                        <Link href={`/products/${line.productId}`} className="block truncate font-medium hover:underline">
                          {line.product.name}
                        </Link>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[line.product.brand?.name, line.product.partNumber].filter(Boolean).join(" · ") || null}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-warning">Link a product to compare</span>
                    )}
                  </TableCell>

                  <TableCell className="h-auto py-2">
                    {!line.productId ? (
                      <span className="text-muted-foreground">—</span>
                    ) : blocks.length === 0 ? (
                      <span className="text-muted-foreground">No price or stock on record</span>
                    ) : (
                      <ul className="space-y-2.5">
                        {blocks.map((block) => {
                          const chosen = decision?.supplierId === block.supplierId ? decision : null;
                          const status = requestStatusBySupplier.get(block.supplierId) ?? null;
                          const closed = status === "NO_STOCK" || status === "DECLINED";
                          const changed = chosen ? chosen.priceObservationId !== (block.offer?.price?.id ?? null) || chosen.stockObservationId !== (block.offer?.stock?.id ?? null) : false;
                          return (
                            <li key={block.supplierId} className={chosen ? "rounded-md bg-success-bg/60 p-2" : "border-b border-border/60 pb-2 last:border-b-0 last:pb-0"}>
                              <span className="block truncate text-xs font-medium text-foreground">{block.supplierName}</span>
                              {block.offer ? (
                                <div className="mt-1 space-y-1.5">
                                  <PriceCell price={block.offer.price} evidenceHref={evidenceHref} now={now} />
                                  <StockCell stock={block.offer.stock} evidenceHref={evidenceHref} now={now} />
                                </div>
                              ) : (
                                <span className="mt-1 block text-muted-foreground">No price or stock on record</span>
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
                                <p className="mt-2 text-xs text-muted-foreground">Marked {status === "NO_STOCK" ? "No stock" : "Declined"}: cannot be chosen.</p>
                              ) : archived ? null : (
                                <div className="mt-2">
                                  <ChooseButton
                                    enquiryItemId={line.id}
                                    supplierId={block.supplierId}
                                    supplierName={block.supplierName}
                                    priceObservationId={block.offer?.price?.id ?? null}
                                    stockObservationId={block.offer?.stock?.id ?? null}
                                    replacing={Boolean(decision)}
                                  />
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableShell>
    </section>
  );
}
