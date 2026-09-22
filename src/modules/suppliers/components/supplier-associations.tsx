"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { MultiSelect, type SelectOption } from "@/components/forms/multi-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldValues, useActionFeedback } from "@/components/forms/use-action-feedback";
import { saveSupplierAssociationsAction } from "../actions";

/** Inline editor for the brands and categories a supplier commonly handles (relational links, never comma-separated text). */
export function SupplierAssociations({
  supplierId,
  brandOptions,
  categoryOptions,
  brandIds,
  categoryIds,
}: {
  supplierId: string;
  brandOptions: SelectOption[];
  categoryOptions: SelectOption[];
  brandIds: string[];
  categoryIds: string[];
}) {
  const [state, formAction] = useActionState(saveSupplierAssociationsAction, null);
  useActionFeedback(state);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={supplierId} />
      <FormMessage state={state} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Brands" htmlFor="sa-brands">
          <MultiSelect id="sa-brands" name="brandIds" options={brandOptions} defaultValue={fieldValues(state, "brandIds", brandIds)} placeholder="Select brands" />
        </Field>
        <Field label="Categories" htmlFor="sa-categories">
          <MultiSelect id="sa-categories" name="categoryIds" options={categoryOptions} defaultValue={fieldValues(state, "categoryIds", categoryIds)} placeholder="Select categories" />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton size="sm" variant="outline" pendingLabel="Saving...">
          Save brands and categories
        </SubmitButton>
      </div>
    </form>
  );
}
