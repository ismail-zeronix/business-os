"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, fieldValue, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addLineAction } from "../actions";

/** A line typed by hand: delivery, installation, a service. It has no supplier cost, so its price is typed. */
export function AddLineForm({ quotationId, currencyCode }: { quotationId: string; currencyCode: string }) {
  const close = useDrawerClose();
  const [state, formAction] = useActionState(addLineAction, null);
  useActionFeedback(state, () => close());
  const err = (name: string) => fieldError(state, name);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="quotationId" value={quotationId} />
      <FormMessage state={state} />
      <Field label="Description" htmlFor="al-description" error={err("description")} required>
        <Input id="al-description" name="description" defaultValue={fieldValue(state, "description")} aria-invalid={Boolean(err("description"))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity" htmlFor="al-quantity" error={err("quantity")} required>
          <Input id="al-quantity" name="quantity" inputMode="numeric" defaultValue={fieldValue(state, "quantity", "1")} aria-invalid={Boolean(err("quantity"))} />
        </Field>
        <Field label={`Unit price (${currencyCode}, excl. VAT)`} htmlFor="al-price" error={err("unitPrice")}>
          <Input id="al-price" name="unitPrice" inputMode="decimal" defaultValue={fieldValue(state, "unitPrice")} aria-invalid={Boolean(err("unitPrice"))} />
        </Field>
      </div>
      <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-popover px-4 py-3">
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Adding...">Add line</SubmitButton>
      </div>
    </form>
  );
}
