"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import type { SelectOption } from "@/components/forms/multi-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { assignTaskAction, cancelTaskAction, completeTaskAction, reopenTaskAction } from "../actions";

/**
 * Who is working this task. An ADMIN may assign anyone; a non-admin only ever gets to choose themselves or
 * Unassigned here (enforced again, authoritatively, in the service) - "Assign to me" is the one-click shortcut
 * every role gets, since claiming or releasing a task is always allowed.
 */
export function AssignTaskControl({ taskId, assignedToId, assignedToName, currentUserId, isAdmin, users }: { taskId: string; assignedToId: string | null; assignedToName: string | null; currentUserId: string; isAdmin: boolean; users: SelectOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(assignTaskAction, null);
  useActionFeedback(state, () => setOpen(false));
  const options = isAdmin ? users : users.filter((u) => u.value === currentUserId);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            {assignedToName ? `Assigned: ${assignedToName}` : "Unassigned"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 space-y-3">
          <p className="text-xs text-muted-foreground">{isAdmin ? "Visible to everyone; never hides the task." : "You can claim this task or release it back to unassigned."}</p>
          <form action={formAction} className="space-y-2">
            <input type="hidden" name="id" value={taskId} />
            <SelectField name="assignedToId" noneLabel="Unassigned" defaultValue={assignedToId} options={options} />
            <FormMessage state={state} />
            <div className="flex justify-end">
              <SubmitButton size="sm" pendingLabel="Saving...">
                Save
              </SubmitButton>
            </div>
          </form>
        </PopoverContent>
      </Popover>
      {assignedToId !== currentUserId ? (
        <form action={formAction}>
          <input type="hidden" name="id" value={taskId} />
          <input type="hidden" name="assignedToId" value={currentUserId} />
          <SubmitButton size="sm" variant="ghost" pendingLabel="Assigning...">
            Assign to me
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

export function CompleteTaskButton({ taskId }: { taskId: string }) {
  const [state, formAction] = useActionState(completeTaskAction, null);
  useActionFeedback(state);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={taskId} />
      <SubmitButton size="sm" pendingLabel="Completing...">
        Complete
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function ReopenTaskButton({ taskId }: { taskId: string }) {
  const [state, formAction] = useActionState(reopenTaskAction, null);
  useActionFeedback(state);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={taskId} />
      <SubmitButton size="sm" variant="outline" pendingLabel="Reopening...">
        Reopen
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** A reason is required; it stays on the record (shown in the detail view) and can be reopened later. */
export function CancelTaskControl({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(cancelTaskAction, null);
  useActionFeedback(state, () => setOpen(false));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Cancel
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <p className="text-xs text-muted-foreground">The task is kept and can be reopened later.</p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="id" value={taskId} />
          <Input name="reason" placeholder="Why is this cancelled?" aria-label="Reason" required />
          <FormMessage state={state} />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingLabel="Cancelling...">
              Cancel task
            </SubmitButton>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
