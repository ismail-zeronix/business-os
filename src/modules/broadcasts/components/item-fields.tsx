"use client";

import { Field } from "@/components/forms/field";
import { SelectField } from "@/components/forms/select-field";
import { fieldError, fieldValue } from "@/components/forms/use-action-feedback";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/core/validation/action-result";
import { SUPPORTED_CURRENCIES } from "@/core/validation/fields";
import { STOCK_STATUS_LABEL, VAT_STATE_LABEL, WARRANTY_TYPE_LABEL, toOptions } from "@/lib/labels";

export type ItemFieldValues = {
  description: string | null;
  brandText: string | null;
  modelText: string | null;
  partNumber: string | null;
  categoryText: string | null;
  specText: string | null;
  quantity: number | null;
  /** Decimal as text, e.g. "2450" or "2450.5". */
  priceAmount: string | null;
  currencyCode: string | null;
  vatState: string;
  stockStatus: string;
  warrantyMonths: number | null;
  warrantyType: string | null;
  notes: string | null;
};

export const EMPTY_ITEM: ItemFieldValues = {
  description: null,
  brandText: null,
  modelText: null,
  partNumber: null,
  categoryText: null,
  specText: null,
  quantity: null,
  priceAmount: null,
  currencyCode: null,
  vatState: "UNKNOWN",
  stockStatus: "UNKNOWN",
  warrantyMonths: null,
  warrantyType: null,
  notes: null,
};

const CURRENCY_OPTIONS = SUPPORTED_CURRENCIES.map((code) => ({ value: code, label: code }));
/** The business default that is pre-selected VISIBLY when a price has no currency. A person confirms it; the database never defaults it. */
const SUGGESTED_CURRENCY = "AED";

/**
 * The reviewable fields of a broadcast item, shared by the inline editor and the "add item" drawer. Every field may stay unknown.
 * When a price is present without a currency, AED is pre-selected and flagged for confirmation (it is never stored silently).
 */
export function ItemFieldsGrid({ idPrefix, initial, state }: { idPrefix: string; initial: ItemFieldValues; state: ActionResult<unknown> | null }) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const err = (name: string) => fieldError(state, name);
  const text = (name: keyof ItemFieldValues) => fieldValue(state, name, initial[name] === null ? null : String(initial[name]));

  const price = text("priceAmount");
  const submittedCurrency = fieldValue(state, "currencyCode", initial.currencyCode);
  const currencyIsSuggestion = Boolean(price) && !submittedCurrency;

  return (
    <div className="grid grid-cols-12 gap-3">
      <Field label="Description" htmlFor={id("description")} error={err("description")} className="col-span-12">
        <Input id={id("description")} name="description" defaultValue={text("description")} />
      </Field>
      <Field label="Brand" htmlFor={id("brandText")} error={err("brandText")} className="col-span-3">
        <Input id={id("brandText")} name="brandText" defaultValue={text("brandText")} />
      </Field>
      <Field label="Model" htmlFor={id("modelText")} error={err("modelText")} className="col-span-3">
        <Input id={id("modelText")} name="modelText" defaultValue={text("modelText")} />
      </Field>
      <Field label="Category" htmlFor={id("categoryText")} error={err("categoryText")} className="col-span-3">
        <Input id={id("categoryText")} name="categoryText" defaultValue={text("categoryText")} />
      </Field>
      <Field label="Part number" htmlFor={id("partNumber")} error={err("partNumber")} className="col-span-3">
        <Input id={id("partNumber")} name="partNumber" defaultValue={text("partNumber")} className="font-mono" />
      </Field>
      <Field label="Specification" htmlFor={id("specText")} error={err("specText")} className="col-span-12">
        <Input id={id("specText")} name="specText" defaultValue={text("specText")} />
      </Field>
      <Field label="Quantity" htmlFor={id("quantity")} error={err("quantity")} className="col-span-3">
        <Input id={id("quantity")} name="quantity" inputMode="numeric" defaultValue={text("quantity")} className="num" />
      </Field>
      <Field label="Price" htmlFor={id("priceAmount")} error={err("priceAmount")} className="col-span-3">
        <Input id={id("priceAmount")} name="priceAmount" inputMode="decimal" defaultValue={price} className="num" aria-invalid={Boolean(err("priceAmount"))} />
      </Field>
      <Field
        label="Currency"
        htmlFor={id("currencyCode")}
        error={err("currencyCode")}
        hint={currencyIsSuggestion ? `${SUGGESTED_CURRENCY} suggested. Please confirm.` : undefined}
        className="col-span-3"
      >
        <SelectField id={id("currencyCode")} name="currencyCode" noneLabel="Not set" options={CURRENCY_OPTIONS} defaultValue={submittedCurrency || (price ? SUGGESTED_CURRENCY : null)} />
      </Field>
      <Field label="VAT" htmlFor={id("vatState")} error={err("vatState")} className="col-span-3">
        <SelectField id={id("vatState")} name="vatState" allowNone={false} options={toOptions(VAT_STATE_LABEL, ["UNKNOWN", "EXCLUDED", "INCLUDED"])} defaultValue={fieldValue(state, "vatState", initial.vatState) || "UNKNOWN"} />
      </Field>
      <Field label="Stock status" htmlFor={id("stockStatus")} error={err("stockStatus")} className="col-span-3">
        <SelectField
          id={id("stockStatus")}
          name="stockStatus"
          allowNone={false}
          options={toOptions(STOCK_STATUS_LABEL, ["UNKNOWN", "IN_STOCK", "AVAILABLE", "LIMITED", "INCOMING", "ON_REQUEST", "OUT_OF_STOCK"])}
          defaultValue={fieldValue(state, "stockStatus", initial.stockStatus) || "UNKNOWN"}
        />
      </Field>
      <Field label="Warranty (months)" htmlFor={id("warrantyMonths")} error={err("warrantyMonths")} className="col-span-2">
        <Input id={id("warrantyMonths")} name="warrantyMonths" inputMode="numeric" defaultValue={text("warrantyMonths")} className="num" />
      </Field>
      <Field label="Warranty type" htmlFor={id("warrantyType")} error={err("warrantyType")} className="col-span-3">
        <SelectField id={id("warrantyType")} name="warrantyType" noneLabel="Not set" options={toOptions(WARRANTY_TYPE_LABEL)} defaultValue={fieldValue(state, "warrantyType", initial.warrantyType)} />
      </Field>
      <Field label="Reviewer notes" htmlFor={id("notes")} error={err("notes")} className="col-span-4">
        <Textarea id={id("notes")} name="notes" rows={1} defaultValue={text("notes")} className="min-h-8" />
      </Field>
    </div>
  );
}
