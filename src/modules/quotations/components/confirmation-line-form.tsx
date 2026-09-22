"use client";

import { ChevronDown, Search } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Combobox } from "@/components/forms/combobox";
import { Field } from "@/components/forms/field";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { FormMessage } from "@/components/forms/form-message";
import type { SelectOption } from "@/components/forms/multi-select";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, fieldValue, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORTED_CURRENCIES } from "@/core/validation/fields";
import { EVIDENCE_CHANNEL_LABEL, STOCK_STATUS_LABEL, VAT_STATE_LABEL, toOptions } from "@/lib/labels";
import { searchProductsForLinkAction } from "@/modules/broadcasts/actions";
import { CONFIRMATION_CHANNELS } from "@/modules/broadcasts/confirmation.schemas";
import type { ProductPickerRow } from "@/modules/products/queries";
import { addLineFromConfirmationAction } from "../actions";

type ContactOption = SelectOption & { supplierId: string };

const SECTION = "text-[11px] font-medium tracking-wider text-muted-foreground uppercase";

/**
 * Add a line when a supplier has just confirmed a price by phone or message. Saving records the confirmation as supplier evidence (with your
 * note as the record), creates the product if it is new, records the price and stock, and adds the line costing from that price. Nothing is
 * guessed: every value here is typed by you.
 */
export function ConfirmationLineForm({
  quotationId,
  currencyCode,
  defaultConfirmedAt,
  suppliers,
  contacts,
  brands,
}: {
  quotationId: string;
  currencyCode: string;
  /** yyyy-mm-ddThh:mm in the business timezone */
  defaultConfirmedAt: string;
  suppliers: SelectOption[];
  contacts: ContactOption[];
  brands: SelectOption[];
}) {
  const close = useDrawerClose();
  const [state, formAction] = useActionState(addLineFromConfirmationAction, null);
  useActionFeedback(state, () => close());
  const err = (name: string) => fieldError(state, name);

  const [supplierId, setSupplierId] = useState<string | null>(null);
  const contactOptions = contacts.filter((c) => c.supplierId === supplierId);

  // Product: an existing one (searched), or a new one (typed).
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selected, setSelected] = useState<ProductPickerRow | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductPickerRow[]>([]);
  const [searching, startSearch] = useTransition();
  useEffect(() => {
    if (mode !== "existing") return;
    const handle = setTimeout(() => startSearch(async () => setResults(await searchProductsForLinkAction(query))), 250);
    return () => clearTimeout(handle);
  }, [query, mode]);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="quotationId" value={quotationId} />
      <FormMessage state={state} />

      <section className="space-y-2">
        <h3 className={SECTION}>Product</h3>
        <div className="flex gap-1.5">
          <Button type="button" size="xs" variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")}>
            Existing product
          </Button>
          <Button type="button" size="xs" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>
            New product
          </Button>
        </div>

        {mode === "existing" ? (
          <>
            {selected ? <input type="hidden" name="productId" value={selected.id} /> : null}
            {selected ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-surface p-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{selected.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {selected.brandName ?? "No brand"}
                    {selected.partNumber ? <span className="font-mono"> · {selected.partNumber}</span> : null}
                  </div>
                </div>
                <Button type="button" size="xs" variant="outline" onClick={() => setSelected(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, model, part number or alias" aria-label="Search products" className="h-8 pl-7 text-sm" />
                </div>
                {results.length ? (
                  <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border bg-background">
                    {results.map((row) => (
                      <li key={row.id} className="flex items-center justify-between gap-3 px-2.5 py-1.5">
                        <div className="min-w-0">
                          <div className="truncate text-sm">{row.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {row.brandName ?? "No brand"}
                            {row.partNumber ? <span className="font-mono"> · {row.partNumber}</span> : null}
                          </div>
                        </div>
                        <Button type="button" size="xs" variant="outline" onClick={() => setSelected(row)}>
                          Use
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">{searching ? "Searching..." : query.trim().length >= 2 ? "No products match. Use New product." : "Type at least two letters."}</p>
                )}
              </div>
            )}
            {err("name") ? (
              <p role="alert" className="text-xs text-danger">
                {err("name")}
              </p>
            ) : null}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Product name" htmlFor="cl-name" error={err("name")} required className="col-span-2">
              <Input id="cl-name" name="name" defaultValue={fieldValue(state, "name")} aria-invalid={Boolean(err("name"))} />
            </Field>
            <Field label="Brand" htmlFor="cl-brand" error={err("brandId")}>
              <Combobox id="cl-brand" name="brandId" options={brands} placeholder="No brand" clearable />
            </Field>
            <Field label="Model" htmlFor="cl-model" error={err("model")}>
              <Input id="cl-model" name="model" defaultValue={fieldValue(state, "model")} />
            </Field>
            <Field label="Part number" htmlFor="cl-pn" error={err("partNumber")} className="col-span-2">
              <Input id="cl-pn" name="partNumber" defaultValue={fieldValue(state, "partNumber")} className="font-mono" />
            </Field>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className={SECTION}>Supplier</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Supplier" htmlFor="cl-supplier" error={err("supplierId")} required>
            <Combobox id="cl-supplier" name="supplierId" options={suppliers} placeholder="Select a supplier" onValueChange={setSupplierId} />
          </Field>
          <Field label="Spoke to (optional)" htmlFor="cl-contact" error={err("contactId")}>
            <Combobox
              key={supplierId ?? "none"}
              id="cl-contact"
              name="contactId"
              options={contactOptions}
              placeholder={supplierId ? (contactOptions.length ? "Select a contact" : "No contacts") : "Choose a supplier"}
              disabled={!supplierId || contactOptions.length === 0}
              clearable
            />
          </Field>
          <Field label="Confirmed by" htmlFor="cl-channel" error={err("channel")}>
            <SelectField id="cl-channel" name="channel" allowNone={false} defaultValue={fieldValue(state, "channel", "PHONE") || "PHONE"} options={CONFIRMATION_CHANNELS.map((value) => ({ value, label: EVIDENCE_CHANNEL_LABEL[value] }))} />
          </Field>
          <Field label="When" htmlFor="cl-when" error={err("confirmedAt")}>
            <Input id="cl-when" name="confirmedAt" type="datetime-local" defaultValue={fieldValue(state, "confirmedAt", defaultConfirmedAt)} aria-invalid={Boolean(err("confirmedAt"))} />
          </Field>
          <Field label="Note (kept as the record)" htmlFor="cl-note" error={err("note")} required className="col-span-2">
            <Textarea id="cl-note" name="note" rows={2} placeholder="e.g. Ahmed on the phone: 20 pcs ready, price good for today" defaultValue={fieldValue(state, "note")} aria-invalid={Boolean(err("note"))} />
          </Field>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className={SECTION}>What they confirmed</h3>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Their price (per unit)" htmlFor="cl-price" error={err("priceAmount")} required>
            <Input id="cl-price" name="priceAmount" inputMode="decimal" defaultValue={fieldValue(state, "priceAmount")} aria-invalid={Boolean(err("priceAmount"))} />
          </Field>
          <Field label="Currency" htmlFor="cl-currency" error={err("currencyCode")}>
            <SelectField id="cl-currency" name="currencyCode" allowNone={false} defaultValue={fieldValue(state, "currencyCode", currencyCode) || currencyCode} options={SUPPORTED_CURRENCIES.map((code) => ({ value: code, label: code }))} />
          </Field>
          <Field label="VAT" htmlFor="cl-vat" error={err("vatState")}>
            <SelectField id="cl-vat" name="vatState" allowNone={false} defaultValue={fieldValue(state, "vatState", "UNKNOWN") || "UNKNOWN"} options={toOptions(VAT_STATE_LABEL)} />
          </Field>
        </div>
        <details className="group rounded-lg border" open={Boolean(err("stockQuantity") || err("stockStatus"))}>
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs text-muted-foreground select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
            Their stock (optional)
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="grid grid-cols-3 gap-3 border-t p-3">
            <Field label="Quantity" htmlFor="cl-stockqty" error={err("stockQuantity")}>
              <Input id="cl-stockqty" name="stockQuantity" inputMode="numeric" defaultValue={fieldValue(state, "stockQuantity")} aria-invalid={Boolean(err("stockQuantity"))} />
            </Field>
            <Field label="Status" htmlFor="cl-stockstatus" error={err("stockStatus")} className="col-span-2">
              <SelectField id="cl-stockstatus" name="stockStatus" allowNone={false} defaultValue={fieldValue(state, "stockStatus", "UNKNOWN") || "UNKNOWN"} options={toOptions(STOCK_STATUS_LABEL)} />
            </Field>
          </div>
        </details>
      </section>

      <section className="space-y-2">
        <h3 className={SECTION}>On this quotation</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity for the customer" htmlFor="cl-qty" error={err("quantity")} required>
            <Input id="cl-qty" name="quantity" inputMode="numeric" defaultValue={fieldValue(state, "quantity", "1")} aria-invalid={Boolean(err("quantity"))} />
          </Field>
          <Field label="Markup % (optional)" htmlFor="cl-markup" error={err("markupPercent")}>
            <Input id="cl-markup" name="markupPercent" inputMode="decimal" placeholder="e.g. 15" defaultValue={fieldValue(state, "markupPercent")} aria-invalid={Boolean(err("markupPercent"))} />
          </Field>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-popover px-4 py-3">
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Recording...">Record confirmation and add line</SubmitButton>
      </div>
    </form>
  );
}
