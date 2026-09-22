"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { MultiSelect, type SelectOption } from "@/components/forms/multi-select";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { fieldError, fieldValue, fieldValues, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PREFERRED_CHANNEL_LABEL, toOptions } from "@/lib/labels";
import { createContactAction, updateContactAction } from "../actions";

export type ContactFormInitial = {
  id: string;
  name: string;
  jobTitle: string | null;
  department: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  preferredChannel: string | null;
  notes: string | null;
  brandIds: string[];
  categoryIds: string[];
};

/** Add or edit a supplier contact. A supplier can have many contacts; each can handle its own brands and categories. */
export function ContactForm({
  supplierId,
  contact,
  brandOptions,
  categoryOptions,
}: {
  supplierId: string;
  contact?: ContactFormInitial;
  brandOptions: SelectOption[];
  categoryOptions: SelectOption[];
}) {
  const close = useDrawerClose();
  const editing = Boolean(contact);
  const [state, formAction] = useActionState(editing ? updateContactAction : createContactAction, null);
  useActionFeedback(state, () => close());

  const text = (name: keyof ContactFormInitial) => fieldValue(state, name, typeof contact?.[name] === "string" ? (contact[name] as string) : null);
  const err = (name: string) => fieldError(state, name);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {contact ? <input type="hidden" name="id" value={contact.id} /> : <input type="hidden" name="supplierId" value={supplierId} />}
      <FormMessage state={state} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" htmlFor="cf-name" required error={err("name")} className="col-span-2">
          <Input id="cf-name" name="name" defaultValue={text("name")} autoFocus aria-invalid={Boolean(err("name"))} />
        </Field>
        <Field label="Job title" htmlFor="cf-jobTitle" error={err("jobTitle")}>
          <Input id="cf-jobTitle" name="jobTitle" defaultValue={text("jobTitle")} />
        </Field>
        <Field label="Department" htmlFor="cf-department" error={err("department")}>
          <Input id="cf-department" name="department" defaultValue={text("department")} />
        </Field>
        <Field label="Mobile / phone" htmlFor="cf-phone" error={err("phone")}>
          <Input id="cf-phone" name="phone" defaultValue={text("phone")} inputMode="tel" />
        </Field>
        <Field label="WhatsApp" htmlFor="cf-whatsapp" error={err("whatsapp")}>
          <Input id="cf-whatsapp" name="whatsapp" defaultValue={text("whatsapp")} inputMode="tel" />
        </Field>
        <Field label="Email" htmlFor="cf-email" error={err("email")}>
          <Input id="cf-email" name="email" type="email" defaultValue={text("email")} aria-invalid={Boolean(err("email"))} />
        </Field>
        <Field label="Preferred channel" htmlFor="cf-channel" error={err("preferredChannel")}>
          <SelectField id="cf-channel" name="preferredChannel" defaultValue={fieldValue(state, "preferredChannel", contact?.preferredChannel) || null} options={toOptions(PREFERRED_CHANNEL_LABEL)} />
        </Field>
        <Field label="Brands handled" htmlFor="cf-brands" error={err("brandIds")}>
          <MultiSelect id="cf-brands" name="brandIds" options={brandOptions} defaultValue={fieldValues(state, "brandIds", contact?.brandIds)} placeholder="Select brands" />
        </Field>
        <Field label="Categories handled" htmlFor="cf-categories" error={err("categoryIds")}>
          <MultiSelect id="cf-categories" name="categoryIds" options={categoryOptions} defaultValue={fieldValues(state, "categoryIds", contact?.categoryIds)} placeholder="Select categories" />
        </Field>
        <Field label="Notes" htmlFor="cf-notes" error={err("notes")} className="col-span-2">
          <Textarea id="cf-notes" name="notes" rows={3} defaultValue={text("notes")} />
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
