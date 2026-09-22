"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { archiveEnquiryAction, ignoreEnquiryItemAction, reopenEnquiryItemAction } from "../actions";

/** Ignore a requirement that is not relevant (small popover with an optional reason; nothing is deleted). */
export function IgnoreControl({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(ignoreEnquiryItemAction, null);
  useActionFeedback(state, () => setOpen(false));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          Ignore requirement
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <p className="text-xs text-muted-foreground">Mark this line as not relevant. It stays in the record and can be reopened.</p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="id" value={itemId} />
          <Input name="reason" placeholder="Reason (optional)" aria-label="Reason" />
          <FormMessage state={state} />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingLabel="Ignoring...">
              Ignore
            </SubmitButton>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Reopen a confirmed or ignored requirement. It only returns to review: nothing else depends on it. */
export function ReopenControl({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(reopenEnquiryItemAction, null);
  useActionFeedback(state, () => setOpen(false));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Reopen
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <p className="text-xs text-muted-foreground">This puts the requirement back into review. Nothing else changes.</p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="id" value={itemId} />
          <Input name="reason" placeholder="Reason (optional)" aria-label="Reason" />
          <FormMessage state={state} />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingLabel="Reopening...">
              Reopen requirement
            </SubmitButton>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Archive or restore a whole enquiry. Its evidence and requirements stay; it is only hidden from the working lists. */
export function ArchiveEnquiryControl({ enquiryId, archived }: { enquiryId: string; archived: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(archiveEnquiryAction, null);
  useActionFeedback(state, () => setOpen(false));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {archived ? "Restore" : "Archive"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <p className="text-xs text-muted-foreground">
          {archived ? "Bring this enquiry back into the working lists." : "Hide this enquiry from the working lists. The original request and its requirements are kept."}
        </p>
        <FormMessage state={state} />
        <form action={formAction} className="flex justify-end">
          <input type="hidden" name="id" value={enquiryId} />
          {archived ? null : <input type="hidden" name="archived" value="on" />}
          <SubmitButton size="sm" pendingLabel="Saving...">
            {archived ? "Restore enquiry" : "Archive enquiry"}
          </SubmitButton>
        </form>
      </PopoverContent>
    </Popover>
  );
}
