"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, fieldValue, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Textarea } from "@/components/ui/textarea";
import { saveSignatureAction } from "../signature.actions";

/**
 * The signed-in person's own email signature. It is added under every email they send, and each person has their own. Anything typed here
 * is plain text. The compose drawer starts from it and lets the person adjust it for one email.
 */
export function SignatureForm({ signature, suggestion }: { signature: string | null; suggestion: string }) {
  const [state, formAction] = useActionState(saveSignatureAction, null);
  useActionFeedback(state);
  const error = fieldError(state, "signature");

  return (
    <form action={formAction} className="space-y-2">
      <FormMessage state={state} />
      <Textarea
        name="signature"
        rows={5}
        defaultValue={fieldValue(state, "signature", signature ?? "")}
        placeholder={suggestion}
        aria-label="Your email signature"
        aria-invalid={Boolean(error)}
        className="max-w-xl font-mono text-xs"
      />
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{signature ? "Shown under your emails." : "Not saved yet. Until you save one, emails use the suggestion in grey."}</p>
      )}
      <SubmitButton size="sm" pendingLabel="Saving...">
        Save signature
      </SubmitButton>
    </form>
  );
}
