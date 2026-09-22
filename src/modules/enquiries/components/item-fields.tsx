"use client";

import { Field } from "@/components/forms/field";
import { fieldError, fieldValue } from "@/components/forms/use-action-feedback";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/core/validation/action-result";

export type EnquiryItemFieldValues = {
  description: string | null;
  brandText: string | null;
  familyText: string | null;
  modelText: string | null;
  partNumber: string | null;
  specText: string | null;
  quantity: number | null;
  notes: string | null;
};

export const EMPTY_ENQUIRY_ITEM: EnquiryItemFieldValues = {
  description: null,
  brandText: null,
  familyText: null,
  modelText: null,
  partNumber: null,
  specText: null,
  quantity: null,
  notes: null,
};

/**
 * The reviewable fields of an enquiry requirement, shared by the inline editor and the "add requirement" drawer.
 * Every field may stay unknown; nothing is defaulted.
 */
export function EnquiryItemFieldsGrid({ idPrefix, initial, state }: { idPrefix: string; initial: EnquiryItemFieldValues; state: ActionResult<unknown> | null }) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const err = (name: string) => fieldError(state, name);
  const text = (name: keyof EnquiryItemFieldValues) => fieldValue(state, name, initial[name] === null ? null : String(initial[name]));

  return (
    <div className="grid grid-cols-12 gap-3">
      <Field label="Requirement" htmlFor={id("description")} error={err("description")} className="col-span-12">
        <Input id={id("description")} name="description" defaultValue={text("description")} />
      </Field>
      <Field label="Brand" htmlFor={id("brandText")} error={err("brandText")} className="col-span-3">
        <Input id={id("brandText")} name="brandText" defaultValue={text("brandText")} />
      </Field>
      <Field label="Family" htmlFor={id("familyText")} error={err("familyText")} className="col-span-3">
        <Input id={id("familyText")} name="familyText" defaultValue={text("familyText")} />
      </Field>
      <Field label="Model" htmlFor={id("modelText")} error={err("modelText")} className="col-span-3">
        <Input id={id("modelText")} name="modelText" defaultValue={text("modelText")} />
      </Field>
      <Field label="Part number" htmlFor={id("partNumber")} error={err("partNumber")} className="col-span-3">
        <Input id={id("partNumber")} name="partNumber" defaultValue={text("partNumber")} className="font-mono" />
      </Field>
      <Field label="Specification" htmlFor={id("specText")} error={err("specText")} className="col-span-12">
        <Input id={id("specText")} name="specText" defaultValue={text("specText")} />
      </Field>
      <Field label="Quantity" htmlFor={id("quantity")} error={err("quantity")} className="col-span-3">
        <Input id={id("quantity")} name="quantity" inputMode="numeric" defaultValue={text("quantity")} className="num" aria-invalid={Boolean(err("quantity"))} />
      </Field>
      <Field label="Reviewer notes" htmlFor={id("notes")} error={err("notes")} className="col-span-9">
        <Textarea id={id("notes")} name="notes" rows={1} defaultValue={text("notes")} className="min-h-8" />
      </Field>
    </div>
  );
}
