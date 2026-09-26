import { afterEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "../errors";
import { assertSetupToken, setupTokenAccepted, setupTokenRequired } from "./setup-token";

afterEach(() => vi.unstubAllEnvs());

describe("setup token", () => {
  it("is not required, and anything is accepted, when SETUP_TOKEN is unset or blank", () => {
    vi.stubEnv("SETUP_TOKEN", "");
    expect(setupTokenRequired()).toBe(false);
    expect(setupTokenAccepted(undefined)).toBe(true);
    expect(setupTokenAccepted("whatever")).toBe(true);
    vi.stubEnv("SETUP_TOKEN", "   ");
    expect(setupTokenRequired()).toBe(false);
  });

  it("accepts only the right code when it is set (surrounding spaces are ignored)", () => {
    vi.stubEnv("SETUP_TOKEN", "TEST-setup-code");
    expect(setupTokenRequired()).toBe(true);
    expect(setupTokenAccepted("TEST-setup-code")).toBe(true);
    expect(setupTokenAccepted("  TEST-setup-code ")).toBe(true);
    expect(setupTokenAccepted("test-setup-code")).toBe(false);
    expect(setupTokenAccepted("TEST-setup-cod")).toBe(false);
    expect(setupTokenAccepted("")).toBe(false);
    expect(setupTokenAccepted(null)).toBe(false);
    expect(setupTokenAccepted(undefined)).toBe(false);
  });

  it("assertSetupToken names the field and never repeats either code", () => {
    vi.stubEnv("SETUP_TOKEN", "TEST-setup-code");
    let error: unknown;
    try {
      assertSetupToken("guess");
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({ fieldErrors: { setupToken: "Not correct" } });
    expect(String((error as Error).message)).not.toContain("TEST-setup-code");
    expect(String((error as Error).message)).not.toContain("guess");
    expect(() => assertSetupToken("TEST-setup-code")).not.toThrow();
  });
});
