"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import type { SelectOption } from "@/components/forms/multi-select";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { fieldError, fieldValue, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProductAction, updateProductAction } from "../actions";
import { Alert } from "@/components/ui/alert";

export type ProductFormInitial = {
  id: string;
  name: string;
  brandId: string | null;
  categoryId: string | null;
  family: string | null;
  model: string | null;
  partNumber: string | null;
  manufacturerSku: string | null;
  description: string | null;
  isTemporary: boolean;
};

/** Create or edit a product. Only the name is required; everything else can stay unknown. */
export function ProductForm({ product, brandOptions, categoryOptions }: { product?: ProductFormInitial; brandOptions: SelectOption[]; categoryOptions: SelectOption[] }) {
  const router = useRouter();
  const close = useDrawerClose();
  const editing = Boolean(product);
  const [state, formAction] = useActionState(editing ? updateProductAction : createProductAction, null);

  useActionFeedback(state, (data) => {
    close();
    if (!editing) router.push(`/products/${data.id}`);
  });

  const text = (name: keyof ProductFormInitial) => fieldValue(state, name, typeof product?.[name] === "string" ? (product[name] as string) : null);
  const err = (name: string) => fieldError(state, name);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <FormMessage state={state} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Product name" htmlFor="pf-name" required error={err("name")} className="col-span-2">
          <Input id="pf-name" name="name" defaultValue={text("name")} autoFocus aria-invalid={Boolean(err("name"))} placeholder="e.g. Lenovo V15 G4 IRU" />
        </Field>
        <Field label="Brand" htmlFor="pf-brand" error={err("brandId")}>
          <SelectField id="pf-brand" name="brandId" defaultValue={fieldValue(state, "brandId", product?.brandId) || null} options={brandOptions} />
        </Field>
        <Field label="Category" htmlFor="pf-category" error={err("categoryId")}>
          <SelectField id="pf-category" name="categoryId" defaultValue={fieldValue(state, "categoryId", product?.categoryId) || null} options={categoryOptions} />
        </Field>
        <Field label="Family" htmlFor="pf-family" error={err("family")}>
          <Input id="pf-family" name="family" defaultValue={text("family")} placeholder="e.g. Latitude" />
        </Field>
        <Field label="Model" htmlFor="pf-model" error={err("model")}>
          <Input id="pf-model" name="model" defaultValue={text("model")} placeholder="e.g. 5440" />
        </Field>
        <Field label="Part number" htmlFor="pf-partNumber" error={err("partNumber")} hint="Unique across products. Leave blank if unknown.">
          <Input id="pf-partNumber" name="partNumber" defaultValue={text("partNumber")} className="font-mono" aria-invalid={Boolean(err("partNumber"))} />
        </Field>
        <Field label="Manufacturer SKU" htmlFor="pf-manufacturerSku" error={err("manufacturerSku")}>
          <Input id="pf-manufacturerSku" name="manufacturerSku" defaultValue={text("manufacturerSku")} className="font-mono" />
        </Field>
        <Field label="Description" htmlFor="pf-description" error={err("description")} className="col-span-2">
          <Textarea id="pf-description" name="description" rows={3} defaultValue={text("description")} />
        </Field>
      </div>

      {product?.isTemporary ? (
        <Alert variant="warning" className="flex items-start gap-2 px-3 py-2">
          <Checkbox id="pf-needsCuration" name="needsCuration" defaultChecked className="mt-0.5" />
          <Label htmlFor="pf-needsCuration" className="text-xs leading-4 font-normal text-warning">
            Still needs curation. This product was created from a broadcast. Untick once you have checked its details.
          </Label>
        </Alert>
      ) : null}

      <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-popover px-4 py-3">
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Saving...">{editing ? "Save changes" : "Create product"}</SubmitButton>
      </div>
    </form>
  );
}
