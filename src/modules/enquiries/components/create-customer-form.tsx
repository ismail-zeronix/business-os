"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, fieldValue, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCustomerFromRequesterAction } from "../actions";

/**
 * Promotes the person who wrote in to a real customer and contact, and links the enquiry to them. The company name is required (it is not
 * guessed from the email domain); the contact is prefilled from the requester.
 */
export function CreateCustomerFromRequesterForm({ enquiryId, requesterName, requesterEmail }: { enquiryId: string; requesterName: string | null; requesterEmail: string | null }) {
  const close = useDrawerClose();
  const [state, formAction] = useActionState(createCustomerFromRequesterAction, null);
  useActionFeedback(state, () => close());
  const err = (name: string) => fieldError(state, name);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="enquiryId" value={enquiryId} />
      <FormMessage state={state} />
      <Field label="Customer (company) name" htmlFor="ccr-name" required error={err("name")}>
        <Input id="ccr-name" name="name" defaultValue={fieldValue(state, "name")} autoFocus aria-invalid={Boolean(err("name"))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact name" htmlFor="ccr-contactName" error={err("contactName")}>
          <Input id="ccr-contactName" name="contactName" defaultValue={fieldValue(state, "contactName", requesterName)} />
        </Field>
        <Field label="Contact email" htmlFor="ccr-contactEmail" error={err("contactEmail")} hint="Later emails from this address are recognised as this customer.">
          <Input id="ccr-contactEmail" name="contactEmail" type="email" defaultValue={fieldValue(state, "contactEmail", requesterEmail)} aria-invalid={Boolean(err("contactEmail"))} />
        </Field>
      </div>
      <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-popover px-4 py-3">
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Creating...">Create customer and link</SubmitButton>
      </div>
    </form>
  );
}
