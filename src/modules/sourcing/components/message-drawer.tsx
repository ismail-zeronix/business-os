"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { FormDrawer, useDrawerClose } from "@/components/forms/form-drawer";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PREFERRED_CHANNEL_LABEL, toOptions } from "@/lib/labels";
import { markRequestSentAction } from "../actions";
import { useRequestAction } from "./use-request-action";

/** Copies text to the clipboard. If the browser blocks it, the failure is shown inline (toasts are for success only). */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [blocked, setBlocked] = useState(false);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setBlocked(false);
            toast.success(`${label} copied`);
          } catch {
            setBlocked(true);
          }
        }}
      >
        <Copy aria-hidden /> Copy {label.toLowerCase()}
      </Button>
      {blocked ? <span className="text-xs text-danger">The browser blocked copying. Select the text and copy it by hand.</span> : null}
    </span>
  );
}

function SendForm({ id, initialSubject, initialBody, defaultSentAt }: { id: string; initialSubject: string; initialBody: string; defaultSentAt: string }) {
  const close = useDrawerClose();
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  // The page refresh turns this drawer into the read-only sent view, so success (toast, close) is reported as the action returns.
  const [state, formAction] = useRequestAction(markRequestSentAction, close);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        Built from the confirmed requirements. It never includes the customer&apos;s name, email or reference, but the requirement wording is copied from the customer&apos;s request, so read it before you send.
      </p>
      <Field label="Subject (email)" htmlFor="rq-subject" error={fieldError(state, "subject")}>
        <div className="flex items-start gap-2">
          <Input id="rq-subject" name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <CopyButton text={subject} label="Subject" />
        </div>
      </Field>
      <Field label="Message" htmlFor="rq-body" required error={fieldError(state, "body")}>
        <Textarea id="rq-body" name="body" rows={14} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-xs" />
      </Field>
      <CopyButton text={body} label="Message" />
      <div className="grid grid-cols-2 gap-3 border-t pt-3">
        <Field label="Sent via" htmlFor="rq-channel" required error={fieldError(state, "channel")}>
          <SelectField id="rq-channel" name="channel" allowNone={false} defaultValue="EMAIL" options={toOptions(PREFERRED_CHANNEL_LABEL)} />
        </Field>
        <Field label="Sent at (Dubai time)" htmlFor="rq-sentAt" required error={fieldError(state, "sentAt")}>
          <Input id="rq-sentAt" name="sentAt" type="datetime-local" defaultValue={defaultSentAt} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">Copy it, send it yourself, then press Mark sent. The text, channel and time are locked once saved.</p>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving...">Mark sent</SubmitButton>
      </div>
    </form>
  );
}

/**
 * The message for one request. While it is a draft the drawer is editable and ends in Mark sent; once sent it shows the stored text
 * read-only (what was actually sent, locked by the database).
 */
export function RequestMessageDrawer({
  request,
  initialSubject,
  initialBody,
  defaultSentAt,
  sentText,
  sentSummary,
}: {
  request: { id: string; supplierName: string; sent: boolean };
  initialSubject: string;
  initialBody: string;
  defaultSentAt: string;
  /** The stored text of a sent request (read-only). */
  sentText: string | null;
  /** "Email, 21 Sep 2026, 14:05, by Ismail". */
  sentSummary: string | null;
}) {
  return (
    <FormDrawer
      trigger={
        <Button variant={request.sent ? "ghost" : "outline"} size="xs">
          {request.sent ? "View message" : "Prepare message"}
        </Button>
      }
      title={`${request.sent ? "Sent to" : "Request to"} ${request.supplierName}`}
      description={request.sent ? (sentSummary ?? undefined) : "Copy it, send it from your own email or WhatsApp, then mark it sent."}
    >
      {request.sent && sentText ? (
        <div className="space-y-3">
          <pre className="rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">{sentText}</pre>
          <CopyButton text={sentText} label="Message" />
        </div>
      ) : (
        <SendForm id={request.id} initialSubject={initialSubject} initialBody={initialBody} defaultSentAt={defaultSentAt} />
      )}
    </FormDrawer>
  );
}
