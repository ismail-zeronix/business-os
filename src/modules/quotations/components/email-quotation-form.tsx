"use client";

import { FileText, Paperclip } from "lucide-react";
import { useActionState, useState } from "react";
import { Field } from "@/components/forms/field";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, fieldValue, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveSignatureAction } from "@/modules/users/signature.actions";
import { sendQuotationEmailAction } from "../actions";
import { RecipientsField } from "./recipients-field";

export type EmailComposeProps = {
  quotationId: string;
  from: string;
  recipients: { email: string; name: string }[];
  defaultTo: string[];
  defaultBcc: string[];
  subject: string;
  body: string;
  signature: string;
  signatureSaved: boolean;
  attachmentName: string;
  previewHref: string;
};

/**
 * Write and send the quotation email. Everything is pre-written and editable: the recipients (the customer's contacts one click away),
 * the subject, a short message with the terms in brief, and the sender's own signature. The PDF is attached automatically (made when you
 * press Send, so it is always the issued version). Nothing is sent until you press Send; a failure stays here as plain text.
 */
export function EmailQuotationForm({ quotationId, from, recipients, defaultTo, defaultBcc, subject, body, signature, signatureSaved, attachmentName, previewHref }: EmailComposeProps) {
  const close = useDrawerClose();
  const [state, formAction] = useActionState(sendQuotationEmailAction, null);
  const [signatureState, saveSignatureFormAction] = useActionState(saveSignatureAction, null);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(defaultBcc.length > 0);
  useActionFeedback(state, () => close());
  useActionFeedback(signatureState);
  const err = (name: string) => fieldError(state, name);

  return (
    <form action={formAction} className="space-y-4" noValidate autoComplete="off">
      <input type="hidden" name="quotationId" value={quotationId} />
      <FormMessage state={state} />

      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">From</span>
        <p className="rounded-lg border bg-surface px-2.5 py-1.5 text-sm">{from}</p>
      </div>

      <div className="space-y-2">
        <RecipientsField name="to" label="To" initial={defaultTo} suggestions={recipients} error={err("to")} autoFocus={defaultTo.length === 0} />
        <div className="flex gap-3 text-xs">
          {showCc ? null : (
            <button type="button" onClick={() => setShowCc(true)} className="text-brand hover:underline">
              Add Cc
            </button>
          )}
          {showBcc ? null : (
            <button type="button" onClick={() => setShowBcc(true)} className="text-brand hover:underline">
              Add Bcc
            </button>
          )}
        </div>
        {showCc ? <RecipientsField name="cc" label="Cc" initial={[]} suggestions={recipients} error={err("cc")} /> : null}
        {showBcc ? <RecipientsField name="bcc" label="Bcc" initial={defaultBcc} error={err("bcc")} /> : null}
      </div>

      <Field label="Subject" htmlFor="eq-subject" error={err("subject")}>
        <Input id="eq-subject" name="subject" defaultValue={fieldValue(state, "subject", subject)} aria-invalid={Boolean(err("subject"))} />
      </Field>

      <Field label="Message" htmlFor="eq-body" error={err("body")}>
        <Textarea id="eq-body" name="body" rows={13} defaultValue={fieldValue(state, "body", body)} aria-invalid={Boolean(err("body"))} className="text-sm leading-relaxed" />
      </Field>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="eq-signature" className="text-xs text-muted-foreground">
            Signature {signatureSaved ? "(yours)" : "(suggested, not saved yet)"}
          </label>
          <SubmitButton type="submit" formAction={saveSignatureFormAction} variant="ghost" size="xs" pendingLabel="Saving...">
            Save as my signature
          </SubmitButton>
        </div>
        <Textarea id="eq-signature" name="signature" rows={4} defaultValue={fieldValue(state, "signature", signature)} aria-invalid={Boolean(err("signature"))} className="font-mono text-xs" />
        <FormMessage state={signatureState} />
      </div>

      <div className="flex items-center gap-2 rounded-lg border bg-surface px-2.5 py-2 text-sm">
        <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <FileText className="size-4 shrink-0 text-brand" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{attachmentName}</span>
        <a href={previewHref} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
          Preview
        </a>
      </div>

      <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center justify-between gap-2 border-t bg-popover px-4 py-3">
        <p className="text-xs text-muted-foreground">The PDF is attached when you press Send.</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <SubmitButton pendingLabel="Sending...">Send email</SubmitButton>
        </div>
      </div>
    </form>
  );
}
