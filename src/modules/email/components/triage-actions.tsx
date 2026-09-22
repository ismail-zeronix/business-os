"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createEnquiryFromEmailAction, dismissEmailAction, restoreEmailAction } from "../actions";

/** Creates an enquiry from the email and opens it. A person's decision: nothing is ever created automatically. */
export function CreateEnquiryFromEmailButton({ emailId }: { emailId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(createEnquiryFromEmailAction, null);
  useActionFeedback(state, (data) => router.push(`/enquiries/${data.id}`));
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={emailId} />
      <SubmitButton size="sm" pendingLabel="Creating...">
        Create enquiry
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Dismiss an email that is not an enquiry. A reason is required; it stays in the record and can be restored. */
export function DismissEmailControl({ emailId }: { emailId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(dismissEmailAction, null);
  useActionFeedback(state, () => setOpen(false));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Dismiss
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <p className="text-xs text-muted-foreground">This is not an enquiry. The email is kept and can be restored later.</p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="id" value={emailId} />
          <Input name="reason" placeholder="Why? (e.g. newsletter, spam, supplier)" aria-label="Reason" required />
          <FormMessage state={state} />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingLabel="Dismissing...">
              Dismiss email
            </SubmitButton>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function RestoreEmailButton({ emailId }: { emailId: string }) {
  const [state, formAction] = useActionState(restoreEmailAction, null);
  useActionFeedback(state);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={emailId} />
      <SubmitButton size="sm" variant="outline" pendingLabel="Restoring...">
        Restore to queue
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
