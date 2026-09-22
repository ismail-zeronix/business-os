"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, fieldValue, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EMAIL_SECURITY_LABEL, toOptions } from "@/lib/labels";
import { createEmailAccountAction, testEmailConnectionAction, updateEmailAccountAction } from "../actions";
import { HOSTINGER_IMAP_DEFAULTS } from "../schemas";
import { Alert, AlertTitle } from "@/components/ui/alert";

export type EmailAccountFormInitial = {
  id: string;
  label: string;
  host: string;
  port: number;
  security: string;
  username: string;
  folder: string;
  /** yyyy-mm-dd */
  syncFromDate: string;
};

/**
 * Add or edit a mailbox. Hostinger's settings are pre-filled and editable. The password is write-only: it is never displayed, never
 * pre-filled, and on edit a blank field keeps the stored one. "Test connection" checks the form as filled in and stores nothing.
 */
export function EmailAccountForm({ account, defaultSyncFrom, keyConfigured }: { account?: EmailAccountFormInitial; defaultSyncFrom: string; keyConfigured: boolean }) {
  const close = useDrawerClose();
  const editing = Boolean(account);
  const [state, formAction] = useActionState(editing ? updateEmailAccountAction : createEmailAccountAction, null);
  const [testState, testAction] = useActionState(testEmailConnectionAction, null);
  useActionFeedback(state, () => close());
  useActionFeedback(testState);

  const err = (name: string) => fieldError(state, name) ?? fieldError(testState, name);

  if (!keyConfigured) {
    return (
      <Alert variant="warning" className="space-y-2 py-3 text-xs">
        <AlertTitle>Passwords cannot be stored yet</AlertTitle>
        <p>
          Mailbox passwords are stored encrypted, and the encryption key is missing. Add <span className="font-mono">APP_SECRET_KEY</span> to <span className="font-mono">.env</span> (see{" "}
          <span className="font-mono">.env.example</span> for how to generate one) and restart the application.
        </p>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate autoComplete="off">
      {account ? <input type="hidden" name="id" value={account.id} /> : null}
      <FormMessage state={state} />

      <div className="grid grid-cols-6 gap-3">
        <Field label="Label" htmlFor="eaf-label" required error={err("label")} className="col-span-6">
          <Input id="eaf-label" name="label" defaultValue={fieldValue(state, "label", account?.label)} placeholder="e.g. Enquiries mailbox" autoFocus aria-invalid={Boolean(err("label"))} />
        </Field>
        <Field label="Mail server (IMAP)" htmlFor="eaf-host" required error={err("host")} className="col-span-4">
          <Input id="eaf-host" name="host" defaultValue={fieldValue(state, "host", account?.host ?? HOSTINGER_IMAP_DEFAULTS.host)} aria-invalid={Boolean(err("host"))} />
        </Field>
        <Field label="Port" htmlFor="eaf-port" required error={err("port")} className="col-span-2">
          <Input id="eaf-port" name="port" inputMode="numeric" defaultValue={fieldValue(state, "port", String(account?.port ?? HOSTINGER_IMAP_DEFAULTS.port))} className="num" aria-invalid={Boolean(err("port"))} />
        </Field>
        <Field label="Security" htmlFor="eaf-security" required error={err("security")} className="col-span-3" hint="Unencrypted connections are not offered.">
          <SelectField id="eaf-security" name="security" allowNone={false} defaultValue={fieldValue(state, "security", account?.security ?? HOSTINGER_IMAP_DEFAULTS.security)} options={toOptions(EMAIL_SECURITY_LABEL)} />
        </Field>
        <Field label="Folder" htmlFor="eaf-folder" required error={err("folder")} className="col-span-3">
          <Input id="eaf-folder" name="folder" defaultValue={fieldValue(state, "folder", account?.folder ?? HOSTINGER_IMAP_DEFAULTS.folder)} aria-invalid={Boolean(err("folder"))} />
        </Field>
        <Field label="Username" htmlFor="eaf-username" required error={err("username")} className="col-span-6" hint="The full email address, e.g. name@yourdomain.com.">
          <Input id="eaf-username" name="username" defaultValue={fieldValue(state, "username", account?.username)} autoComplete="off" aria-invalid={Boolean(err("username"))} />
        </Field>
        <Field
          label="Password"
          htmlFor="eaf-password"
          required={!editing}
          error={err("password")}
          className="col-span-6"
          hint={editing ? "Leave blank to keep the current password. It is never shown." : "Stored encrypted and never shown again. Use an app password if the mailbox has two-factor sign-in."}
        >
          <Input id="eaf-password" name="password" type="password" autoComplete="new-password" placeholder={editing ? "Unchanged" : undefined} aria-invalid={Boolean(err("password"))} />
        </Field>
        <Field label="Sync messages from" htmlFor="eaf-syncFrom" required error={err("syncFromDate")} className="col-span-6" hint="Older messages are ignored. Each sync reads at most 200 messages, oldest first.">
          <Input id="eaf-syncFrom" name="syncFromDate" type="date" defaultValue={fieldValue(state, "syncFromDate", account?.syncFromDate ?? defaultSyncFrom)} aria-invalid={Boolean(err("syncFromDate"))} />
        </Field>
      </div>

      <Alert className="bg-surface text-xs text-muted-foreground">
        The mailbox is opened read-only: messages are never marked as read, moved or deleted. Emails are stored as immutable evidence and never create an enquiry on their own.
      </Alert>

      {testState?.ok ? (
        <Alert variant="success" role="status" className="text-xs">
          Connected. The folder holds {testState.data.messageCount.toLocaleString("en-US")} {testState.data.messageCount === 1 ? "message" : "messages"}.
        </Alert>
      ) : (
        <FormMessage state={testState} />
      )}

      <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center justify-between gap-2 border-t bg-popover px-4 py-3">
        <SubmitButton type="submit" formAction={testAction} variant="outline" pendingLabel="Testing...">
          Test connection
        </SubmitButton>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <SubmitButton pendingLabel="Saving...">{editing ? "Save changes" : "Add account"}</SubmitButton>
        </div>
      </div>
    </form>
  );
}
