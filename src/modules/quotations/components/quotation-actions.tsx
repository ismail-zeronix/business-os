"use client";

import { FilePlus2, FileCheck2, GitBranchPlus } from "lucide-react";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createQuotationAction, issueQuotationAction, reviseQuotationAction } from "../actions";

/**
 * A button that asks before it acts: a small popover says what will happen, then a second click does it. A failure (an incomplete
 * quotation, a draft that already exists) stays in the popover as text. Creating and revising move the person to the new draft.
 */
function ConfirmAction({
  action,
  id,
  idName,
  label,
  icon,
  description,
  submitLabel,
  pendingLabel,
  variant = "outline",
  disabled,
  disabledTitle,
}: {
  action: typeof createQuotationAction;
  id: string;
  idName: "enquiryId" | "id";
  label: string;
  icon: React.ReactNode;
  description: string;
  submitLabel: string;
  pendingLabel: string;
  variant?: "outline" | "default";
  disabled?: boolean;
  disabledTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, null);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant} size="sm" disabled={disabled} title={disabled ? disabledTitle : undefined}>
          {icon} {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <p className="text-xs text-muted-foreground">{description}</p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name={idName} value={id} />
          <FormMessage state={state} />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingLabel={pendingLabel}>
              {submitLabel}
            </SubmitButton>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function CreateQuotationButton({ enquiryId, disabled, disabledTitle }: { enquiryId: string; disabled?: boolean; disabledTitle?: string }) {
  return (
    <ConfirmAction
      action={createQuotationAction}
      id={enquiryId}
      idName="enquiryId"
      label="Create quotation"
      icon={<FilePlus2 aria-hidden />}
      description="Makes a draft with one line per confirmed requirement, using the chosen supplier's price as the cost. Nothing is sent to the customer."
      submitLabel="Create draft"
      pendingLabel="Creating..."
      disabled={disabled}
      disabledTitle={disabledTitle}
    />
  );
}

export function IssueQuotationButton({ id }: { id: string }) {
  return (
    <ConfirmAction
      action={issueQuotationAction}
      id={id}
      idName="id"
      label="Issue"
      icon={<FileCheck2 aria-hidden />}
      description="Checks the quotation is complete, then freezes it exactly as it is now. To change it afterwards you make a new revision. Nothing is sent."
      submitLabel="Issue quotation"
      pendingLabel="Issuing..."
      variant="default"
    />
  );
}

export function ReviseQuotationButton({ id }: { id: string }) {
  return (
    <ConfirmAction
      action={reviseQuotationAction}
      id={id}
      idName="id"
      label="Revise"
      icon={<GitBranchPlus aria-hidden />}
      description="Makes a new draft revision with the same lines and prices. This issued quotation stays exactly as the customer received it and is marked Superseded."
      submitLabel="Create revision"
      pendingLabel="Creating..."
    />
  );
}
