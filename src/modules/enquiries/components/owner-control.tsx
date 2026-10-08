"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import type { SelectOption } from "@/components/forms/multi-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { reassignEnquiryOwnerAction } from "../actions";

/**
 * Who this enquiry is assigned to - attribution only (KPI reporting, "assigned to me" filtering). Unlike `CustomerOwnerControl`,
 * this never restricts who can see or work the enquiry itself: everyone keeps full visibility for sourcing. ADMIN only.
 * Saving this can still change real visibility one step removed: it auto-syncs the linked Customer's owner when that customer
 * is currently unowned (service.ts's `reassignEnquiryOwner`), and Customer.ownerId IS a hard Sales-screen visibility boundary -
 * the popover copy below says so explicitly.
 */
export function EnquiryOwnerControl({
  enquiryId,
  ownerId,
  ownerName,
  users,
  disabled,
}: {
  enquiryId: string;
  ownerId: string | null;
  ownerName: string | null;
  users: SelectOption[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(reassignEnquiryOwnerAction, null);
  useActionFeedback(state, () => setOpen(false));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} title={disabled ? "Restore the enquiry to reassign it" : undefined}>
          Owner: {ownerName ?? "Unassigned"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-xs text-muted-foreground">
          Who this enquiry is assigned to, for sales reporting. It never hides the enquiry from anyone else - everyone keeps full visibility for sourcing. If this enquiry&apos;s customer has no owner yet, they
          become this person&apos;s customer too - only they and admins will then see that customer and its quotes/invoices on the Sales screens.
        </p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="id" value={enquiryId} />
          <SelectField name="assignedToId" noneLabel="Unassigned" defaultValue={ownerId} options={users} />
          <FormMessage state={state} />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingLabel="Saving...">
              Save
            </SubmitButton>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
