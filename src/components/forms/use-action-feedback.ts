"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { VALIDATION_MESSAGE, type ActionResult } from "@/core/validation/action-result";

/**
 * Reacts once to each new action result: success shows a toast (and runs `onSuccess`), failure stays inline in the form.
 * Errors are never toasts (docs/design/UI_SYSTEM.md section 7).
 */
export function useActionFeedback<T>(state: ActionResult<T> | null, onSuccess?: (data: T) => void) {
  const handled = useRef<ActionResult<T> | null>(null);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  useEffect(() => {
    if (!state || handled.current === state) return;
    handled.current = state;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      onSuccessRef.current?.(state.data);
    }
  }, [state]);
}

/** Field error text for a form field, if the last failed result had one. */
export function fieldError(state: ActionResult<unknown> | null, name: string): string | undefined {
  return state && !state.ok ? state.fieldErrors?.[name] : undefined;
}

/**
 * The single most useful error text for a compact inline form with one field (no separate form-level banner):
 * a plain validation failure shows the field's own message; any other failure (a conflict, "archived, restore it instead", a
 * database problem) shows the full explanation, which is more helpful than a terse "Already in use".
 */
export function inlineError(state: ActionResult<unknown> | null, name: string): string | undefined {
  if (!state || state.ok) return undefined;
  if (state.message === VALIDATION_MESSAGE) return state.fieldErrors?.[name] ?? state.message;
  return state.message;
}

/** The value to show in a field: what the user last submitted (after a failed save), else the initial value. */
export function fieldValue(state: ActionResult<unknown> | null, name: string, initial?: string | null): string {
  if (state && !state.ok) {
    const submitted = state.values?.[name];
    if (typeof submitted === "string") return submitted;
  }
  return initial ?? "";
}

/** Multi-value equivalent for repeated fields (brandIds, categoryIds). */
export function fieldValues(state: ActionResult<unknown> | null, name: string, initial: string[] = []): string[] {
  if (state && !state.ok) {
    const submitted = state.values?.[name];
    if (Array.isArray(submitted)) return submitted;
    if (typeof submitted === "string") return [submitted];
    if (state.values) return []; // the field was submitted empty
  }
  return initial;
}
