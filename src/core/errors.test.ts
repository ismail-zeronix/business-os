import { describe, expect, it } from "vitest";
import { ConflictError, DomainError, InvariantError, NotFoundError, ValidationError, isDatabaseUnavailable, uniqueViolation } from "./errors";

describe("domain errors", () => {
  it("carry a code, a plain message and optional field errors", () => {
    const conflict = new ConflictError("A supplier with this name already exists.", { name: "Already in use" });
    expect(conflict).toBeInstanceOf(DomainError);
    expect(conflict.code).toBe("CONFLICT");
    expect(conflict.fieldErrors).toEqual({ name: "Already in use" });
    expect(conflict.name).toBe("ConflictError");

    expect(new NotFoundError("Supplier").message).toBe("Supplier not found.");
    expect(new NotFoundError("Supplier").code).toBe("NOT_FOUND");
    expect(new ValidationError("Bad").code).toBe("VALIDATION");
    expect(new InvariantError("Nope").code).toBe("INVARIANT");
  });
});

describe("isDatabaseUnavailable", () => {
  it("recognises connection failures, including nested causes", () => {
    expect(isDatabaseUnavailable(Object.assign(new Error("x"), { code: "ECONNREFUSED" }))).toBe(true);
    expect(isDatabaseUnavailable(new Error("outer", { cause: Object.assign(new Error("inner"), { code: "P1001" }) }))).toBe(true);
    expect(isDatabaseUnavailable(new Error("connect ECONNREFUSED 127.0.0.1:5442"))).toBe(true);
  });

  it("does not misreport ordinary errors", () => {
    expect(isDatabaseUnavailable(new Error("something else"))).toBe(false);
    expect(isDatabaseUnavailable(new ConflictError("dup"))).toBe(false);
    expect(isDatabaseUnavailable(undefined)).toBe(false);
  });
});

describe("uniqueViolation", () => {
  it("detects Prisma P2002 and reads the target fields", () => {
    const error = Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target: ["normalized_name"] } });
    expect(uniqueViolation(error)).toEqual({ fields: ["normalized_name"] });
  });

  it("detects a raw PostgreSQL 23505 with no target", () => {
    expect(uniqueViolation(Object.assign(new Error("dup"), { code: "23505" }))).toEqual({ fields: [] });
  });

  it("returns null for other errors", () => {
    expect(uniqueViolation(new Error("nope"))).toBeNull();
  });
});
