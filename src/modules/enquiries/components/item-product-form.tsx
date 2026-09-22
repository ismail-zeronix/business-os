"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { FormMessage } from "@/components/forms/form-message";
import type { SelectOption } from "@/components/forms/multi-select";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, fieldValue, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProductForEnquiryItemAction, linkEnquiryItemAction } from "../actions";

export type ProductDefaults = { name: string; brandId: string | null; family: string; model: string; partNumber: string };

/**
 * Creates a TEMPORARY product from an enquiry requirement and links it, without leaving the review. Prefilled from what the
 * requirement says; nothing is invented. If the part number already belongs to a product, the person gets a one-click "use the existing product".
 */
export function EnquiryItemProductForm({
  itemId,
  defaults,
  brandOptions,
  categoryOptions,
  rememberDefault,
}: {
  itemId: string;
  defaults: ProductDefaults;
  brandOptions: SelectOption[];
  categoryOptions: SelectOption[];
  rememberDefault: boolean;
}) {
  const close = useDrawerClose();
  const [state, formAction] = useActionState(createProductForEnquiryItemAction, null);
  const [linkState, linkAction] = useActionState(linkEnquiryItemAction, null);
  useActionFeedback(state, () => close());
  useActionFeedback(linkState, () => close());

  const existingProductId = state && !state.ok ? state.fieldErrors?._existingProductId : undefined;
  const err = (name: string) => fieldError(state, name);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="itemId" value={itemId} />
        <FormMessage state={state} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Product name" htmlFor="eipf-name" required error={err("name")} className="col-span-2">
            <Input id="eipf-name" name="name" defaultValue={fieldValue(state, "name", defaults.name)} autoFocus aria-invalid={Boolean(err("name"))} />
          </Field>
          <Field label="Brand" htmlFor="eipf-brand" error={err("brandId")}>
            <SelectField id="eipf-brand" name="brandId" defaultValue={fieldValue(state, "brandId", defaults.brandId) || null} options={brandOptions} />
          </Field>
          <Field label="Category" htmlFor="eipf-category" error={err("categoryId")}>
            <SelectField id="eipf-category" name="categoryId" defaultValue={fieldValue(state, "categoryId", null) || null} options={categoryOptions} />
          </Field>
          <Field label="Family" htmlFor="eipf-family" error={err("family")}>
            <Input id="eipf-family" name="family" defaultValue={fieldValue(state, "family", defaults.family)} />
          </Field>
          <Field label="Model" htmlFor="eipf-model" error={err("model")}>
            <Input id="eipf-model" name="model" defaultValue={fieldValue(state, "model", defaults.model)} />
          </Field>
          <Field label="Part number" htmlFor="eipf-partNumber" error={err("partNumber")} className="col-span-2">
            <Input id="eipf-partNumber" name="partNumber" defaultValue={fieldValue(state, "partNumber", defaults.partNumber)} className="font-mono" aria-invalid={Boolean(err("partNumber"))} />
          </Field>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="eipf-remember" name="rememberAlias" defaultChecked={rememberDefault} />
          <Label htmlFor="eipf-remember" className="text-xs font-normal text-muted-foreground">
            Remember the customer&apos;s wording as an alias
          </Label>
        </div>

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <SubmitButton pendingLabel="Creating...">Create and link</SubmitButton>
        </div>
      </form>

      {existingProductId ? (
        <form action={linkAction} className="flex items-center justify-between gap-3 rounded-lg border border-info-border bg-info-bg px-3 py-2">
          <input type="hidden" name="itemId" value={itemId} />
          <input type="hidden" name="productId" value={existingProductId} />
          <span className="text-xs text-info">That part number already exists. Link this requirement to the existing product instead?</span>
          <SubmitButton size="sm" variant="outline" pendingLabel="Linking...">
            Use existing product
          </SubmitButton>
        </form>
      ) : null}
      <FormMessage state={linkState} />
    </div>
  );
}
