"use client";

import { useRouter } from "next/navigation";
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
import { SUPPLIER_TYPE_LABEL, toOptions } from "@/lib/labels";
import { createSupplierAction, updateSupplierAction } from "../actions";

export type SupplierFormInitial = {
  id: string;
  name: string;
  legalName: string | null;
  code: string | null;
  type: string | null;
  country: string | null;
  emirate: string | null;
  area: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  trn: string | null;
  paymentTerms: string | null;
  creditTerms: string | null;
  warrantyNotes: string | null;
  deliveryNotes: string | null;
  notes: string | null;
};

/** Create or edit a supplier. Only the name is required; blank fields are stored as unknown (null), never as empty strings. */
export function SupplierForm({
  supplier,
  brandOptions = [],
  categoryOptions = [],
}: {
  supplier?: SupplierFormInitial;
  brandOptions?: SelectOption[];
  categoryOptions?: SelectOption[];
}) {
  const router = useRouter();
  const close = useDrawerClose();
  const editing = Boolean(supplier);
  const [state, formAction] = useActionState(editing ? updateSupplierAction : createSupplierAction, null);

  useActionFeedback(state, (data) => {
    close();
    if (!editing) router.push(`/suppliers/${data.id}`);
  });

  const text = (name: keyof SupplierFormInitial) => fieldValue(state, name, supplier?.[name]);
  const err = (name: string) => fieldError(state, name);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {supplier ? <input type="hidden" name="id" value={supplier.id} /> : null}
      <FormMessage state={state} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Supplier name" htmlFor="sf-name" required error={err("name")} className="col-span-2">
          <Input id="sf-name" name="name" defaultValue={text("name")} autoFocus aria-invalid={Boolean(err("name"))} />
        </Field>
        <Field label="Legal name" htmlFor="sf-legalName" error={err("legalName")}>
          <Input id="sf-legalName" name="legalName" defaultValue={text("legalName")} />
        </Field>
        <Field label="Supplier code" htmlFor="sf-code" error={err("code")}>
          <Input id="sf-code" name="code" defaultValue={text("code")} />
        </Field>
        <Field label="Type" htmlFor="sf-type" error={err("type")}>
          <SelectField id="sf-type" name="type" defaultValue={fieldValue(state, "type", supplier?.type) || null} options={toOptions(SUPPLIER_TYPE_LABEL)} />
        </Field>
        <Field label="TRN (tax registration)" htmlFor="sf-trn" error={err("trn")}>
          <Input id="sf-trn" name="trn" defaultValue={text("trn")} />
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Location and contact</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Country" htmlFor="sf-country" error={err("country")}>
            <Input id="sf-country" name="country" defaultValue={text("country")} />
          </Field>
          <Field label="Emirate" htmlFor="sf-emirate" error={err("emirate")}>
            <Input id="sf-emirate" name="emirate" defaultValue={text("emirate")} />
          </Field>
          <Field label="Area" htmlFor="sf-area" error={err("area")}>
            <Input id="sf-area" name="area" defaultValue={text("area")} />
          </Field>
          <Field label="Address" htmlFor="sf-address" error={err("address")}>
            <Input id="sf-address" name="address" defaultValue={text("address")} />
          </Field>
          <Field label="Phone" htmlFor="sf-phone" error={err("phone")}>
            <Input id="sf-phone" name="phone" defaultValue={text("phone")} inputMode="tel" />
          </Field>
          <Field label="WhatsApp" htmlFor="sf-whatsapp" error={err("whatsapp")}>
            <Input id="sf-whatsapp" name="whatsapp" defaultValue={text("whatsapp")} inputMode="tel" />
          </Field>
          <Field label="Email" htmlFor="sf-email" error={err("email")}>
            <Input id="sf-email" name="email" type="email" defaultValue={text("email")} aria-invalid={Boolean(err("email"))} />
          </Field>
          <Field label="Website" htmlFor="sf-website" error={err("website")}>
            <Input id="sf-website" name="website" defaultValue={text("website")} placeholder="example.ae" aria-invalid={Boolean(err("website"))} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Procurement profile</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment terms" htmlFor="sf-paymentTerms" error={err("paymentTerms")}>
            <Input id="sf-paymentTerms" name="paymentTerms" defaultValue={text("paymentTerms")} placeholder="e.g. 30 days, COD" />
          </Field>
          <Field label="Credit terms" htmlFor="sf-creditTerms" error={err("creditTerms")}>
            <Input id="sf-creditTerms" name="creditTerms" defaultValue={text("creditTerms")} />
          </Field>
          <Field label="Warranty notes" htmlFor="sf-warrantyNotes" error={err("warrantyNotes")} className="col-span-2">
            <Textarea id="sf-warrantyNotes" name="warrantyNotes" rows={2} defaultValue={text("warrantyNotes")} />
          </Field>
          <Field label="Delivery notes" htmlFor="sf-deliveryNotes" error={err("deliveryNotes")} className="col-span-2">
            <Textarea id="sf-deliveryNotes" name="deliveryNotes" rows={2} defaultValue={text("deliveryNotes")} />
          </Field>
        </div>
      </fieldset>

      {!editing ? (
        <fieldset className="space-y-3">
          <legend className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Focus</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Brands" htmlFor="sf-brands" error={err("brandIds")}>
              <MultiSelect id="sf-brands" name="brandIds" options={brandOptions} defaultValue={fieldValues(state, "brandIds")} placeholder="Select brands" />
            </Field>
            <Field label="Categories" htmlFor="sf-categories" error={err("categoryIds")}>
              <MultiSelect id="sf-categories" name="categoryIds" options={categoryOptions} defaultValue={fieldValues(state, "categoryIds")} placeholder="Select categories" />
            </Field>
          </div>
        </fieldset>
      ) : null}

      <Field label="Notes" htmlFor="sf-notes" error={err("notes")}>
        <Textarea id="sf-notes" name="notes" rows={3} defaultValue={text("notes")} />
      </Field>

      <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-popover px-4 py-3">
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Saving...">{editing ? "Save changes" : "Create supplier"}</SubmitButton>
      </div>
    </form>
  );
}
