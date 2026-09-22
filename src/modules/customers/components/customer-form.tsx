"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { fieldError, fieldValue, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createCustomerAction, updateCustomerAction } from "../actions";

export type CustomerFormInitial = {
  id: string;
  name: string;
  legalName: string | null;
  trn: string | null;
  country: string | null;
  emirate: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

/** Create or edit a customer. Only the name is required; blank fields are stored as unknown (null), never as empty strings. */
export function CustomerForm({ customer }: { customer?: CustomerFormInitial }) {
  const router = useRouter();
  const close = useDrawerClose();
  const editing = Boolean(customer);
  const [state, formAction] = useActionState(editing ? updateCustomerAction : createCustomerAction, null);

  useActionFeedback(state, (data) => {
    close();
    if (!editing) router.push(`/customers/${data.id}`);
  });

  const text = (name: keyof CustomerFormInitial) => fieldValue(state, name, customer?.[name]);
  const err = (name: string) => fieldError(state, name);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {customer ? <input type="hidden" name="id" value={customer.id} /> : null}
      <FormMessage state={state} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Customer name" htmlFor="cuf-name" required error={err("name")} className="col-span-2">
          <Input id="cuf-name" name="name" defaultValue={text("name")} autoFocus aria-invalid={Boolean(err("name"))} />
        </Field>
        <Field label="Legal name" htmlFor="cuf-legalName" error={err("legalName")}>
          <Input id="cuf-legalName" name="legalName" defaultValue={text("legalName")} />
        </Field>
        <Field label="TRN (tax registration)" htmlFor="cuf-trn" error={err("trn")}>
          <Input id="cuf-trn" name="trn" defaultValue={text("trn")} />
        </Field>
        <Field label="Country" htmlFor="cuf-country" error={err("country")}>
          <Input id="cuf-country" name="country" defaultValue={text("country")} />
        </Field>
        <Field label="Emirate" htmlFor="cuf-emirate" error={err("emirate")}>
          <Input id="cuf-emirate" name="emirate" defaultValue={text("emirate")} />
        </Field>
        <Field label="Phone" htmlFor="cuf-phone" error={err("phone")}>
          <Input id="cuf-phone" name="phone" defaultValue={text("phone")} inputMode="tel" />
        </Field>
        <Field label="Email" htmlFor="cuf-email" error={err("email")}>
          <Input id="cuf-email" name="email" type="email" defaultValue={text("email")} aria-invalid={Boolean(err("email"))} />
        </Field>
        <Field label="Website" htmlFor="cuf-website" error={err("website")} className="col-span-2">
          <Input id="cuf-website" name="website" defaultValue={text("website")} placeholder="example.ae" aria-invalid={Boolean(err("website"))} />
        </Field>
        <Field label="Notes" htmlFor="cuf-notes" error={err("notes")} className="col-span-2">
          <Textarea id="cuf-notes" name="notes" rows={3} defaultValue={text("notes")} />
        </Field>
      </div>

      <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-popover px-4 py-3">
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Saving...">{editing ? "Save changes" : "Create customer"}</SubmitButton>
      </div>
    </form>
  );
}
