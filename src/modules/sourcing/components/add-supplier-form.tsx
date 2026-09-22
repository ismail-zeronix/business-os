"use client";

import { useActionState, useState } from "react";
import { Combobox } from "@/components/forms/combobox";
import { Field } from "@/components/forms/field";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { FormMessage } from "@/components/forms/form-message";
import type { SelectOption } from "@/components/forms/multi-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, useActionFeedback } from "@/components/forms/use-action-feedback";
import { addSupplierRequestAction } from "../actions";

type ContactOption = SelectOption & { supplierId: string };

/** Pick a supplier (suggested ones first, with the reason) and, optionally, the contact to greet by name. */
export function AddSupplierForm({ enquiryId, suppliers, contacts }: { enquiryId: string; suppliers: SelectOption[]; contacts: ContactOption[] }) {
  const close = useDrawerClose();
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [state, formAction] = useActionState(addSupplierRequestAction, null);
  useActionFeedback(state, close);
  const contactOptions = contacts.filter((c) => c.supplierId === supplierId);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="enquiryId" value={enquiryId} />
      <FormMessage state={state} />
      <Field label="Supplier" htmlFor="sr-supplier" required error={fieldError(state, "supplierId")} hint="Suppliers with a price on record or who handle the brand are listed first.">
        <Combobox id="sr-supplier" name="supplierId" options={suppliers} placeholder="Select a supplier" onValueChange={setSupplierId} />
      </Field>
      <Field label="Contact (optional)" htmlFor="sr-contact" error={fieldError(state, "contactId")} hint="The message greets this person by name.">
        <Combobox
          key={supplierId ?? "none"}
          id="sr-contact"
          name="contactId"
          options={contactOptions}
          placeholder={supplierId ? (contactOptions.length ? "Select a contact" : "No contacts for this supplier") : "Choose a supplier first"}
          disabled={!supplierId || contactOptions.length === 0}
          clearable
        />
      </Field>
      <div className="flex justify-end border-t pt-3">
        <SubmitButton pendingLabel="Adding...">Add supplier</SubmitButton>
      </div>
    </form>
  );
}
