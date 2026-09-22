"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/core/validation/action-result";

/**
 * Like `useActionState`, but reports success (the toast and `onSuccess`) the moment the action returns.
 *
 * A request action revalidates the page, and the row it belongs to changes with it (a sent request shows a read-only message, a removed
 * one disappears, a reopened one loses its Reopen button). The component can therefore be unmounted before an effect that runs after the
 * render gets a chance to close the drawer or show the toast, so that work is done here instead. Failures stay in the returned state and
 * are shown inline by the form.
 */
export function useRequestAction<T>(action: (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>, onSuccess?: () => void) {
  return useActionState(async (prev: ActionResult<T> | null, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.ok) {
      if (result.message) toast.success(result.message);
      onSuccess?.();
    }
    return result;
  }, null);
}
