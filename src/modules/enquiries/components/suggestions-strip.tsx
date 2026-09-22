"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { applySuggestionAction } from "../actions";
import { Alert } from "@/components/ui/alert";

export type Suggestion = { field: "deliveryLocation" | "priority"; label: string; value: string };

function SuggestionChip({ enquiryId, suggestion }: { enquiryId: string; suggestion: Suggestion }) {
  const [state, formAction] = useActionState(applySuggestionAction, null);
  useActionFeedback(state);
  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={enquiryId} />
      <input type="hidden" name="field" value={suggestion.field} />
      <span>
        {suggestion.label}: <span className="font-medium text-foreground">{suggestion.value}</span>
      </span>
      <SubmitButton size="xs" variant="outline" pendingLabel="Applying...">
        Apply
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/**
 * Details the parser noticed in the request, offered as suggestions. Nothing is saved until a person applies it (parsers propose, people
 * confirm). The required-by wording is shown as a hint only: a person sets the real date in Edit.
 */
export function SuggestionsStrip({ enquiryId, suggestions, requiredByText }: { enquiryId: string; suggestions: Suggestion[]; requiredByText: string | null }) {
  if (suggestions.length === 0 && !requiredByText) return null;
  return (
    <Alert variant="info" role="status" className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2 text-xs">
      <span className="font-medium">Detected in the request</span>
      {suggestions.map((suggestion) => (
        <SuggestionChip key={suggestion.field} enquiryId={enquiryId} suggestion={suggestion} />
      ))}
      {requiredByText ? (
        <span>
          Wanted: <span className="font-medium text-foreground">{requiredByText}</span> <span className="text-muted-foreground">(set the date in Edit)</span>
        </span>
      ) : null}
    </Alert>
  );
}
