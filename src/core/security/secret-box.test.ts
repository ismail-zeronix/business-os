import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret, isSecretKeyConfigured } from "./secret-box";

const KEY = Buffer.alloc(32, 3).toString("base64");

beforeEach(() => vi.stubEnv("APP_SECRET_KEY", KEY));
afterEach(() => vi.unstubAllEnvs());

describe("secret-box", () => {
  it("round-trips, including unicode", () => {
    for (const plain of ["hunter2", "pässwörd ✓ 密码", " "]) expect(decryptSecret(encryptSecret(plain))).toBe(plain);
  });
  it("uses a fresh IV, so the same value encrypts differently each time", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });
  it("does not contain the plain text", () => {
    expect(encryptSecret("hunter2-visible")).not.toContain("hunter2");
  });
  it("detects tampering with the ciphertext or the tag", () => {
    const [v, iv, tag, data] = encryptSecret("secret").split(":");
    const flip = (b64: string) => {
      const bytes = Buffer.from(b64, "base64");
      bytes[0] = bytes[0]! ^ 1;
      return bytes.toString("base64");
    };
    expect(() => decryptSecret([v, iv, tag, flip(data!)].join(":"))).toThrow();
    expect(() => decryptSecret([v, iv, flip(tag!), data].join(":"))).toThrow();
  });
  it("cannot be decrypted with another key", () => {
    const payload = encryptSecret("secret");
    vi.stubEnv("APP_SECRET_KEY", Buffer.alloc(32, 4).toString("base64"));
    expect(() => decryptSecret(payload)).toThrow();
  });
  it("refuses a malformed payload without echoing it", () => {
    expect(() => decryptSecret("nonsense")).toThrow("Unsupported secret format");
    expect(() => decryptSecret("v2:a:b:c")).toThrow("Unsupported secret format");
  });
  it("reports a missing or wrong-size key", () => {
    vi.stubEnv("APP_SECRET_KEY", "");
    expect(isSecretKeyConfigured()).toBe(false);
    expect(() => encryptSecret("x")).toThrow("APP_SECRET_KEY");
    vi.stubEnv("APP_SECRET_KEY", Buffer.alloc(16).toString("base64"));
    expect(isSecretKeyConfigured()).toBe(false);
  });
});
