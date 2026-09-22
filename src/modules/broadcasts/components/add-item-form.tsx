"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, fieldValue, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addManualItemAction } from "../actions";
import { EMPTY_ITEM, ItemFieldsGrid } from "./item-fields";

/** Adds an item by hand, for a line the parser missed or misread. It joins the review as a pending item. */
export function AddItemForm({ broadcastId }: { broadcastId: string }) {
  const close = useDrawerClose();
  const [state, formAction] = useActionState(addManualItemAction, null);
  useActionFeedback(state, () => close());

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="broadcastId" value={broadcastId} />
      <FormMessage state={state} />
      <Field label="Source text (optional)" htmlFor="add-sourceText" error={fieldError(state, "sourceText")} hint="Paste the line(s) from the raw message this item comes from.">
        <Textarea id="add-sourceText" name="sourceText" rows={2} defaultValue={fieldValue(state, "sourceText")} className="font-mono text-xs" />
      </Field>
      <ItemFieldsGrid idPrefix="add-item" initial={EMPTY_ITEM} state={state} />
      <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-popover px-4 py-3">
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Adding...">Add item</SubmitButton>
      </div>
    </form>
  );
}
