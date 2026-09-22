"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, fieldValue, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORTED_CURRENCIES } from "@/core/validation/fields";
import { updateQuotationDetailsAction } from "../actions";

export type QuotationDetailsInitial = {
  id: string;
  customerName: string | null;
  contactName: string | null;
  currencyCode: string;
  /** "5" */
  vatPercent: string;
  /** yyyy-mm-dd */
  validUntil: string | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  notes: string | null;
};

/** The header of a draft: who it is for, currency, VAT, validity and the terms and notes the customer will read. */
export function QuotationDetailsForm({ quotation }: { quotation: QuotationDetailsInitial }) {
  const close = useDrawerClose();
  const [state, formAction] = useActionState(updateQuotationDetailsAction, null);
  useActionFeedback(state, () => close());

  const text = (name: keyof QuotationDetailsInitial) => fieldValue(state, name, quotation[name]);
  const err = (name: string) => fieldError(state, name);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={quotation.id} />
      <FormMessage state={state} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Customer name" htmlFor="qd-customerName" error={err("customerName")} className="col-span-2">
          <Input id="qd-customerName" name="customerName" defaultValue={text("customerName")} aria-invalid={Boolean(err("customerName"))} />
        </Field>
        <Field label="Attention (contact)" htmlFor="qd-contactName" error={err("contactName")} className="col-span-2">
          <Input id="qd-contactName" name="contactName" defaultValue={text("contactName")} />
        </Field>
        <Field label="Currency" htmlFor="qd-currency" error={err("currencyCode")} >
          <SelectField id="qd-currency" name="currencyCode" allowNone={false} defaultValue={text("currencyCode") || "AED"} options={SUPPORTED_CURRENCIES.map((code) => ({ value: code, label: code }))} />
        </Field>
        <Field label="VAT %" htmlFor="qd-vat" error={err("vatPercent")} >
          <Input id="qd-vat" name="vatPercent" inputMode="decimal" defaultValue={text("vatPercent")} aria-invalid={Boolean(err("vatPercent"))} />
        </Field>
        <Field label="Valid until" htmlFor="qd-validUntil" error={err("validUntil")} >
          <Input id="qd-validUntil" name="validUntil" type="date" defaultValue={text("validUntil")} aria-invalid={Boolean(err("validUntil"))} />
        </Field>
        <Field label="Payment terms" htmlFor="qd-payment" error={err("paymentTerms")}>
          <Input id="qd-payment" name="paymentTerms" defaultValue={text("paymentTerms")} />
        </Field>
        <Field label="Delivery terms" htmlFor="qd-delivery" error={err("deliveryTerms")} className="col-span-2">
          <Input id="qd-delivery" name="deliveryTerms" defaultValue={text("deliveryTerms")} />
        </Field>
        <Field label="Notes for the customer" htmlFor="qd-notes" error={err("notes")} className="col-span-2">
          <Textarea id="qd-notes" name="notes" rows={4} defaultValue={text("notes")} />
        </Field>
      </div>

      <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-popover px-4 py-3">
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Saving...">Save details</SubmitButton>
      </div>
    </form>
  );
}
