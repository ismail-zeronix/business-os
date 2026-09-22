import Link from "next/link";
import { KeyValue } from "@/components/application/key-value";
import { ConfidenceBadge, MatchBadge, ReviewStatusBadge } from "@/components/application/status-badges";
import type { SelectOption } from "@/components/forms/multi-select";
import { Badge } from "@/components/ui/badge";
import { formatQuantity } from "@/lib/format";
import { normalizeName } from "@/lib/normalize";
import { cn } from "@/lib/utils";
import type { MatchCandidate } from "@/modules/products/matching";
import type { ItemIntelligence } from "../intelligence";
import type { EnquiryDetail } from "../queries";
import { IntelligencePanel } from "./intelligence-panel";
import { EnquiryItemEditor } from "./item-editor";
import { ReopenControl } from "./item-controls";
import { EnquiryProductLinker } from "./product-linker";
import { Card } from "@/components/ui/card";

type Item = EnquiryDetail["items"][number];

const HINT_LABEL: Record<string, string> = { cpu: "CPU", ram: "RAM", storage: "Storage", os: "OS", ramStorage: "RAM/Storage" };

/**
 * One requirement. Collapsed it is a single line (description, quantity, match, status). Selected (`?item=`) it expands in place:
 * pending requirements get the product linker, the editor and the supplier intelligence; reviewed ones are read-only with a Reopen action.
 */
export function EnquiryItemRow({
  item,
  selected,
  href,
  candidates,
  brandOptions,
  categoryOptions,
  nextItemId,
  keepQuery,
  intelligence,
  evidenceHref,
}: {
  item: Item;
  selected: boolean;
  href: string;
  candidates: MatchCandidate[];
  brandOptions: SelectOption[];
  categoryOptions: SelectOption[];
  nextItemId: string | null;
  keepQuery: string;
  /** Loaded only for the selected requirement. */
  intelligence: ItemIntelligence | null;
  evidenceHref: (observationId: string) => string;
}) {
  const data = item.extractedData as { reasons?: string[]; hints?: Record<string, string> } | null;
  const reasons = (data?.reasons ?? []).filter(Boolean);
  const hints = Object.entries(data?.hints ?? {}).filter(([, value]) => Boolean(value));
  const wording = item.description ?? [item.brandText, item.modelText].filter(Boolean).join(" ");
  const brandId = item.brandText ? (brandOptions.find((b) => normalizeName(b.label) === normalizeName(item.brandText ?? ""))?.value ?? null) : null;
  const quantity = formatQuantity(item.quantity);

  return (
    <li>
      <Card className={cn("gap-0 py-0 shadow-panel", selected && "ring-brand/40", item.reviewStatus === "IGNORED" && !selected && "opacity-70")}>
      <Link href={href} scroll={false} aria-current={selected ? "true" : undefined} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60">
        <span className="num text-xs text-muted-foreground">{item.position}</span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{item.description ?? "(no description)"}</div>
          <div className="truncate text-xs text-muted-foreground">
            {[item.brandText, item.familyText, item.modelText].filter(Boolean).join(" · ")}
            {item.partNumber ? <span className="font-mono"> · {item.partNumber}</span> : null}
            {item.specText ? ` · ${item.specText}` : null}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="num w-16 text-right">{quantity ?? <span className="text-muted-foreground">Qty unknown</span>}</span>
          <MatchBadge productId={item.productId} basis={item.matchBasis} />
          <ReviewStatusBadge status={item.reviewStatus} />
        </div>
      </Link>

      {selected ? (
        <div className="space-y-3 border-t p-3">
          {item.reviewStatus === "PENDING" ? (
            <>
              <EnquiryProductLinker
                itemId={item.id}
                current={item.product ? { id: item.product.id, name: item.product.name, partNumber: item.product.partNumber, brandName: item.product.brand?.name ?? null, basis: item.matchBasis } : null}
                candidates={candidates}
                aliasWording={wording}
                createDefaults={{ name: wording, brandId, family: item.familyText ?? "", model: item.modelText ?? "", partNumber: item.partNumber ?? "" }}
                brandOptions={brandOptions}
                categoryOptions={categoryOptions}
              />
              <EnquiryItemEditor
                itemId={item.id}
                nextItemId={nextItemId}
                keepQuery={keepQuery}
                initial={{
                  description: item.description,
                  brandText: item.brandText,
                  familyText: item.familyText,
                  modelText: item.modelText,
                  partNumber: item.partNumber,
                  specText: item.specText,
                  quantity: item.quantity,
                  notes: item.notes,
                }}
              />
              {hints.length ? (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Detected:</span>
                  {hints.map(([key, value]) => (
                    <Badge key={key} variant="outline">
                      {HINT_LABEL[key] ?? key}: {value}
                    </Badge>
                  ))}
                </div>
              ) : null}
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
                  { label: "Specification", value: item.specText },
                  { label: item.reviewStatus === "IGNORED" ? "Ignored because" : "Notes", value: item.reviewStatus === "IGNORED" ? item.ignoredReason : item.notes },
                ]}
              />
              <div className="flex justify-end border-t pt-2">
                <ReopenControl itemId={item.id} />
              </div>
            </div>
          )}

          {intelligence ? <IntelligencePanel intelligence={intelligence} linked={Boolean(item.productId)} brandName={item.product?.brand?.name ?? item.brandText} evidenceHref={evidenceHref} /> : null}
        </div>
      ) : null}
      </Card>
    </li>
  );
}
