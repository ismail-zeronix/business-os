"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { testSmtpAccountAction } from "../smtp.actions";

/** Sends one short test message to an address you type. Nothing else is sent. */
export function SmtpTestButton({ id, defaultTo }: { id: string; defaultTo: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(testSmtpAccountAction, null);
  useActionFeedback(state, () => setOpen(false));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs">
          Send test email
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <p className="text-xs text-muted-foreground">Sends a short test message from this account to the address below.</p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="id" value={id} />
          <Input name="to" type="email" defaultValue={defaultTo} aria-label="Send the test to" />
          <FormMessage state={state} />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingLabel="Sending...">
              Send test
            </SubmitButton>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
