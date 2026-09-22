"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { EnquiryStatus } from "@/generated/prisma/enums";
import { ENQUIRY_STATUS_LABEL, ENQUIRY_STATUS_ORDER } from "@/lib/labels";
import { setEnquiryStatusAction } from "../actions";

/** Change the operational status through a small popover. States are set by people; nothing changes them automatically. */
export function EnquiryStatusControl({ enquiryId, status }: { enquiryId: string; status: EnquiryStatus }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(setEnquiryStatusAction, null);
  useActionFeedback(state, () => setOpen(false));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Status: {ENQUIRY_STATUS_LABEL[status]}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-xs text-muted-foreground">Where is this enquiry now? The change is recorded in the timeline.</p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="id" value={enquiryId} />
          <SelectField name="status" allowNone={false} defaultValue={status} options={ENQUIRY_STATUS_ORDER.map((value) => ({ value, label: ENQUIRY_STATUS_LABEL[value] }))} />
          <Input name="note" placeholder="Note (optional)" aria-label="Note" />
          <FormMessage state={state} />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingLabel="Saving...">
              Update status
            </SubmitButton>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
