"use client";

import { useActionState, useState } from "react";
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
import { ENQUIRY_PRIORITY_LABEL, toOptions } from "@/lib/labels";
import { updateEnquiryHeaderAction } from "../actions";

type ContactOption = SelectOption & { customerId: string };

export type EnquiryHeaderInitial = {
  id: string;
  customerId: string | null;
  contactId: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  subject: string | null;
  priority: string;
  /** yyyy-mm-dd */
  requiredBy: string | null;
  deliveryLocation: string | null;
  blocker: string | null;
  nextAction: string | null;
  assignedToId: string | null;
  notes: string | null;
};

/**
 * Edits the operational fields of an enquiry: who, how urgent, by when, delivery, what is blocking it and what happens next.
 * The requester fields are always submitted so that saving never silently erases who wrote in.
 */
export function EnquiryHeaderForm({ enquiry, customers, contacts, owners }: { enquiry: EnquiryHeaderInitial; customers: SelectOption[]; contacts: ContactOption[]; owners: SelectOption[] }) {
  const close = useDrawerClose();
  const [customerId, setCustomerId] = useState<string | null>(enquiry.customerId);
  const [state, formAction] = useActionState(updateEnquiryHeaderAction, null);
  useActionFeedback(state, () => close());

  const text = (name: keyof EnquiryHeaderInitial) => fieldValue(state, name, enquiry[name]);
  const err = (name: string) => fieldError(state, name);
  const contactOptions = contacts.filter((c) => c.customerId === customerId);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={enquiry.id} />
      <FormMessage state={state} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Customer" htmlFor="ehf-customer" error={err("customerId")}>
          <Combobox id="ehf-customer" name="customerId" options={customers} defaultValue={fieldValue(state, "customerId", enquiry.customerId) || null} placeholder="No customer" onValueChange={setCustomerId} clearable />
        </Field>
        <Field label="Contact" htmlFor="ehf-contact" error={err("contactId")}>
          <Combobox
            key={customerId ?? "none"}
            id="ehf-contact"
            name="contactId"
            options={contactOptions}
            defaultValue={customerId === enquiry.customerId ? enquiry.contactId : null}
            placeholder={customerId ? (contactOptions.length ? "Select a contact" : "No contacts for this customer") : "Choose a customer first"}
            disabled={!customerId || contactOptions.length === 0}
            clearable
          />
        </Field>
        <Field label="Requester name" htmlFor="ehf-requesterName" error={err("requesterName")}>
          <Input id="ehf-requesterName" name="requesterName" defaultValue={text("requesterName")} />
        </Field>
        <Field label="Requester email" htmlFor="ehf-requesterEmail" error={err("requesterEmail")}>
          <Input id="ehf-requesterEmail" name="requesterEmail" type="email" defaultValue={text("requesterEmail")} aria-invalid={Boolean(err("requesterEmail"))} />
        </Field>
        <Field label="Subject" htmlFor="ehf-subject" error={err("subject")} className="col-span-2">
          <Input id="ehf-subject" name="subject" defaultValue={text("subject")} />
        </Field>
        <Field label="Priority" htmlFor="ehf-priority" error={err("priority")}>
          <SelectField id="ehf-priority" name="priority" allowNone={false} defaultValue={fieldValue(state, "priority", enquiry.priority) || "NORMAL"} options={toOptions(ENQUIRY_PRIORITY_LABEL, ["LOW", "NORMAL", "HIGH", "URGENT"])} />
        </Field>
        <Field label="Required by" htmlFor="ehf-requiredBy" error={err("requiredBy")}>
          <Input id="ehf-requiredBy" name="requiredBy" type="date" defaultValue={text("requiredBy")} aria-invalid={Boolean(err("requiredBy"))} />
        </Field>
        <Field label="Delivery location" htmlFor="ehf-delivery" error={err("deliveryLocation")}>
          <Input id="ehf-delivery" name="deliveryLocation" defaultValue={text("deliveryLocation")} />
        </Field>
        <Field label="Owner" htmlFor="ehf-owner" error={err("assignedToId")}>
          <SelectField id="ehf-owner" name="assignedToId" noneLabel="Unassigned" defaultValue={fieldValue(state, "assignedToId", enquiry.assignedToId) || null} options={owners} />
        </Field>
        <Field label="Blocker" htmlFor="ehf-blocker" error={err("blocker")} hint="What is stopping a response right now?" className="col-span-2">
          <Input id="ehf-blocker" name="blocker" defaultValue={text("blocker")} />
        </Field>
        <Field label="Next action" htmlFor="ehf-nextAction" error={err("nextAction")} className="col-span-2">
          <Input id="ehf-nextAction" name="nextAction" defaultValue={text("nextAction")} />
        </Field>
        <Field label="Notes" htmlFor="ehf-notes" error={err("notes")} className="col-span-2">
          <Textarea id="ehf-notes" name="notes" rows={3} defaultValue={text("notes")} />
        </Field>
      </div>

      <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-popover px-4 py-3">
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Saving...">Save changes</SubmitButton>
      </div>
    </form>
  );
}
