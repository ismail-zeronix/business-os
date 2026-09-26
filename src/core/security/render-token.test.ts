import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signRenderToken, verifyRenderToken } from "./render-token";

const KEY = Buffer.alloc(32, 7).toString("base64");
const now = Date.UTC(2026, 8, 26, 12, 0, 0);

beforeEach(() => vi.stubEnv("APP_SECRET_KEY", KEY));
afterEach(() => vi.unstubAllEnvs());

describe("render token", () => {
  it("verifies for the subject it was signed for", () => {
    expect(verifyRenderToken("q1", signRenderToken("q1", 120, now), now + 60_000)).toBe(true);
  });
  it("is refused for another subject", () => {
    expect(verifyRenderToken("q2", signRenderToken("q1", 120, now), now)).toBe(false);
  });
  it("is refused once expired", () => {
    expect(verifyRenderToken("q1", signRenderToken("q1", 120, now), now + 121_000)).toBe(false);
  });
  it("is refused when tampered with", () => {
    const [expires, mac] = signRenderToken("q1", 120, now).split(".");
    expect(verifyRenderToken("q1", `${Number(expires) + 3600}.${mac}`, now)).toBe(false);
    expect(verifyRenderToken("q1", `${expires}.${mac!.slice(0, -1)}A`, now)).toBe(false);
  });
  it("is refused when empty, malformed, or signed with another key", () => {
    expect(verifyRenderToken("q1", "", now)).toBe(false);
    expect(verifyRenderToken("q1", null, now)).toBe(false);
    expect(verifyRenderToken("q1", "garbage", now)).toBe(false);
    const token = signRenderToken("q1", 120, now);
    vi.stubEnv("APP_SECRET_KEY", Buffer.alloc(32, 9).toString("base64"));
    expect(verifyRenderToken("q1", token, now)).toBe(false);
  });
  it("never throws on verify when the key is missing, but signing does", () => {
    const token = signRenderToken("q1", 120, now);
    vi.stubEnv("APP_SECRET_KEY", "");
    expect(verifyRenderToken("q1", token, now)).toBe(false);
    expect(() => signRenderToken("q1")).toThrow();
  });
});
