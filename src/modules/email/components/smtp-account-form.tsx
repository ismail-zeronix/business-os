"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/forms/field";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { FormMessage } from "@/components/forms/form-message";
import type { SelectOption } from "@/components/forms/multi-select";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, fieldValue, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EMAIL_SECURITY_LABEL, toOptions } from "@/lib/labels";
import { createSmtpAccountAction, updateSmtpAccountAction } from "../smtp.actions";
import { HOSTINGER_SMTP_DEFAULTS } from "../smtp.schemas";

export type SmtpAccountFormInitial = {
  id: string;
  label: string;
  host: string;
  port: number;
  security: string;
  username: string;
  fromName: string;
  fromAddress: string;
  replyTo: string | null;
  defaultBcc: string | null;
};

/**
 * Add or edit the account emails are sent from. Hostinger's settings are pre-filled and editable. The password is write-only: never shown,
 * never pre-filled, and on edit a blank field keeps the stored one. A new account can reuse the login of an incoming mailbox that is
 * already connected: the password is then copied on the server and never passes through the browser.
 */
export function SmtpAccountForm({ account, incoming, defaultFromName, keyConfigured }: { account?: SmtpAccountFormInitial; incoming: SelectOption[]; defaultFromName: string; keyConfigured: boolean }) {
  const close = useDrawerClose();
  const editing = Boolean(account);
  const [state, formAction] = useActionState(editing ? updateSmtpAccountAction : createSmtpAccountAction, null);
  const [reuse, setReuse] = useState(!editing && incoming.length > 0);
  useActionFeedback(state, () => close());
  const err = (name: string) => fieldError(state, name);

  if (!keyConfigured) {
    return (
      <Alert variant="warning" className="space-y-2 py-3 text-xs">
        <AlertTitle>Passwords cannot be stored yet</AlertTitle>
        <p>
          Mailbox passwords are stored encrypted, and the encryption key is missing. Add <span className="font-mono">APP_SECRET_KEY</span> to <span className="font-mono">.env</span> and restart the application.
        </p>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate autoComplete="off">
      {account ? <input type="hidden" name="id" value={account.id} /> : null}
      <FormMessage state={state} />

      <section className="space-y-3">
        <h3 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Server</h3>
        <div className="grid grid-cols-6 gap-3">
          <Field label="Label" htmlFor="sa-label" required error={err("label")} className="col-span-6">
            <Input id="sa-label" name="label" defaultValue={fieldValue(state, "label", account?.label)} placeholder="e.g. Sales mailbox" autoFocus aria-invalid={Boolean(err("label"))} />
          </Field>
          <Field label="Mail server (SMTP)" htmlFor="sa-host" required error={err("host")} className="col-span-4">
            <Input id="sa-host" name="host" defaultValue={fieldValue(state, "host", account?.host ?? HOSTINGER_SMTP_DEFAULTS.host)} aria-invalid={Boolean(err("host"))} />
          </Field>
          <Field label="Port" htmlFor="sa-port" required error={err("port")} className="col-span-2">
            <Input id="sa-port" name="port" inputMode="numeric" defaultValue={fieldValue(state, "port", String(account?.port ?? HOSTINGER_SMTP_DEFAULTS.port))} className="num" aria-invalid={Boolean(err("port"))} />
          </Field>
          <Field label="Security" htmlFor="sa-security" required error={err("security")} className="col-span-6">
            <SelectField id="sa-security" name="security" allowNone={false} defaultValue={fieldValue(state, "security", account?.security ?? HOSTINGER_SMTP_DEFAULTS.security)} options={toOptions(EMAIL_SECURITY_LABEL)} />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Login</h3>
        {!editing && incoming.length > 0 ? (
          <div className="flex gap-1.5">
            <Button type="button" size="xs" variant={reuse ? "default" : "outline"} onClick={() => setReuse(true)}>
              Same login as an incoming mailbox
            </Button>
            <Button type="button" size="xs" variant={reuse ? "outline" : "default"} onClick={() => setReuse(false)}>
              Type a login
            </Button>
          </div>
        ) : null}
        {reuse && !editing ? (
          <Field label="Incoming mailbox" htmlFor="sa-copy" required error={err("copyLoginFromAccountId")} hint="Its username and password are copied on the server. The password is never shown.">
            <SelectField id="sa-copy" name="copyLoginFromAccountId" allowNone={false} defaultValue={incoming[0]?.value} options={incoming} />
          </Field>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <Field label="Username" htmlFor="sa-username" required error={err("username")}>
              <Input id="sa-username" name="username" defaultValue={fieldValue(state, "username", account?.username)} autoComplete="off" aria-invalid={Boolean(err("username"))} />
            </Field>
            <Field label="Password" htmlFor="sa-password" required={!editing} error={err("password")} hint={editing ? "Leave blank to keep the current password. It is never shown." : "Stored encrypted and never shown again."}>
              <Input id="sa-password" name="password" type="password" autoComplete="new-password" placeholder={editing ? "Unchanged" : undefined} aria-invalid={Boolean(err("password"))} />
            </Field>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Sent as</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From name" htmlFor="sa-fromName" required error={err("fromName")}>
            <Input id="sa-fromName" name="fromName" defaultValue={fieldValue(state, "fromName", account?.fromName ?? defaultFromName)} aria-invalid={Boolean(err("fromName"))} />
          </Field>
          <Field label="From address" htmlFor="sa-fromAddress" required error={err("fromAddress")}>
            <Input id="sa-fromAddress" name="fromAddress" type="email" defaultValue={fieldValue(state, "fromAddress", account?.fromAddress)} placeholder="sales@yourdomain.com" aria-invalid={Boolean(err("fromAddress"))} />
          </Field>
          <Field label="Reply-to (optional)" htmlFor="sa-replyTo" error={err("replyTo")}>
            <Input id="sa-replyTo" name="replyTo" type="email" defaultValue={fieldValue(state, "replyTo", account?.replyTo)} aria-invalid={Boolean(err("replyTo"))} />
          </Field>
          <Field label="Default Bcc (optional)" htmlFor="sa-bcc" error={err("defaultBcc")}>
            <Input id="sa-bcc" name="defaultBcc" type="email" defaultValue={fieldValue(state, "defaultBcc", account?.defaultBcc)} placeholder="a copy of every email" aria-invalid={Boolean(err("defaultBcc"))} />
          </Field>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-popover px-4 py-3">
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Saving...">{editing ? "Save changes" : "Add account"}</SubmitButton>
      </div>
    </form>
  );
}
