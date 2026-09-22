"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { useRequestAction } from "@/modules/sourcing/components/use-request-action";
import { refreshLineCostAction, removeLineAction, updateLineAction } from "../actions";
import { centsToAmount, lineMarginCents, lineTotalCents, markupFromPrice, priceFromMarkup, type PricingBasis } from "../pricing";

export type LineEditorLine = {
  id: string;
  position: number;
  description: string;
  partNumber: string | null;
  quantity: number | null;
  /** "2530.00" */
  unitPrice: string | null;
  /** "10.00" */
  markupPercent: string | null;
};

const clean = (value: string) => value.replace(/[,%\s]/g, "");
const isNumber = (value: string) => /^-?\d+(?:\.\d{1,2})?$/.test(value);

const errorText = (state: { ok: boolean; message?: string; fieldErrors?: Record<string, string> } | null): string | null =>
  state && !state.ok ? (Object.values(state.fieldErrors ?? {})[0] ?? state.message ?? null) : null;

/**
 * One editable line of a draft. Markup and price follow each other: change one and the other is worked out from the cost, live, using the
 * same maths as the server. Only the server decides what is saved (it recomputes from `basis`, the field that was last changed).
 * The cost cell is drawn by the server page (it holds the supplier, VAT state, age and evidence link) and passed in.
 */
export function LineEditorRow({
  line,
  currencyCode,
  costAmount,
  costComparable,
  costCell,
  canRefresh,
}: {
  line: LineEditorLine;
  currencyCode: string;
  costAmount: string | null;
  /** The cost is known and in the quotation's currency, so markup can be used. */
  costComparable: boolean;
  costCell: ReactNode;
  canRefresh: boolean;
}) {
  const formId = useId();
  const [quantity, setQuantity] = useState(line.quantity?.toString() ?? "");
  const [markup, setMarkup] = useState(line.markupPercent ?? "");
  const [price, setPrice] = useState(line.unitPrice ?? "");
  const [basis, setBasis] = useState<PricingBasis>("PRICE");
  const [saveState, saveAction] = useRequestAction(updateLineAction);
  const [refreshState, refreshAction] = useRequestAction(refreshLineCostAction);
  const [removeState, removeAction] = useRequestAction(removeLineAction);

  const usableCost = costComparable && costAmount !== null ? costAmount : null;

  function changeMarkup(value: string) {
    setMarkup(value);
    setBasis("MARKUP");
    const text = clean(value);
    if (text === "") return setPrice("");
    const next = usableCost !== null && isNumber(text) ? priceFromMarkup(usableCost, text) : null;
    if (next !== null) setPrice(next);
  }

  function changePrice(value: string) {
    setPrice(value);
    setBasis("PRICE");
    const text = clean(value);
    if (text === "") return setMarkup("");
    if (usableCost === null) return setMarkup("");
    const next = isNumber(text) ? markupFromPrice(usableCost, text) : null;
    if (next !== null) setMarkup(next);
  }

  const qty = /^\d+$/.test(quantity.trim()) ? Number(quantity) : null;
  const priceText = isNumber(clean(price)) ? clean(price) : null;
  const totalCents = lineTotalCents(qty, priceText);
  const marginCents = lineMarginCents({ quantity: qty, unitPrice: priceText, costAmount, costComparable });

  const message = errorText(saveState) ?? errorText(refreshState) ?? errorText(removeState);

  return (
    <TableRow className="align-top">
      <TableCell className="h-auto py-2 text-xs text-muted-foreground num">{line.position}</TableCell>
      <TableCell className="h-auto py-2">
        <Input form={formId} name="description" defaultValue={line.description} aria-label={`Line ${line.position} description`} className="h-7 text-xs" />
        <Input form={formId} name="partNumber" defaultValue={line.partNumber ?? ""} placeholder="Part number" aria-label={`Line ${line.position} part number`} className="mt-1 h-6 font-mono text-[11px]" />
      </TableCell>
      <TableCell className="h-auto py-2">
        <Input form={formId} name="quantity" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-label={`Line ${line.position} quantity`} className="num h-7 text-right text-xs" />
      </TableCell>
      <TableCell className="h-auto bg-surface/80 py-2 text-xs">{costCell}</TableCell>
      <TableCell className="h-auto bg-surface/80 py-2">
        <Input
          form={formId}
          name="markupPercent"
          inputMode="decimal"
          value={markup}
          onChange={(e) => changeMarkup(e.target.value)}
          disabled={usableCost === null}
          placeholder={usableCost === null ? "no cost" : "%"}
          title={usableCost === null ? "Markup needs a known cost in the quotation's currency. Enter the price instead." : undefined}
          aria-label={`Line ${line.position} markup percent`}
          className="num h-7 text-right text-xs"
        />
      </TableCell>
      <TableCell className="h-auto py-2">
        <Input form={formId} name="unitPrice" inputMode="decimal" value={price} onChange={(e) => changePrice(e.target.value)} placeholder="0.00" aria-label={`Line ${line.position} unit price`} className="num h-7 text-right text-xs" />
      </TableCell>
      <TableCell className="num h-auto py-2 text-right text-xs">
        {totalCents === null ? <span className="text-muted-foreground">—</span> : formatMoney(centsToAmount(totalCents), currencyCode)}
      </TableCell>
      <TableCell className="num h-auto bg-surface/80 py-2 text-right text-xs">
        {marginCents === null ? <span className="text-muted-foreground">—</span> : formatMoney(centsToAmount(marginCents), currencyCode)}
      </TableCell>
      <TableCell className="h-auto py-2">
        <div className="flex flex-wrap items-center gap-1">
          <form id={formId} action={saveAction}>
            <input type="hidden" name="id" value={line.id} />
            <input type="hidden" name="basis" value={basis} />
            <SubmitButton size="xs" variant="outline" pendingLabel="Saving...">
              Save
            </SubmitButton>
          </form>
          {canRefresh ? (
            <form action={refreshAction}>
              <input type="hidden" name="id" value={line.id} />
              <SubmitButton size="xs" variant="ghost" pendingLabel="..." title="Take the cost again from the chosen supplier" aria-label={`Refresh cost of line ${line.position}`}>
                <RefreshCw aria-hidden />
              </SubmitButton>
            </form>
          ) : null}
          <form action={removeAction}>
            <input type="hidden" name="id" value={line.id} />
            <SubmitButton size="xs" variant="ghost" pendingLabel="..." title="Remove this line" aria-label={`Remove line ${line.position}`}>
              <Trash2 aria-hidden />
            </SubmitButton>
          </form>
        </div>
        {message ? (
          <p role="alert" className="mt-1 text-xs text-danger">
            {message}
          </p>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
