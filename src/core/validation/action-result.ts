import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { DomainError, isDatabaseUnavailable } from "../errors";
import { formDataToObject } from "./form-data";

/** The generic message for a zod validation failure; the specific text is in each field's error. */
export const VALIDATION_MESSAGE = "Please correct the highlighted fields.";

/** Values the user submitted, echoed back on failure so the form can repopulate (React 19 resets uncontrolled forms after an action). */
export type SubmittedValues = Record<string, string | string[]>;

/** What every server action returns to the client. Errors are data, not exceptions, so forms can show them inline. */
export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string>; values?: SubmittedValues };

export function ok<T = void>(data?: T, message?: string): ActionResult<T> {
  return { ok: true, data: data as T, message };
}

export function fail(message: string, fieldErrors?: Record<string, string>, values?: SubmittedValues): ActionResult<never> {
  return { ok: false, message, fieldErrors, values };
}

/** First message per field path. Nested paths are joined with dots ("items.0.price"). */
export function fieldErrorsFromZod(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_form";
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

/**
 * Runs an action body and converts failures into an ActionResult:
 *  - Next.js control flow (redirect / notFound) is re-thrown untouched.
 *  - zod and domain errors become field/form messages.
 *  - an unreachable database gets a specific plain message.
 *  - anything else is logged server-side and shown generically (no internals leak to the user).
 * Pass `formData` so a failed submit echoes the user's input back.
 */
export async function runAction<T>(body: () => Promise<T>, options: { successMessage?: string; formData?: FormData } = {}): Promise<ActionResult<T>> {
  const values = options.formData ? formDataToObject(options.formData) : undefined;
  try {
    const data = await body();
    return ok(data, options.successMessage);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ZodError) return fail(VALIDATION_MESSAGE, fieldErrorsFromZod(error), values);
    if (error instanceof DomainError) return fail(error.message, error.fieldErrors, values);
    if (isDatabaseUnavailable(error)) {
      return fail("The database is not reachable right now. Check that it is running, then try again.", undefined, values);
    }
    console.error("Unexpected error in server action:", error);
    return fail("Something went wrong and your change was not saved. Please try again.", undefined, values);
  }
}
