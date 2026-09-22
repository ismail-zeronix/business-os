"use client";

import { useActionState, useRef } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Textarea } from "@/components/ui/textarea";
import { addEnquiryNoteAction } from "../actions";

/** Adds a note to the enquiry's timeline. Notes are append-only: they are recorded, never edited or deleted. */
export function NotesComposer({ enquiryId }: { enquiryId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(addEnquiryNoteAction, null);
  useActionFeedback(state, () => formRef.current?.reset());

  return (
    <form ref={formRef} action={formAction} className="mb-5 max-w-2xl space-y-2" noValidate>
      <input type="hidden" name="id" value={enquiryId} />
      <FormMessage state={state} />
      <Field label="Add a note" htmlFor="note-text" error={fieldError(state, "note")}>
        <Textarea id="note-text" name="note" rows={2} placeholder="What happened, what was agreed, what is next" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton size="sm" pendingLabel="Adding...">
          Add note
        </SubmitButton>
      </div>
    </form>
  );
}
