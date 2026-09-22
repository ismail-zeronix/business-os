"use client";

import { useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { removeSupplierRequestAction, reopenRequestAction, setRequestOutcomeAction } from "../actions";
import { useRequestAction } from "./use-request-action";

/** Remove a request that has not been sent. */
export function RemoveRequestButton({ id }: { id: string }) {
  const [state, formAction] = useRequestAction(removeSupplierRequestAction);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="ghost" size="xs" pendingLabel="Removing...">
        Remove
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Back to Sent (or Draft) after No stock / Declined. */
export function ReopenRequestButton({ id }: { id: string }) {
  const [state, formAction] = useRequestAction(reopenRequestAction);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="ghost" size="xs" pendingLabel="Reopening...">
        Reopen
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** "No stock" or "Declined", with an optional note. Creates no observation: to keep what they said, record the reply. */
export function OutcomeButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useRequestAction(setRequestOutcomeAction, () => setOpen(false));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="xs">
          No stock / Declined
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-xs text-muted-foreground">Nothing is recorded as evidence. If they replied with text worth keeping, use Record reply instead.</p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="id" value={id} />
          <SelectField
            name="status"
            allowNone={false}
            defaultValue="NO_STOCK"
            options={[
              { value: "NO_STOCK", label: "No stock" },
              { value: "DECLINED", label: "Declined" },
            ]}
          />
          <Input name="note" placeholder="Note (optional)" aria-label="Note" />
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
