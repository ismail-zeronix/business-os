import type { ActionResult } from "@/core/validation/action-result";
import { Alert } from "@/components/ui/alert";

/** Form-level error from a server action (conflict, not found, database unavailable...). Field errors are shown by <Field>. */
export function FormMessage({ state }: { state: ActionResult<unknown> | null }) {
  if (!state || state.ok) return null;
  return (
    <Alert variant="danger" className="text-xs">
      {state.message}
    </Alert>
  );
}
