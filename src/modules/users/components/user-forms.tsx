"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, fieldValue, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Input } from "@/components/ui/input";
import type { UserRole } from "@/generated/prisma/enums";
import { USER_ROLE_LABEL, toOptions } from "@/lib/labels";
import { createUserAction, resetUserPasswordAction, setUserStatusAction, updateUserAction } from "../actions";
import { MIN_PASSWORD } from "../schemas";

const roleOptions = toOptions(USER_ROLE_LABEL);

/** Add a person. The admin chooses their first password and passes it on; they can change it under "Change password". */
export function AddUserForm() {
  const close = useDrawerClose();
  const [state, formAction] = useActionState(createUserAction, null);
  useActionFeedback(state, close);
  const err = (name: string) => fieldError(state, name);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Name" htmlFor="nu-name" required error={err("name")}>
        <Input id="nu-name" name="name" defaultValue={fieldValue(state, "name")} aria-invalid={Boolean(err("name"))} autoFocus />
      </Field>
      <Field label="Email (they sign in with this)" htmlFor="nu-email" required error={err("email")}>
        <Input id="nu-email" name="email" type="email" autoComplete="off" defaultValue={fieldValue(state, "email")} aria-invalid={Boolean(err("email"))} />
      </Field>
      <Field label="Role" htmlFor="nu-role" required error={err("role")} hint="Staff do the daily work. Admins also manage users, mailboxes and settings.">
        <SelectField id="nu-role" name="role" allowNone={false} defaultValue={fieldValue(state, "role", "STAFF")} options={roleOptions} />
      </Field>
      <Field label="Initial password" htmlFor="nu-password" required error={err("password")} hint={`At least ${MIN_PASSWORD} characters. Tell them this password; they should change it after they sign in.`}>
        <Input id="nu-password" name="password" type="password" autoComplete="new-password" aria-invalid={Boolean(err("password"))} />
      </Field>
      <div className="flex justify-end border-t pt-3">
        <SubmitButton pendingLabel="Adding...">Add user</SubmitButton>
      </div>
    </form>
  );
}

export function EditUserForm({ user, isSelf }: { user: { id: string; name: string; email: string; role: UserRole }; isSelf: boolean }) {
  const close = useDrawerClose();
  const [state, formAction] = useActionState(updateUserAction, null);
  useActionFeedback(state, close);
  const err = (name: string) => fieldError(state, name);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={user.id} />
      <FormMessage state={state} />
      <Field label="Name" htmlFor={`eu-name-${user.id}`} required error={err("name")}>
        <Input id={`eu-name-${user.id}`} name="name" defaultValue={fieldValue(state, "name", user.name)} aria-invalid={Boolean(err("name"))} />
      </Field>
      <Field label="Email" htmlFor={`eu-email-${user.id}`} required error={err("email")}>
        <Input id={`eu-email-${user.id}`} name="email" type="email" defaultValue={fieldValue(state, "email", user.email)} aria-invalid={Boolean(err("email"))} />
      </Field>
      <Field label="Role" htmlFor={`eu-role-${user.id}`} required error={err("role")} hint={isSelf ? "You cannot change your own role. Ask another admin." : undefined}>
        {isSelf ? (
          <>
            <input type="hidden" name="role" value={user.role} />
            <Input id={`eu-role-${user.id}`} value={USER_ROLE_LABEL[user.role]} disabled readOnly />
          </>
        ) : (
          <SelectField id={`eu-role-${user.id}`} name="role" allowNone={false} defaultValue={fieldValue(state, "role", user.role)} options={roleOptions} />
        )}
      </Field>
      <div className="flex justify-end border-t pt-3">
        <SubmitButton pendingLabel="Saving...">Save</SubmitButton>
      </div>
    </form>
  );
}

/** An admin sets a new password for someone. That person is signed out everywhere and any lock is cleared. */
export function ResetPasswordForm({ userId, userName }: { userId: string; userName: string }) {
  const close = useDrawerClose();
  const [state, formAction] = useActionState(resetUserPasswordAction, null);
  useActionFeedback(state, close);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={userId} />
      <FormMessage state={state} />
      <p className="text-xs text-muted-foreground">Set a new password for {userName}. They will be signed out everywhere and use this one next time. Tell it to them yourself.</p>
      <Field label="New password" htmlFor={`rp-${userId}`} required error={fieldError(state, "password")} hint={`At least ${MIN_PASSWORD} characters.`}>
        <Input id={`rp-${userId}`} name="password" type="password" autoComplete="new-password" aria-invalid={Boolean(fieldError(state, "password"))} autoFocus />
      </Field>
      <div className="flex justify-end border-t pt-3">
        <SubmitButton pendingLabel="Saving...">Reset password</SubmitButton>
      </div>
    </form>
  );
}

/** Deactivate (cannot sign in, keeps history) or reactivate. Not offered on your own row. */
export function UserStatusButton({ userId, active }: { userId: string; active: boolean }) {
  const [state, formAction] = useActionState(setUserStatusAction, null);
  useActionFeedback(state);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={userId} />
      <input type="hidden" name="status" value={active ? "INACTIVE" : "ACTIVE"} />
      <SubmitButton variant="ghost" size="xs" pendingLabel="Saving...">
        {active ? "Deactivate" : "Reactivate"}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
