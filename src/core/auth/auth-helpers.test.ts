import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { hashToken, newSessionToken, safeNextPath, sessionCookieOptions, sessionExpiry } from "./session";

describe("password hashing", () => {
  it("verifies the right password and refuses a wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batterY", hash)).toBe(false);
  });
  it("uses a fresh salt each time and a versioned format", async () => {
    const [a, b] = await Promise.all([hashPassword("same-password"), hashPassword("same-password")]);
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(a.split("$")).toHaveLength(6);
  });
  it("is false for a missing or malformed stored hash", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$a$b$c$d$e")).toBe(false);
    expect(await verifyPassword("x", "scrypt$1$2")).toBe(false);
  });
  it("treats canonically equivalent Unicode as the same password", async () => {
    const hash = await hashPassword("café-password");
    expect(await verifyPassword("café-password", hash)).toBe(true);
  });
  it("handles a very long password", async () => {
    const long = "a".repeat(200);
    expect(await verifyPassword(long, await hashPassword(long))).toBe(true);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/enquiries?tab=all", "/enquiries?tab=all"],
    ["/", "/"],
    ["//evil.example", "/"],
    ["https://evil.example", "/"],
    ["/\\evil.example", "/"],
    ["/ok\r\nSet-Cookie: x=1", "/"],
    ["javascript:alert(1)", "/"],
    ["", "/"],
    [null, "/"],
    [undefined, "/"],
  ])("%j -> %j", (input, expected) => expect(safeNextPath(input as string | null | undefined)).toBe(expected));
});

describe("session helpers", () => {
  it("makes long random tokens and stores only their hash", () => {
    const token = newSessionToken();
    expect(token).not.toBe(newSessionToken());
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });
  it("expires in 7 days", () => {
    expect(sessionExpiry(new Date("2026-09-26T00:00:00Z")).toISOString()).toBe("2026-10-03T00:00:00.000Z");
  });
  it("sets a httpOnly, lax cookie", () => {
    expect(sessionCookieOptions(new Date())).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });
});
