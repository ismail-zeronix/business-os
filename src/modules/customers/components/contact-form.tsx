"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { fieldError, fieldValue, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PREFERRED_CHANNEL_LABEL, toOptions } from "@/lib/labels";
import { createCustomerContactAction, updateCustomerContactAction } from "../actions";

export type CustomerContactFormInitial = {
  id: string;
  name: string;
  jobTitle: string | null;
  department: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  preferredChannel: string | null;
  notes: string | null;
};

/** Add or edit a customer contact. A customer can have many contacts. Only the name is required. */
export function CustomerContactForm({ customerId, contact }: { customerId: string; contact?: CustomerContactFormInitial }) {
  const close = useDrawerClose();
  const editing = Boolean(contact);
  const [state, formAction] = useActionState(editing ? updateCustomerContactAction : createCustomerContactAction, null);
  useActionFeedback(state, () => close());

  const text = (name: keyof CustomerContactFormInitial) => fieldValue(state, name, typeof contact?.[name] === "string" ? (contact[name] as string) : null);
  const err = (name: string) => fieldError(state, name);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {contact ? <input type="hidden" name="id" value={contact.id} /> : <input type="hidden" name="customerId" value={customerId} />}
      <FormMessage state={state} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" htmlFor="ccf-name" required error={err("name")} className="col-span-2">
          <Input id="ccf-name" name="name" defaultValue={text("name")} autoFocus aria-invalid={Boolean(err("name"))} />
        </Field>
        <Field label="Job title" htmlFor="ccf-jobTitle" error={err("jobTitle")}>
          <Input id="ccf-jobTitle" name="jobTitle" defaultValue={text("jobTitle")} />
        </Field>
        <Field label="Department" htmlFor="ccf-department" error={err("department")}>
          <Input id="ccf-department" name="department" defaultValue={text("department")} />
        </Field>
        <Field label="Mobile / phone" htmlFor="ccf-phone" error={err("phone")}>
          <Input id="ccf-phone" name="phone" defaultValue={text("phone")} inputMode="tel" />
        </Field>
        <Field label="WhatsApp" htmlFor="ccf-whatsapp" error={err("whatsapp")}>
          <Input id="ccf-whatsapp" name="whatsapp" defaultValue={text("whatsapp")} inputMode="tel" />
        </Field>
        <Field label="Email" htmlFor="ccf-email" error={err("email")} hint="Used to recognise this customer when an email arrives.">
          <Input id="ccf-email" name="email" type="email" defaultValue={text("email")} aria-invalid={Boolean(err("email"))} />
        </Field>
        <Field label="Preferred channel" htmlFor="ccf-channel" error={err("preferredChannel")}>
          <SelectField id="ccf-channel" name="preferredChannel" defaultValue={fieldValue(state, "preferredChannel", contact?.preferredChannel) || null} options={toOptions(PREFERRED_CHANNEL_LABEL)} />
        </Field>
        <Field label="Notes" htmlFor="ccf-notes" error={err("notes")} className="col-span-2">
          <Textarea id="ccf-notes" name="notes" rows={3} defaultValue={text("notes")} />
        </Field>
      </div>

      <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-popover px-4 py-3">
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Saving...">{editing ? "Save changes" : "Add contact"}</SubmitButton>
      </div>
    </form>
  );
}
