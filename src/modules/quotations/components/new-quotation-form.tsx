"use client";

import { useActionState, useState } from "react";
import { Combobox } from "@/components/forms/combobox";
import { Field } from "@/components/forms/field";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { FormMessage } from "@/components/forms/form-message";
import type { SelectOption } from "@/components/forms/multi-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, fieldValue } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createManualQuotationAction } from "../actions";

/** Starts a quotation without an enquiry. Then add lines: from a supplier who just confirmed a price, or typed. */
export function NewQuotationForm({ customers }: { customers: SelectOption[] }) {
  const close = useDrawerClose();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [state, formAction] = useActionState(createManualQuotationAction, null);
  const err = (name: string) => fieldError(state, name);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Customer" htmlFor="nq-customer" error={err("customerId")} hint="A saved customer, or leave empty and type a name below.">
        <Combobox id="nq-customer" name="customerId" options={customers} placeholder="Select a customer" onValueChange={setCustomerId} clearable />
      </Field>
      {customerId ? null : (
        <Field label="Customer name" htmlFor="nq-name" error={err("customerName")} hint="For someone who is not saved as a customer.">
          <Input id="nq-name" name="customerName" defaultValue={fieldValue(state, "customerName")} aria-invalid={Boolean(err("customerName"))} />
        </Field>
      )}
      <Field label="Attention (optional)" htmlFor="nq-contact" error={err("contactName")}>
        <Input id="nq-contact" name="contactName" defaultValue={fieldValue(state, "contactName")} />
      </Field>
      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Creating...">Create draft</SubmitButton>
      </div>
    </form>
  );
}
