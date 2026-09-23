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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EVIDENCE_CHANNEL_LABEL, toOptions } from "@/lib/labels";
import { createEnquiryAction } from "../actions";
import { ENQUIRY_ENTRY_CHANNELS } from "../schemas";

type ContactOption = SelectOption & { customerId: string };

/**
 * Paste a customer request. The raw text is stored exactly as pasted (immutable evidence) and requirements are then proposed for review.
 * The customer is optional: an unknown sender can be saved as a requester and promoted to a customer later.
 */
export function EnquiryForm({
  customers,
  contacts,
  defaultCustomerId,
  defaultReceivedAt,
}: {
  customers: SelectOption[];
  contacts: ContactOption[];
  defaultCustomerId: string | null;
  defaultReceivedAt: string;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string | null>(defaultCustomerId);
  const [state, formAction] = useActionState(createEnquiryAction, null);
  useActionFeedback(state, (data) => router.push(`/enquiries/${data.id}`));

  const err = (name: string) => fieldError(state, name);
  const contactOptions = contacts.filter((c) => c.customerId === customerId);

  return (
    <form action={formAction} className="max-w-3xl space-y-4" noValidate>
      <FormMessage state={state} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Customer (optional)" htmlFor="ef-customer" error={err("customerId")} hint={customers.length === 0 ? "No customers yet. You can add one later from the enquiry." : undefined}>
          <Combobox id="ef-customer" name="customerId" options={customers} defaultValue={fieldValue(state, "customerId", defaultCustomerId) || null} placeholder="Select a customer" onValueChange={setCustomerId} clearable />
        </Field>
        <Field label="Contact (optional)" htmlFor="ef-contact" error={err("contactId")}>
          <Combobox
            key={customerId ?? "none"}
            id="ef-contact"
            name="contactId"
            options={contactOptions}
            placeholder={customerId ? (contactOptions.length ? "Select a contact" : "No contacts for this customer") : "Choose a customer first"}
            disabled={!customerId || contactOptions.length === 0}
            clearable
          />
        </Field>

        {!customerId ? (
          <>
            <Field label="Requester name (optional)" htmlFor="ef-requesterName" error={err("requesterName")} hint="Who sent it, if you do not have them as a customer yet.">
              <Input id="ef-requesterName" name="requesterName" defaultValue={fieldValue(state, "requesterName")} />
            </Field>
            <Field label="Requester email (optional)" htmlFor="ef-requesterEmail" error={err("requesterEmail")}>
              <Input id="ef-requesterEmail" name="requesterEmail" type="email" defaultValue={fieldValue(state, "requesterEmail")} aria-invalid={Boolean(err("requesterEmail"))} />
            </Field>
          </>
        ) : null}

        <Field label="Received via" htmlFor="ef-channel" error={err("channel")}>
          <SelectField
            id="ef-channel"
            name="channel"
            allowNone={false}
            defaultValue={fieldValue(state, "channel", "MANUAL_PASTE")}
            options={toOptions(EVIDENCE_CHANNEL_LABEL, ENQUIRY_ENTRY_CHANNELS)}
          />
        </Field>
        <Field label="Received at (Dubai time)" htmlFor="ef-receivedAt" required error={err("receivedAt")} hint="When the customer sent it. Age is measured from this time.">
          <Input id="ef-receivedAt" name="receivedAt" type="datetime-local" defaultValue={fieldValue(state, "receivedAt", defaultReceivedAt)} aria-invalid={Boolean(err("receivedAt"))} />
        </Field>
      </div>

      <Field label="Customer request" htmlFor="ef-rawText" required error={err("rawText")} hint="Paste it exactly as received. The original is preserved and can always be opened later.">
        <Textarea
          id="ef-rawText"
          name="rawText"
          rows={14}
          defaultValue={fieldValue(state, "rawText")}
          className="font-mono text-xs"
          placeholder="Need 200 Dell Latitude 5440 16GB 512GB Windows Pro, delivery Dubai, urgent"
          aria-invalid={Boolean(err("rawText"))}
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Subject (optional)" htmlFor="ef-subject" error={err("subject")}>
          <Input id="ef-subject" name="subject" defaultValue={fieldValue(state, "subject")} />
        </Field>
        <Field label="Notes (optional)" htmlFor="ef-notes" error={err("notes")}>
          <Input id="ef-notes" name="notes" defaultValue={fieldValue(state, "notes")} />
        </Field>
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button asChild variant="outline">
          <Link href="/enquiries">Cancel</Link>
        </Button>
        <SubmitButton pendingLabel="Saving...">Save and review</SubmitButton>
      </div>
    </form>
  );
}
