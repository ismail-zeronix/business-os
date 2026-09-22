import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt from Node's built-in crypto (no dependency). A fresh random salt per password; the stored form is
 * `scrypt$N$r$p$salt$hash` (base64), so the cost can be raised later without breaking old hashes. Comparison is constant-time.
 * Parameters follow the OWASP minimum for scrypt (N=2^15, r=8, p=3).
 */
const N = 2 ** 15;
const R = 8;
const P = 3;
const KEY_LENGTH = 64;
const MAX_MEMORY = 256 * 1024 * 1024;

function derive(password: string, salt: Buffer, options: ScryptOptions, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password.normalize("NFKC"), salt, keyLength, { maxmem: MAX_MEMORY, ...options }, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: R, p: P }, KEY_LENGTH);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

/** A real hash of a random password, so a sign-in for an unknown email takes as long as one for a known email. */
const dummyHash = hashPassword(randomBytes(12).toString("base64"));

/** True only when `password` matches `stored`. A missing or malformed hash costs the same time and is simply false. */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parts = (stored ?? "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    await verifyAgainst(password, await dummyHash);
    return false;
  }
  return verifyAgainst(password, stored as string);
}

async function verifyAgainst(password: string, stored: string): Promise<boolean> {
  const [, n, r, p, salt, hash] = stored.split("$");
  if (!n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), { N: Number(n), r: Number(r), p: Number(p) }, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
