"use client";

import { Plus, Search } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { MatchBadge } from "@/components/application/status-badges";
import { FormDrawer } from "@/components/forms/form-drawer";
import type { SelectOption } from "@/components/forms/multi-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MatchBasis } from "@/generated/prisma/enums";
import type { MatchCandidate } from "@/modules/products/matching";
import type { ProductPickerRow } from "@/modules/products/queries";
import { linkItemAction, searchProductsForLinkAction } from "../actions";
import { ItemProductForm, type ProductDefaults } from "./item-product-form";

export type LinkedProduct = { id: string; name: string; partNumber: string | null; brandName: string | null; basis: MatchBasis | null };

const STRENGTH_LABEL: Record<MatchCandidate["strength"], { label: string; variant: "success" | "info" | "neutral" }> = {
  EXACT: { label: "Exact match", variant: "success" },
  PROBABLE: { label: "Probable", variant: "info" },
  POSSIBLE: { label: "Possible", variant: "neutral" },
};

type Row = { id: string; name: string; partNumber: string | null; brandName: string | null; badge?: MatchCandidate["strength"] };

/** Spec text is already " · "-token-joined by the parser (broadcasts/parsing/extractors.ts); split it back apart to compare. */
const splitSpec = (text: string): string[] =>
  text
    .split("·")
    .map((t) => t.trim())
    .filter(Boolean);

/**
 * Links a broadcast item to a product. Shows the current link, suggested candidates (never auto-picked when ambiguous), live search, and
 * a drawer to create a temporary product without leaving the review. Change/Unlink are always a person's decision; the item may already
 * arrive linked to a temporary product broadcasts/service.ts auto-created at parse time when it had no match candidates at all. Either
 * way the item stays pending until confirmed.
 */
export function ProductLinker({
  itemId,
  current,
  candidates,
  candidateSpecs,
  currentSpecText,
  aliasWording,
  createDefaults,
  brandOptions,
  categoryOptions,
}: {
  itemId: string;
  current: LinkedProduct | null;
  candidates: MatchCandidate[];
  /** Each candidate product's own spec text (productId -> specText), from its most recently confirmed item. */
  candidateSpecs: Record<string, string>;
  /** This item's own spec text, shown once as the reference the candidates are compared against. */
  currentSpecText: string | null;
  aliasWording: string;
  createDefaults: ProductDefaults;
  brandOptions: SelectOption[];
  categoryOptions: SelectOption[];
}) {
  const [changing, setChanging] = useState(false);
  const [remember, setRemember] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductPickerRow[]>([]);
  const [searching, startSearch] = useTransition();
  const [state, linkAction] = useActionState(linkItemAction, null);
  useActionFeedback(state, () => setChanging(false));

  useEffect(() => {
    const handle = setTimeout(() => startSearch(async () => setResults(await searchProductsForLinkAction(query))), 250);
    return () => clearTimeout(handle);
  }, [query]);

  const linkForm = (productId: string, label: string, variant: "default" | "outline" = "outline") => (
    <form action={linkAction}>
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="productId" value={productId} />
      {remember && productId && aliasWording ? <input type="hidden" name="rememberAlias" value="on" /> : null}
      <SubmitButton size="xs" variant={variant} pendingLabel="Linking...">
        {label}
      </SubmitButton>
    </form>
  );

  const showPicker = !current || changing;
  const rows: Row[] = [
    ...candidates.map((c) => ({ id: c.productId, name: c.name, partNumber: c.partNumber, brandName: c.brandName, badge: c.strength })),
    ...results.filter((r) => !candidates.some((c) => c.productId === r.id)),
  ].filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i && r.id !== current?.id);
  const currentTokens = new Set(currentSpecText ? splitSpec(currentSpecText) : []);
  const hasCandidateSpecs = rows.some((r) => candidateSpecs[r.id]);

  return (
    <div className="space-y-2 rounded-lg border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Product</span>
        {current ? <MatchBadge productId={current.id} basis={current.basis} /> : <Badge variant="warning">Unmatched</Badge>}
      </div>

      {current ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{current.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {current.brandName ?? "No brand"}
              {current.partNumber ? <span className="font-mono"> · {current.partNumber}</span> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="xs" variant="outline" type="button" onClick={() => setChanging((v) => !v)}>
              {changing ? "Keep" : "Change"}
            </Button>
            <form action={linkAction}>
              <input type="hidden" name="itemId" value={itemId} />
              <input type="hidden" name="productId" value="" />
              <SubmitButton size="xs" variant="ghost" pendingLabel="Unlinking...">
                Unlink
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No product linked yet. Link an existing product or create one. Nothing is guessed.</p>
      )}

      <FormMessage state={state} />

      {showPicker ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products by name, model, part number or alias" aria-label="Search products" className="h-7 pl-7 text-sm" />
          </div>

          {currentSpecText && hasCandidateSpecs ? (
            <p className="truncate text-xs text-muted-foreground">
              <span className="font-medium text-foreground">This item:</span> {currentSpecText}
            </p>
          ) : null}

          {rows.length ? (
            <ul className="divide-y rounded-lg border bg-background">
              {rows.map((row) => {
                const spec = candidateSpecs[row.id];
                return (
                  <li key={row.id} className="flex items-center justify-between gap-3 px-2.5 py-1.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{row.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {row.brandName ?? "No brand"}
                        {row.partNumber ? <span className="font-mono"> · {row.partNumber}</span> : null}
                      </div>
                      {spec ? (
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5">
                          {splitSpec(spec).map((token, i) =>
                            currentTokens.has(token) ? (
                              <span key={i} className="text-xs text-muted-foreground">
                                {token}
                                {i < splitSpec(spec).length - 1 ? " ·" : ""}
                              </span>
                            ) : (
                              <Badge key={i} variant="warning" className="h-4 px-1 text-[10px]">
                                {token}
                              </Badge>
                            ),
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {row.badge ? <Badge variant={STRENGTH_LABEL[row.badge].variant}>{STRENGTH_LABEL[row.badge].label}</Badge> : null}
                      {linkForm(row.id, "Link", row.badge === "EXACT" ? "default" : "outline")}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">{searching ? "Searching..." : query.trim().length >= 2 ? "No products match. You can create one." : "No suggestions. Search, or create a product."}</p>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Checkbox id={`remember-${itemId}`} checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
              <Label htmlFor={`remember-${itemId}`} className="text-xs font-normal text-muted-foreground">
                Remember <span className="font-medium text-foreground">&ldquo;{aliasWording || "this wording"}&rdquo;</span> as an alias
              </Label>
            </div>
            <FormDrawer
              trigger={
                <Button size="xs" variant="outline" type="button">
                  <Plus aria-hidden /> Create product
                </Button>
              }
              title="Create product"
              description="Created as a temporary product and linked to this item. You can curate it later."
            >
              <ItemProductForm itemId={itemId} defaults={createDefaults} brandOptions={brandOptions} categoryOptions={categoryOptions} rememberDefault={remember} />
            </FormDrawer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
