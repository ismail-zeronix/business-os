"use client";

import { Check } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { saveItemAction } from "../actions";
import { ItemFieldsGrid, type ItemFieldValues } from "./item-fields";
import { IgnoreControl } from "./item-controls";

/**
 * Inline editor for a PENDING item. "Confirm" (or Ctrl+Enter) saves the edits and creates the observations in one transaction;
 * "Save" only stores the edits. After confirming, review moves on to the next pending item.
 */
export function ItemEditor({
  itemId,
  initial,
  nextItemId,
  keepQuery,
  productId,
}: {
  itemId: string;
  initial: ItemFieldValues;
  nextItemId: string | null;
  keepQuery: string;
  /** The currently linked product. A message produced before it changed (e.g. "link a product first") is stale and is hidden. */
  productId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [state, formAction] = useActionState(saveItemAction, null);
  const [submittedWithProduct, setSubmittedWithProduct] = useState<string | null>(null);
  const messageIsCurrent = submittedWithProduct === (productId ?? "none");
  // Reflects the item's last-saved state, same as the rest of this uncontrolled form (it doesn't react live to field edits).
  const noStock = initial.quantity === null && initial.stockStatus === "UNKNOWN";
  const willDefaultToAvailable = initial.priceAmount === null && noStock;
  const willDefaultCurrency = initial.priceAmount !== null && !initial.currencyCode;

  useActionFeedback(state, () => {
    // Only a confirmation moves on; a plain save stays on the same item. The intent is reflected in the toast message.
    if (state?.ok && state.message === "Item confirmed" && nextItemId) router.replace(`${pathname}?${keepQuery}${keepQuery ? "&" : ""}item=${nextItemId}`);
  });

  return (
    <div className="space-y-3">
      <form
        action={formAction}
        noValidate
        className="space-y-3"
        onSubmit={() => setSubmittedWithProduct(productId ?? "none")}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            event.currentTarget.requestSubmit(confirmRef.current);
          }
        }}
      >
        <input type="hidden" name="id" value={itemId} />
        <FormMessage state={messageIsCurrent ? state : null} />
        <ItemFieldsGrid idPrefix={`item-${itemId}`} initial={initial} state={state} />
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs text-muted-foreground">
            {willDefaultToAvailable
              ? "No price or stock given — confirming will record this as Available (listed, count unknown)."
              : willDefaultCurrency
                ? "No currency given — confirming will record the price in AED."
                : "Ctrl+Enter confirms. Confirming records the price and stock as evidence-backed observations."}
          </p>
          <div className="flex items-center gap-2">
            <SubmitButton ref={confirmRef} name="intent" value="confirm" size="sm" pendingLabel="Confirming...">
              <Check aria-hidden /> Confirm
            </SubmitButton>
            <SubmitButton name="intent" value="save" size="sm" variant="outline" pendingLabel="Saving...">
              Save
            </SubmitButton>
          </div>
        </div>
      </form>
      <div className="flex justify-end border-t pt-2">
        <IgnoreControl itemId={itemId} />
      </div>
    </div>
  );
}
