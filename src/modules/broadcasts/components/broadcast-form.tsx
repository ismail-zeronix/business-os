"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { Combobox } from "@/components/forms/combobox";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import type { SelectOption } from "@/components/forms/multi-select";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, fieldValue, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EVIDENCE_CHANNEL_LABEL, toOptions } from "@/lib/labels";
import { createBroadcastAction } from "../actions";
import { matchExactlyOne, readHeaderNames } from "../parsing/header-lines";
import { BROADCAST_ENTRY_CHANNELS } from "../schemas";
import { MentionTextarea, type MentionContact } from "./mention-textarea";
import { Alert } from "@/components/ui/alert";

type ContactOption = MentionContact;
/** A supplier for the picker; `legalName` lets "SUPPLIER : FIRST OPTION GENERAL TRADING LLC" find the supplier saved under a short name. */
type SupplierOption = SelectOption & { legalName?: string | null };

/**
 * Paste a supplier message. The raw text is stored exactly as pasted (immutable evidence) and items are then proposed for review.
 * If the same supplier already has this exact wording, the user is warned and may save anyway.
 */
export function BroadcastForm({
  suppliers,
  contacts,
  categoryOptions,
  defaultSupplierId,
  defaultReceivedAt,
  request,
}: {
  suppliers: SupplierOption[];
  contacts: ContactOption[];
  categoryOptions: SelectOption[];
  defaultSupplierId: string | null;
  defaultReceivedAt: string;
  /** When set, this message is the reply to a sourcing request and is linked to it on save. */
  request?: { id: string; enquiryId: string; enquiryRef: string } | null;
}) {
  const router = useRouter();
  // Supplier, contact and the message text are linked. The text can set the two fields (a "SUPPLIER :" / "CONTACT :" line that names exactly
  // one record, or an @ mention); they still work by hand. `...Auto` = read from the message, so a new message may replace it; a choice made by
  // hand is never replaced.
  const [supplierId, setSupplierId] = useState<string | null>(defaultSupplierId);
  const [contactId, setContactId] = useState<string | null>(null);
  const [supplierAuto, setSupplierAuto] = useState(false);
  const [contactAuto, setContactAuto] = useState(false);
  const [rawText, setRawText] = useState("");
  const [state, formAction] = useActionState(createBroadcastAction, null);
  useActionFeedback(state, (data) => router.push(`/broadcasts/${data.id}`));

  const err = (name: string) => fieldError(state, name);
  const contactOptions = contacts.filter((c) => c.supplierId === supplierId);
  const supplierName = suppliers.find((s) => s.value === supplierId)?.label ?? null;
  const contactOf = (id: string | null) => (id ? contacts.find((c) => c.value === id) : undefined);

  /** A contact belongs to one supplier, so changing the supplier drops a contact of another one. */
  function applySupplier(next: string | null, auto: boolean) {
    setSupplierId(next);
    setSupplierAuto(auto);
    if (contactOf(contactId)?.supplierId !== next) {
      setContactId(null);
      setContactAuto(false);
    }
  }
  function applyContact(next: string | null, auto: boolean) {
    setContactId(next);
    setContactAuto(auto);
  }

  /** Typing or pasting: keep the text, and pick the supplier / contact the message names when exactly one record has that name. */
  function changeText(text: string) {
    setRawText(text);
    if (request) return; // a reply stays with the supplier the request was sent to
    const named = readHeaderNames(text);
    let supplier = supplierId;
    if (named.supplier && (supplier === null || supplierAuto)) {
      const match = matchExactlyOne(named.supplier, suppliers, (s) => [s.label, s.legalName]);
      if (match.kind === "one" && match.item.value !== supplier) {
        applySupplier(match.item.value, true);
        supplier = match.item.value;
      }
    }
    if (named.contact && supplier && (contactId === null || contactAuto || supplier !== supplierId)) {
      const match = matchExactlyOne(named.contact, contacts.filter((c) => c.supplierId === supplier), (c) => [c.name]);
      if (match.kind === "one" && (match.item.value !== contactId || supplier !== supplierId)) applyContact(match.item.value, true);
    }
  }

  // What the message says, next to what is selected: a short note when it was read, a warning when it does not fit. Nothing is guessed.
  const named = request ? null : readHeaderNames(rawText);
  const supplierMatch = named?.supplier ? matchExactlyOne(named.supplier, suppliers, (s) => [s.label, s.legalName]) : null;
  const contactMatch = named?.contact && supplierId ? matchExactlyOne(named.contact, contacts.filter((c) => c.supplierId === supplierId), (c) => [c.name]) : null;
  const readFromMessage = [supplierAuto && supplierName ? `supplier ${supplierName}` : null, contactAuto && contactOf(contactId) ? `contact ${contactOf(contactId)?.name}` : null].filter(Boolean);
  const warnings: string[] = [];
  if (named?.supplier && supplierMatch) {
    if (supplierMatch.kind === "none") warnings.push(`The message says SUPPLIER : ${named.supplier}, but no supplier has exactly that name. Pick one, or add it under Suppliers.`);
    else if (supplierMatch.kind === "many") warnings.push(`The message says SUPPLIER : ${named.supplier}, but more than one supplier has that name. Pick one.`);
    else if (supplierId && supplierMatch.item.value !== supplierId) warnings.push(`The message names ${supplierMatch.item.label} as the supplier, but ${supplierName} is selected.`);
  }
  if (named?.contact && contactMatch) {
    if (contactMatch.kind === "none") warnings.push(`The message says CONTACT : ${named.contact}, but ${supplierName} has no contact with exactly that name.`);
    else if (contactMatch.kind === "many") warnings.push(`The message says CONTACT : ${named.contact}, but ${supplierName} has more than one contact with that name. Pick one.`);
    else if (contactId && contactMatch.item.value !== contactId) warnings.push(`The message names ${contactMatch.item.name} as the contact, but ${contactOf(contactId)?.name} is selected.`);
  }
  const duplicateOf = state && !state.ok ? state.fieldErrors?._duplicate : undefined;

  return (
    <form action={formAction} className="max-w-3xl space-y-4" noValidate>
      <FormMessage state={state} />

      {request ? (
        <>
          <input type="hidden" name="supplierRequestId" value={request.id} />
          <Alert variant="info" className="px-3 py-2 text-xs">
            This is the reply to the request on <span className="font-medium">{request.enquiryRef}</span>. Keep the supplier as it is; the reply is linked to that request when you save.
          </Alert>
        </>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Supplier" htmlFor="bf-supplier" required error={err("supplierId")}>
          <Combobox id="bf-supplier" name="supplierId" options={suppliers} value={supplierId} placeholder="Select a supplier" onValueChange={(next) => applySupplier(next, false)} />
        </Field>
        <Field label="Contact (optional)" htmlFor="bf-contact" error={err("contactId")}>
          <Combobox
            id="bf-contact"
            name="contactId"
            options={contactOptions}
            value={contactId}
            onValueChange={(next) => applyContact(next, false)}
            placeholder={supplierId ? (contactOptions.length ? "Select a contact" : "No contacts for this supplier") : "Choose a supplier first"}
            disabled={!supplierId || contactOptions.length === 0}
            clearable
          />
        </Field>
        <Field label="Received via" htmlFor="bf-channel" error={err("channel")}>
          <SelectField
            id="bf-channel"
            name="channel"
            allowNone={false}
            defaultValue={fieldValue(state, "channel", "MANUAL_PASTE")}
            options={toOptions(EVIDENCE_CHANNEL_LABEL, BROADCAST_ENTRY_CHANNELS)}
          />
        </Field>
        <Field label="Received at (Dubai time)" htmlFor="bf-receivedAt" required error={err("receivedAt")} hint="When the supplier sent it. Freshness is measured from this time.">
          <Input id="bf-receivedAt" name="receivedAt" type="datetime-local" defaultValue={fieldValue(state, "receivedAt", defaultReceivedAt)} aria-invalid={Boolean(err("receivedAt"))} />
        </Field>
        <Field label="Category (optional)" htmlFor="bf-category" error={err("categoryId")} hint="Only applied to items the parser can't classify from the text itself.">
          <Combobox id="bf-category" name="categoryId" options={categoryOptions} defaultValue={fieldValue(state, "categoryId", null)} placeholder="No hint" clearable />
        </Field>
      </div>

      {readFromMessage.length > 0 || warnings.length > 0 ? (
        <div role="status" className="space-y-0.5 text-xs">
          {readFromMessage.length > 0 ? <p className="text-muted-foreground">Read from the message: {readFromMessage.join(", ")}.</p> : null}
          {warnings.map((warning) => (
            <p key={warning} className="text-warning">
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      <Field
        label="Supplier message"
        htmlFor="bf-rawText"
        required
        error={err("rawText")}
        hint='Paste it exactly as received. The original is preserved and can always be opened later. A "SUPPLIER :" or "CONTACT :" line picks that supplier or contact when exactly one has that name; or type @ after it to choose from a list.'
      >
        <MentionTextarea
          id="bf-rawText"
          name="rawText"
          rows={16}
          value={rawText}
          onChange={changeText}
          suppliers={suppliers}
          contacts={contacts}
          supplierId={supplierId}
          supplierName={supplierName}
          onPickSupplier={(id) => applySupplier(id, false)}
          onPickContact={(id) => applyContact(id, false)}
          className="font-mono text-xs"
          aria-invalid={Boolean(err("rawText"))}
          autoFocus
        />
      </Field>

      <Field label="Notes (optional)" htmlFor="bf-notes" error={err("notes")}>
        <Input id="bf-notes" name="notes" defaultValue={fieldValue(state, "notes")} />
      </Field>

      {duplicateOf ? (
        <Alert variant="warning" className="flex items-center gap-2 px-3 py-2">
          <Checkbox id="bf-allowDuplicate" name="allowDuplicate" />
          <Label htmlFor="bf-allowDuplicate" className="text-xs font-normal text-warning">
            Save anyway.{" "}
            <Link href={`/broadcasts/${duplicateOf}`} className="underline">
              Open the existing broadcast
            </Link>
          </Label>
        </Alert>
      ) : null}

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button asChild variant="outline">
          <Link href={request ? `/enquiries/${request.enquiryId}?view=sourcing` : "/broadcasts"}>Cancel</Link>
        </Button>
        <SubmitButton pendingLabel="Saving...">Save and extract items</SubmitButton>
      </div>
    </form>
  );
}
