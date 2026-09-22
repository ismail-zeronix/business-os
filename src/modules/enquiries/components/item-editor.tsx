"use client";

import { Check } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useActionState, useRef } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { saveEnquiryItemAction } from "../actions";
import { IgnoreControl } from "./item-controls";
import { EnquiryItemFieldsGrid, type EnquiryItemFieldValues } from "./item-fields";

/**
 * Inline editor for a PENDING requirement. "Confirm" (or Ctrl+Enter) saves the edits and confirms in one transaction; "Save" only stores
 * the edits. After confirming, review moves on to the next pending requirement. Confirming records no prices: it means a person checked it.
 */
export function EnquiryItemEditor({
  itemId,
  initial,
  nextItemId,
  keepQuery,
}: {
  itemId: string;
  initial: EnquiryItemFieldValues;
  nextItemId: string | null;
  keepQuery: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [state, formAction] = useActionState(saveEnquiryItemAction, null);

  useActionFeedback(state, () => {
    // Only a confirmation moves on; a plain save stays on the same requirement. The intent is reflected in the toast message.
    if (state?.ok && state.message === "Requirement confirmed" && nextItemId) router.replace(`${pathname}?${keepQuery}${keepQuery ? "&" : ""}item=${nextItemId}`);
  });

  return (
    <div className="space-y-3">
      <form
        action={formAction}
        noValidate
        className="space-y-3"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            event.currentTarget.requestSubmit(confirmRef.current);
          }
        }}
      >
        <input type="hidden" name="id" value={itemId} />
        <FormMessage state={state} />
        <EnquiryItemFieldsGrid idPrefix={`item-${itemId}`} initial={initial} state={state} />
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs text-muted-foreground">Ctrl+Enter confirms. Confirming means you checked this requirement against the request.</p>
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
