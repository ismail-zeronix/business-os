"use client";

import { useActionState, useRef, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { inlineError, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/core/validation/action-result";
import { extractContact } from "../extract";

const THIN_SCROLL = "[scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]";

export type NoteFormValues = { body: string; contactName: string; company: string; phones: string; emails: string; description: string };

export const EMPTY_NOTE: NoteFormValues = { body: "", contactName: "", company: "", phones: "", emails: "", description: "" };

type FormAction = (prev: ActionResult<{ id: string }> | null, formData: FormData) => Promise<ActionResult<{ id: string }>>;

/**
 * One form for a new note and for editing one. Pasting text fills the contact fields with what the rules can read (phones, emails,
 * name, company). A person reviews and corrects them, and a field they have touched is never overwritten. The description is typed.
 * A saved note is never changed by reading again unless the person asks ("Read details from text").
 */
export function ContactNoteForm({
  action,
  initial = EMPTY_NOTE,
  id,
  saveLabel,
  onDone,
  onCancel,
}: {
  action: FormAction;
  initial?: NoteFormValues;
  id?: string;
  saveLabel: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<NoteFormValues>(initial);
  const touched = useRef<Set<keyof NoteFormValues>>(new Set(id ? (Object.keys(initial) as (keyof NoteFormValues)[]) : []));
  const [state, formAction, pending] = useActionState(action, null);

  useActionFeedback(state, () => {
    setValues(EMPTY_NOTE);
    touched.current = new Set();
    onDone();
  });

  const set = (field: keyof NoteFormValues, value: string) => {
    touched.current.add(field);
    setValues((v) => ({ ...v, [field]: value }));
  };

  /** Fills the detail fields from the text; `force` also replaces the ones a person has typed. */
  function readDetails(body: string, force: boolean) {
    const found = extractContact(body);
    const next: Partial<NoteFormValues> = {
      contactName: found.contactName ?? "",
      company: found.company ?? "",
      phones: found.phones.join(", "),
      emails: found.emails.join(", "),
    };
    if (force) for (const key of Object.keys(next) as (keyof NoteFormValues)[]) touched.current.delete(key);
    setValues((v) => {
      const merged = { ...v, body };
      for (const key of Object.keys(next) as (keyof NoteFormValues)[]) if (!touched.current.has(key)) merged[key] = next[key] ?? "";
      return merged;
    });
  }

  const err = (name: string) => inlineError(state, name);
  const bodyError = err("body");
  const formError = state && !state.ok && !state.fieldErrors ? state.message : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-2.5">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <Textarea
        name="body"
        value={values.body}
        onChange={(e) => readDetails(e.target.value, false)}
        placeholder="Paste the supplier's message or card here"
        aria-label="Pasted text"
        aria-invalid={bodyError ? true : undefined}
        maxLength={5000}
        autoFocus={Boolean(id)}
        className={`max-h-40 min-h-20 text-sm ${THIN_SCROLL}`}
      />
      {bodyError ? <FieldError>{bodyError}</FieldError> : null}

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Details</span>
        <Button type="button" variant="ghost" size="xs" onClick={() => readDetails(values.body, true)} disabled={!values.body.trim()}>
          <Sparkles className="text-info" /> Read from text
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Name" name="contactName" value={values.contactName} onChange={set} error={err("contactName")} max={100} />
        <Field label="Company" name="company" value={values.company} onChange={set} error={err("company")} max={150} />
      </div>
      <Field label="Phones" name="phones" value={values.phones} onChange={set} error={err("phones")} hint="Separate with commas" />
      <Field label="Emails" name="emails" value={values.emails} onChange={set} error={err("emails")} hint="Separate with commas" />
      <Field label="Description" name="description" value={values.description} onChange={set} error={err("description")} max={200} hint="Optional, e.g. what they supply" />

      {formError ? <FieldError>{formError}</FieldError> : null}
      <div className="flex justify-end gap-1.5">
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
            <X /> Cancel
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={pending || !values.body.trim()}>
          <Check /> {pending ? "Saving..." : saveLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  error,
  max,
  hint,
}: {
  label: string;
  name: keyof NoteFormValues;
  value: string;
  onChange: (field: keyof NoteFormValues, value: string) => void;
  error?: string;
  max?: number;
  hint?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        maxLength={max}
        placeholder={hint}
        aria-invalid={error ? true : undefined}
        className="h-8 text-sm"
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </label>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-xs text-danger">
      {children}
    </p>
  );
}
