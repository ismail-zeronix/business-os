"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldError, fieldValue, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AiProvider } from "@/generated/prisma/enums";
import { AI_PROVIDER_LABEL } from "@/lib/labels";
import { createAiProviderAction, testAiProviderAction, updateAiProviderAction } from "../actions";
import { PROVIDER_INFO } from "../provider-info";

/**
 * Set up or edit one provider. The key is write-only: never displayed, never pre-filled, and on edit a blank field keeps the stored one.
 * "Test connection" sends one tiny request with the form as filled in and stores nothing.
 */
export function AiProviderForm({ provider, setting, keyConfigured }: { provider: AiProvider; setting?: { id: string; model: string }; keyConfigured: boolean }) {
  const close = useDrawerClose();
  const editing = Boolean(setting);
  const info = PROVIDER_INFO[provider];
  const [state, formAction] = useActionState(editing ? updateAiProviderAction : createAiProviderAction, null);
  const [testState, testAction] = useActionState(testAiProviderAction, null);
  useActionFeedback(state, () => close());
  useActionFeedback(testState);

  const err = (name: string) => fieldError(state, name) ?? fieldError(testState, name);

  if (!keyConfigured) {
    return (
      <Alert variant="warning" className="space-y-2 py-3 text-xs">
        <AlertTitle>Keys cannot be stored yet</AlertTitle>
        <p>
          AI keys are stored encrypted, and the encryption key is missing. Add <span className="font-mono">APP_SECRET_KEY</span> to <span className="font-mono">.env</span> (see{" "}
          <span className="font-mono">.env.example</span>) and restart the application.
        </p>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate autoComplete="off">
      {setting ? <input type="hidden" name="id" value={setting.id} /> : null}
      <input type="hidden" name="provider" value={provider} />
      <FormMessage state={state} />

      <Field label="Model" htmlFor="aipf-model" required error={err("model")} hint={info.modelHint}>
        <Input
          id="aipf-model"
          name="model"
          className="font-mono"
          defaultValue={fieldValue(state, "model", setting?.model ?? info.defaultModel ?? "")}
          autoFocus={!editing}
          aria-invalid={Boolean(err("model"))}
        />
      </Field>
      <Field
        label="API key"
        htmlFor="aipf-key"
        required={!editing}
        error={err("apiKey")}
        hint={editing ? "Leave blank to keep the current key. It is never shown." : `${info.keyHint} Stored encrypted and never shown again.`}
      >
        <Input id="aipf-key" name="apiKey" type="password" autoComplete="new-password" placeholder={editing ? "Unchanged" : undefined} aria-invalid={Boolean(err("apiKey"))} />
      </Field>

      <Alert className="bg-surface text-xs text-muted-foreground">
        When {AI_PROVIDER_LABEL[provider]} is the active provider, each question and the evidence needed to answer it (products, supplier prices and stock) is sent
        to it. The assistant only answers and drafts: it never changes a record or sends anything.
      </Alert>

      {testState?.ok ? (
        <Alert variant="success" role="status" className="text-xs">
          Connected. {testState.data.model} answered in {(testState.data.latencyMs / 1000).toFixed(1)} s.
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
          <SubmitButton pendingLabel="Saving...">{editing ? "Save changes" : "Save"}</SubmitButton>
        </div>
      </div>
    </form>
  );
}
