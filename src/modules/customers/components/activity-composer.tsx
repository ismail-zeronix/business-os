"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CALL_DIRECTION_LABEL, CALL_OUTCOME_LABEL, toOptions } from "@/lib/labels";
import { addCustomerNoteAction, logCustomerCallAction } from "../actions";

/** Logs a note on the customer's timeline. Notes are append-only: recorded, never edited or deleted. */
function NoteForm({ customerId }: { customerId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(addCustomerNoteAction, null);
  useActionFeedback(state, () => formRef.current?.reset());

  return (
    <form ref={formRef} action={formAction} className="space-y-2" noValidate>
      <input type="hidden" name="id" value={customerId} />
      <FormMessage state={state} />
      <Field label="Add a note" htmlFor="customer-note-text" error={fieldError(state, "note")}>
        <Textarea id="customer-note-text" name="note" rows={2} placeholder="What happened, what was agreed, what is next" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton size="sm" pendingLabel="Adding...">
          Add note
        </SubmitButton>
      </div>
    </form>
  );
}

/** Logs a call on the customer's timeline: direction and outcome are required, what was discussed is optional. */
function CallForm({ customerId }: { customerId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [resetKey, setResetKey] = useState(0);
  const [state, formAction] = useActionState(logCustomerCallAction, null);
  useActionFeedback(state, () => {
    formRef.current?.reset();
    setResetKey((key) => key + 1);
  });

  return (
    <form ref={formRef} action={formAction} className="space-y-2" key={resetKey}>
      <input type="hidden" name="id" value={customerId} />
      <FormMessage state={state} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Direction" htmlFor="customer-call-direction" required error={fieldError(state, "direction")}>
          <SelectField id="customer-call-direction" name="direction" options={toOptions(CALL_DIRECTION_LABEL)} defaultValue="OUTBOUND" allowNone={false} />
        </Field>
        <Field label="Outcome" htmlFor="customer-call-outcome" required error={fieldError(state, "outcome")}>
          <SelectField id="customer-call-outcome" name="outcome" options={toOptions(CALL_OUTCOME_LABEL)} defaultValue="REACHED" allowNone={false} />
        </Field>
      </div>
      <Field label="What was discussed" htmlFor="customer-call-note" error={fieldError(state, "note")}>
        <Textarea id="customer-call-note" name="note" rows={2} placeholder="Who you reached, what was agreed, what is next" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton size="sm" pendingLabel="Logging...">
          Log call
        </SubmitButton>
      </div>
    </form>
  );
}

/** Note / Call toggle above the customer's Activity timeline. Both are append-only audit entries (no notes table). */
export function CustomerActivityComposer({ customerId }: { customerId: string }) {
  const [kind, setKind] = useState<"note" | "call">("note");

  return (
    <div className="mb-5 max-w-2xl space-y-3">
      <Tabs value={kind} onValueChange={(value) => setKind(value as "note" | "call")}>
        <TabsList aria-label="Log">
          <TabsTrigger value="note">Note</TabsTrigger>
          <TabsTrigger value="call">Call</TabsTrigger>
        </TabsList>
      </Tabs>
      {kind === "note" ? <NoteForm customerId={customerId} /> : <CallForm customerId={customerId} />}
    </div>
  );
}
