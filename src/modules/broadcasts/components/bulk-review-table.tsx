"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Input } from "@/components/ui/input";
import { SUPPORTED_CURRENCIES } from "@/core/validation/fields";
import { STOCK_STATUS_LABEL, VAT_STATE_LABEL, WARRANTY_TYPE_LABEL } from "@/lib/labels";
import { bulkApplyItemsAction } from "../actions";

type Row = {
  id: string;
  description: string | null;
  categoryText: string | null;
  brandText: string | null;
  modelText: string | null;
  partNumber: string | null;
  specText: string | null;
  quantity: number | null;
  priceAmount: string | null; // Decimal already stringified by the caller
  currencyCode: string | null;
  vatState: string;
  stockStatus: string;
  warrantyMonths: number | null;
  warrantyType: string | null;
  notes: string | null;
};

const text = (value: string | number | null) => (value === null ? "" : String(value));

/**
 * One dense row per PENDING item, every cell a plain input/select. "Apply all" submits every column as a repeated field
 * (same value order as the rows), which the action zips back into one row per item and saves in one transaction — it only
 * corrects field values, exactly like today's per-item "Save". It never confirms or links a product; that still happens in
 * the existing per-item Review tab afterward.
 */
export function BulkReviewTable({ broadcastId, rows }: { broadcastId: string; rows: Row[] }) {
  const [state, formAction] = useActionState(bulkApplyItemsAction, null);
  useActionFeedback(state, (data) => {
    if (data.updated === 0) return;
  });

  if (rows.length === 0) return null;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="broadcastId" value={broadcastId} />
      <FormMessage state={state} />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              {["#", "Description", "Category", "Brand", "Model", "Part #", "Spec", "Qty", "Price", "Ccy", "VAT", "Stock", "Warr. (mo)", "Warr. type", "Notes"].map((h) => (
                <th key={h} className="whitespace-nowrap px-2 py-1.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} className="border-t">
                <td className="px-2 py-1 num text-muted-foreground">{i + 1}</td>
                <td className="px-2 py-1">
                  <input type="hidden" name="id" value={row.id} />
                  <Input name="description" defaultValue={text(row.description)} className="h-7 min-w-40 text-xs" />
                </td>
                <td className="px-2 py-1">
                  <Input name="categoryText" defaultValue={text(row.categoryText)} className="h-7 w-24 text-xs" />
                </td>
                <td className="px-2 py-1">
                  <Input name="brandText" defaultValue={text(row.brandText)} className="h-7 w-20 text-xs" />
                </td>
                <td className="px-2 py-1">
                  <Input name="modelText" defaultValue={text(row.modelText)} className="h-7 w-24 text-xs" />
                </td>
                <td className="px-2 py-1">
                  <Input name="partNumber" defaultValue={text(row.partNumber)} className="h-7 w-24 font-mono text-xs" />
                </td>
                <td className="px-2 py-1">
                  <Input name="specText" defaultValue={text(row.specText)} className="h-7 min-w-32 text-xs" />
                </td>
                <td className="px-2 py-1">
                  <Input name="quantity" inputMode="numeric" defaultValue={text(row.quantity)} className="num h-7 w-14 text-xs" />
                </td>
                <td className="px-2 py-1">
                  <Input name="priceAmount" inputMode="decimal" defaultValue={text(row.priceAmount)} className="num h-7 w-20 text-xs" />
                </td>
                <td className="px-2 py-1">
                  <select name="currencyCode" defaultValue={row.currencyCode ?? ""} className="h-7 rounded-md border bg-background px-1 text-xs">
                    <option value="">—</option>
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <select name="vatState" defaultValue={row.vatState} className="h-7 rounded-md border bg-background px-1 text-xs">
                    {Object.entries(VAT_STATE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <select name="stockStatus" defaultValue={row.stockStatus} className="h-7 rounded-md border bg-background px-1 text-xs">
                    {Object.entries(STOCK_STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <Input name="warrantyMonths" inputMode="numeric" defaultValue={text(row.warrantyMonths)} className="num h-7 w-14 text-xs" />
                </td>
                <td className="px-2 py-1">
                  <select name="warrantyType" defaultValue={row.warrantyType ?? ""} className="h-7 rounded-md border bg-background px-1 text-xs">
                    <option value="">—</option>
                    {Object.entries(WARRANTY_TYPE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <Input name="notes" defaultValue={text(row.notes)} className="h-7 min-w-24 text-xs" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Fix obvious parser mistakes here, then continue below to link products and confirm each item.</p>
        <SubmitButton size="sm" pendingLabel="Applying...">
          Apply all
        </SubmitButton>
      </div>
    </form>
  );
}
