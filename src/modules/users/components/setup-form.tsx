"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, fieldValue } from "@/components/forms/use-action-feedback";
import { Input } from "@/components/ui/input";
import { setupAction } from "../actions";
import { MIN_PASSWORD } from "../schemas";

/** One-time setup of the first admin. The existing user account is taken over, so earlier records stay under the same person. */
export function SetupForm({ defaultName, defaultEmail }: { defaultName: string; defaultEmail: string }) {
  const [state, formAction] = useActionState(setupAction, null);
  const err = (name: string) => fieldError(state, name);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Your name" htmlFor="setup-name" required error={err("name")}>
        <Input id="setup-name" name="name" autoComplete="name" defaultValue={fieldValue(state, "name", defaultName)} aria-invalid={Boolean(err("name"))} autoFocus />
      </Field>
      <Field label="Email (you sign in with this)" htmlFor="setup-email" required error={err("email")}>
        <Input id="setup-email" name="email" type="email" autoComplete="username" defaultValue={fieldValue(state, "email", defaultEmail)} aria-invalid={Boolean(err("email"))} />
      </Field>
      <Field label="Password" htmlFor="setup-password" required error={err("password")} hint={`At least ${MIN_PASSWORD} characters. It is stored scrambled; nobody can read it back, including admins.`}>
        <Input id="setup-password" name="password" type="password" autoComplete="new-password" aria-invalid={Boolean(err("password"))} />
      </Field>
      <Field label="Password again" htmlFor="setup-confirm" required error={err("confirmPassword")}>
        <Input id="setup-confirm" name="confirmPassword" type="password" autoComplete="new-password" aria-invalid={Boolean(err("confirmPassword"))} />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Setting up...">
        Set up and sign in
      </SubmitButton>
    </form>
  );
}
