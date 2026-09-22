"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, fieldValue } from "@/components/forms/use-action-feedback";
import { Input } from "@/components/ui/input";
import { signInAction } from "../actions";

/** Email and password. A wrong answer is always the same sentence (the server never says which part was wrong). */
export function LoginForm({ next }: { next: string | null }) {
  const [state, formAction] = useActionState(signInAction, null);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormMessage state={state} />
      <Field label="Email" htmlFor="login-email" error={fieldError(state, "email")}>
        <Input id="login-email" name="email" type="email" autoComplete="username" defaultValue={fieldValue(state, "email")} autoFocus aria-invalid={Boolean(fieldError(state, "email"))} />
      </Field>
      <Field label="Password" htmlFor="login-password" error={fieldError(state, "password")}>
        <Input id="login-password" name="password" type="password" autoComplete="current-password" aria-invalid={Boolean(fieldError(state, "password"))} />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Signing in...">
        Sign in
      </SubmitButton>
    </form>
  );
}
