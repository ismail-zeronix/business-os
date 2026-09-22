"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import type { ActionResult } from "@/core/validation/action-result";
import type { RecordStatus } from "@/generated/prisma/enums";
import { RECORD_STATUS_LABEL } from "@/lib/labels";

type StatusAction = (prev: ActionResult<{ id: string }> | null, formData: FormData) => Promise<ActionResult<{ id: string }>>;

const CHOICES: Record<RecordStatus, { to: RecordStatus; label: string; danger?: boolean }[]> = {
  ACTIVE: [
    { to: "INACTIVE", label: "Mark inactive" },
    { to: "ARCHIVED", label: "Archive", danger: true },
  ],
  INACTIVE: [
    { to: "ACTIVE", label: "Mark active" },
    { to: "ARCHIVED", label: "Archive", danger: true },
  ],
  ARCHIVED: [{ to: "ACTIVE", label: "Restore" }],
};

/**
 * Change a record's status through a small confirm popover (never a full modal). Nothing is ever deleted: archived records keep their
 * history and are simply hidden from lists and pickers. The same control serves suppliers, contacts, brands, categories and products.
 */
export function RecordStatusControl({
  id,
  status,
  action,
  entityLabel,
  triggerLabel,
  size = "sm",
}: {
  id: string;
  status: RecordStatus;
  action: StatusAction;
  entityLabel: string;
  triggerLabel?: string;
  size?: "xs" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, null);
  useActionFeedback(state, () => setOpen(false));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size={size}>
          {triggerLabel ?? RECORD_STATUS_LABEL[status]}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {entityLabel} is {RECORD_STATUS_LABEL[status].toLowerCase()}
          </p>
          <p className="text-xs text-muted-foreground">Nothing is deleted. Archived records keep their history and are hidden from lists and pickers.</p>
        </div>
        <FormMessage state={state} />
        <div className="flex flex-wrap gap-2">
          {CHOICES[status].map((choice) => (
            <form key={choice.to} action={formAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value={choice.to} />
              <SubmitButton size="sm" variant={choice.danger ? "outline" : "default"} className={choice.danger ? "text-danger" : undefined}>
                {choice.label}
              </SubmitButton>
            </form>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
