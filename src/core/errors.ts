/**
 * Typed domain errors. Services throw these; actions translate them into user-facing messages (core/validation/action-result.ts).
 * Messages here are shown to users, so they must be plain language and never expose SQL, stack traces or internals.
 */

export type DomainErrorCode = "NOT_FOUND" | "CONFLICT" | "VALIDATION" | "INVARIANT" | "FORBIDDEN" | "UNAUTHENTICATED";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly fieldErrors?: Record<string, string>;

  constructor(message: string, code: DomainErrorCode, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

/** The record does not exist (or is not visible). */
export class NotFoundError extends DomainError {
  constructor(entity: string, message?: string) {
    super(message ?? `${entity} not found.`, "NOT_FOUND");
  }
}

/** The change collides with existing data (duplicate name, duplicate part number...). */
export class ConflictError extends DomainError {
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message, "CONFLICT", fieldErrors);
  }
}

/** Input failed a business validation that zod could not express. */
export class ValidationError extends DomainError {
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message, "VALIDATION", fieldErrors);
  }
}

/** A business invariant would be broken (confirming an item with no product, editing a confirmed item...). */
export class InvariantError extends DomainError {
  constructor(message: string) {
    super(message, "INVARIANT");
  }
}

/** The person is signed in but their role does not allow this (an admin-only action). */
export class ForbiddenError extends DomainError {
  constructor(message = "Only an admin can do this.") {
    super(message, "FORBIDDEN");
  }
}

/** There is no valid sign-in for this request (a session that ended, or was never started). */
export class UnauthenticatedError extends DomainError {
  constructor(message = "Please sign in again.") {
    super(message, "UNAUTHENTICATED");
  }
}

type WithCode = { code?: unknown; cause?: unknown; name?: unknown; message?: unknown; meta?: unknown };

function* errorChain(error: unknown): Generator<WithCode> {
  let current: unknown = error;
  for (let depth = 0; current && typeof current === "object" && depth < 6; depth++) {
    yield current as WithCode;
    current = (current as WithCode).cause;
  }
}

const UNAVAILABLE_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "57P01", "08006", "08001", "08004", "P1001", "P1002", "P1017"]);

/** True when the failure is "the database cannot be reached", so the UI can say so plainly. */
export function isDatabaseUnavailable(error: unknown): boolean {
  for (const e of errorChain(error)) {
    if (typeof e.code === "string" && UNAVAILABLE_CODES.has(e.code)) return true;
    if (typeof e.name === "string" && /Initialization/.test(e.name)) return true;
    if (typeof e.message === "string" && /ECONNREFUSED|Can't reach database server|connect ETIMEDOUT/i.test(e.message)) return true;
  }
  return false;
}

/** If the error is a PostgreSQL/Prisma unique-constraint violation, returns the violated field(s) or constraint name, else null. */
export function uniqueViolation(error: unknown): { fields: string[] } | null {
  for (const e of errorChain(error)) {
    if (e.code === "P2002" || e.code === "23505") {
      const meta = e.meta as { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } } | undefined;
      const target = meta?.target;
      const fields = Array.isArray(target)
        ? target.map(String)
        : typeof target === "string"
          ? [target]
          : Array.isArray(meta?.driverAdapterError?.cause?.constraint?.fields)
            ? (meta.driverAdapterError.cause.constraint.fields as unknown[]).map(String)
            : [];
      return { fields };
    }
  }
  return null;
}
