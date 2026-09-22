"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AiProvider } from "@/generated/prisma/enums";
import { AI_PROVIDER_LABEL } from "@/lib/labels";
import { setAiProviderActiveAction } from "../actions";

/**
 * Switch the assistant to this provider, or switch it off, through a small confirm popover. Switching changes only which API answers:
 * the context, prompts, checks and style stay the same (ADR 0007).
 */
export function ProviderActiveControl({ id, provider, active, currentLabel }: { id: string; provider: AiProvider; active: boolean; currentLabel: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(setAiProviderActiveAction, null);
  useActionFeedback(state, () => setOpen(false));
  const label = AI_PROVIDER_LABEL[provider];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs">
          {active ? "Switch off" : "Use this"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">{active ? "Switch off the assistant?" : `Use ${label} for the assistant?`}</p>
          <p className="text-xs text-muted-foreground">
            {active
              ? "Nobody can ask the assistant until a provider is switched on again. Settings and keys are kept."
              : `${currentLabel ? `${currentLabel} stops answering. ` : ""}Questions and the evidence needed to answer them go to ${label} from now on. Answers keep the same checks and style.`}
          </p>
        </div>
        <FormMessage state={state} />
        <form action={formAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="active" value={active ? "false" : "true"} />
          <SubmitButton size="sm" variant={active ? "outline" : "default"} className={active ? "text-danger" : undefined}>
            {active ? "Switch off" : `Use ${label}`}
          </SubmitButton>
        </form>
      </PopoverContent>
    </Popover>
  );
}
