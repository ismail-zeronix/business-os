"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import type { SelectOption } from "@/components/forms/multi-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { reassignCustomerOwnerAction } from "../actions";

/**
 * Who can see this customer (and its quotes/invoices) on the Sales screens: the owner, or everyone while unowned. ADMIN
 * only - unlike Enquiry's advisory `assignedToId`, this is a real access-control boundary, not just a label.
 */
export function CustomerOwnerControl({ customerId, ownerId, ownerName, users }: { customerId: string; ownerId: string | null; ownerName: string | null; users: SelectOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(reassignCustomerOwnerAction, null);
  useActionFeedback(state, () => setOpen(false));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Owner: {ownerName ?? "Shared"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-xs text-muted-foreground">Only the owner (and admins) see this customer and its quotes/invoices on the Sales screens. &quot;Shared&quot; means every staff member can.</p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="id" value={customerId} />
          <SelectField name="ownerId" noneLabel="Shared (everyone)" defaultValue={ownerId} options={users} />
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
