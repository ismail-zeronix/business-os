"use client";

import { FileCheck2, FilePlus2 } from "lucide-react";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cancelInvoiceAction, createInvoiceFromQuotationAction, issueInvoiceAction, markInvoicePaidAction } from "../actions";

/** A button that asks before it acts: a small popover says what will happen, then a second click does it. */
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
}: {
  action: typeof issueInvoiceAction;
  id: string;
  idName: "id" | "quotationId";
  label: string;
  icon?: React.ReactNode;
  description: string;
  submitLabel: string;
  pendingLabel: string;
  variant?: "outline" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, null);
  useActionFeedback(state, () => setOpen(false));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant} size="sm">
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

/** Shown on an ISSUED quotation with no invoice yet. Sends the person to the new invoice - arriving there is the feedback. */
export function ConvertToInvoiceButton({ quotationId }: { quotationId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(createInvoiceFromQuotationAction, null);
  useActionFeedback(state, (data) => router.push(`/invoices/${data.id}`));
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="quotationId" value={quotationId} />
      <SubmitButton size="sm" pendingLabel="Creating...">
        <FilePlus2 aria-hidden /> Convert to invoice
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function IssueInvoiceButton({ id }: { id: string }) {
  return (
    <ConfirmAction
      action={issueInvoiceAction}
      id={id}
      idName="id"
      label="Issue"
      icon={<FileCheck2 aria-hidden />}
      description="Marks this invoice as issued to the customer."
      submitLabel="Issue invoice"
      pendingLabel="Issuing..."
      variant="default"
    />
  );
}

export function MarkInvoicePaidButton({ id }: { id: string }) {
  return (
    <ConfirmAction action={markInvoicePaidAction} id={id} idName="id" label="Mark paid" description="Records that payment has been received for this invoice." submitLabel="Mark paid" pendingLabel="Saving..." />
  );
}

/** A reason is required; it is kept on the invoice. A cancelled invoice stays visible, just no longer payable. */
export function CancelInvoiceControl({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(cancelInvoiceAction, null);
  useActionFeedback(state, () => setOpen(false));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Cancel
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <p className="text-xs text-muted-foreground">This invoice is kept, just no longer payable.</p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="id" value={id} />
          <Input name="reason" placeholder="Why? (e.g. quotation withdrawn, duplicate)" aria-label="Reason" required />
          <FormMessage state={state} />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingLabel="Cancelling...">
              Cancel invoice
            </SubmitButton>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
