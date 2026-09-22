import Link from "next/link";
import { KeyValue } from "@/components/application/key-value";
import { ConfidenceBadge, MatchBadge, ReviewStatusBadge, StockBadge, VatBadge } from "@/components/application/status-badges";
import type { SelectOption } from "@/components/forms/multi-select";
import { formatMoney, formatQuantity } from "@/lib/format";
import { normalizeName } from "@/lib/normalize";
import { cn } from "@/lib/utils";
import type { MatchCandidate } from "@/modules/products/matching";
import type { BroadcastDetail } from "../queries";
import { ItemEditor } from "./item-editor";
import { ReopenControl } from "./item-controls";
import { ProductLinker } from "./product-linker";
import { Card } from "@/components/ui/card";

type Item = BroadcastDetail["items"][number];

/**
 * One extracted item. Collapsed it is a single line (status, description, quantity, price, stock, match). Selected (`?item=`) it expands
 * in place: pending items get the editor and product linker; reviewed items are read-only with a Reopen action. No modals.
 */
export function ItemRow({
  item,
  selected,
  href,
  candidates,
  candidateSpecs,
  brandOptions,
  categoryOptions,
  nextItemId,
  keepQuery,
}: {
  item: Item;
  selected: boolean;
  href: string;
  candidates: MatchCandidate[];
  /** Each candidate product's own spec text (productId -> specText), so the picker can show why same-named candidates differ. */
  candidateSpecs: Record<string, string>;
  brandOptions: SelectOption[];
  categoryOptions: SelectOption[];
  nextItemId: string | null;
  keepQuery: string;
}) {
  const reasons = ((item.extractedData as { reasons?: string[] } | null)?.reasons ?? []).filter(Boolean);
  const wording = item.description ?? [item.brandText, item.modelText].filter(Boolean).join(" ");
  const brandId = item.brandText ? (brandOptions.find((b) => normalizeName(b.label) === normalizeName(item.brandText ?? ""))?.value ?? null) : null;
  const price = item.priceAmount && item.currencyCode ? formatMoney(item.priceAmount, item.currencyCode) : item.priceAmount ? `${item.priceAmount.toString()} (no currency)` : null;
  const quantity = formatQuantity(item.quantity);

  return (
    <li>
      <Card className={cn("gap-0 py-0 shadow-panel", selected && "ring-brand/40", item.reviewStatus === "IGNORED" && !selected && "opacity-70")}>
      <Link href={href} scroll={false} aria-current={selected ? "true" : undefined} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60">
        <span className="num text-xs text-muted-foreground">{item.position}</span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{item.description ?? "(no description)"}</div>
          <div className="truncate text-xs text-muted-foreground">
            {[item.brandText, item.modelText].filter(Boolean).join(" · ")}
            {item.partNumber ? <span className="font-mono"> · {item.partNumber}</span> : null}
            {item.specText ? ` · ${item.specText}` : null}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="num w-14 text-right">{quantity ?? <span className="text-muted-foreground">—</span>}</span>
          <span className="num w-28 text-right">{price ?? <span className="text-muted-foreground">No price</span>}</span>
          <StockBadge status={item.stockStatus} />
          <MatchBadge productId={item.productId} basis={item.matchBasis} />
          <ReviewStatusBadge status={item.reviewStatus} />
        </div>
      </Link>

      {selected ? (
        <div className="space-y-3 border-t p-3">
          {item.reviewStatus === "PENDING" ? (
            <>
              <ProductLinker
                itemId={item.id}
                current={item.product ? { id: item.product.id, name: item.product.name, partNumber: item.product.partNumber, brandName: item.product.brand?.name ?? null, basis: item.matchBasis } : null}
                candidates={candidates}
                candidateSpecs={candidateSpecs}
                currentSpecText={item.specText}
                aliasWording={wording}
                createDefaults={{ name: wording, brandId, family: "", model: item.modelText ?? "", partNumber: item.partNumber ?? "" }}
                brandOptions={brandOptions}
                categoryOptions={categoryOptions}
              />
              <ItemEditor
                itemId={item.id}
                nextItemId={nextItemId}
                keepQuery={keepQuery}
                productId={item.productId}
                initial={{
                  description: item.description,
                  brandText: item.brandText,
                  modelText: item.modelText,
                  partNumber: item.partNumber,
                  specText: item.specText,
                  quantity: item.quantity,
                  priceAmount: item.priceAmount?.toString() ?? null,
                  currencyCode: item.currencyCode,
                  vatState: item.vatState,
                  stockStatus: item.stockStatus,
                  notes: item.notes,
                }}
              />
              {reasons.length || item.extractionConfidence ? (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none">
                    How this was read <ConfidenceBadge confidence={item.extractionConfidence} />
                  </summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <KeyValue
                columns={3}
                items={[
                  { label: "Product", value: item.product?.name },
                  { label: "Quantity", value: quantity },
                  { label: "Price", value: price },
                  { label: "VAT", value: item.priceAmount ? <VatBadge state={item.vatState} /> : null },
                  { label: "Stock status", value: <StockBadge status={item.stockStatus} /> },
                  { label: item.reviewStatus === "IGNORED" ? "Ignored because" : "Notes", value: item.reviewStatus === "IGNORED" ? item.ignoredReason : item.notes },
                ]}
              />
              <div className="flex justify-end border-t pt-2">
                <ReopenControl itemId={item.id} confirmed={item.reviewStatus === "CONFIRMED"} />
              </div>
            </div>
          )}
        </div>
      ) : null}
      </Card>
    </li>
  );
}
