"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Input } from "@/components/ui/input";
import { changePasswordAction } from "../actions";
import { MIN_PASSWORD } from "../schemas";

/** Your own password. Your other sessions are signed out; this one stays. */
export function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [state, formAction] = useActionState(changePasswordAction, null);
  useActionFeedback(state, onDone);
  const err = (name: string) => fieldError(state, name);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Current password" htmlFor="cp-current" required error={err("currentPassword")}>
        <Input id="cp-current" name="currentPassword" type="password" autoComplete="current-password" aria-invalid={Boolean(err("currentPassword"))} autoFocus />
      </Field>
      <Field label="New password" htmlFor="cp-new" required error={err("newPassword")} hint={`At least ${MIN_PASSWORD} characters.`}>
        <Input id="cp-new" name="newPassword" type="password" autoComplete="new-password" aria-invalid={Boolean(err("newPassword"))} />
      </Field>
      <Field label="New password again" htmlFor="cp-confirm" required error={err("confirmPassword")}>
        <Input id="cp-confirm" name="confirmPassword" type="password" autoComplete="new-password" aria-invalid={Boolean(err("confirmPassword"))} />
      </Field>
      <div className="flex justify-end border-t pt-3">
        <SubmitButton pendingLabel="Saving...">Change password</SubmitButton>
      </div>
    </form>
  );
}
