import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encryption for secrets stored in the database (mailbox passwords). AES-256-GCM with a random 12-byte IV per value; the auth tag makes
 * any tampering detectable. Format: `v1:<iv>:<tag>:<ciphertext>` (base64 parts). The key is APP_SECRET_KEY (32 bytes, base64) and lives
 * in the environment, never in the database, so a database dump does not contain a usable secret. See docs/decisions/0005.
 *
 * Deliberately no imports from the application: this file is pure and usable from scripts. It never logs and never puts a secret
 * (or the key) in an error message.
 */

const VERSION = "v1";

function key(): Buffer {
  const raw = process.env.APP_SECRET_KEY?.trim();
  if (!raw) throw new Error("APP_SECRET_KEY is not configured");
  const buffer = Buffer.from(raw, "base64");
  if (buffer.length !== 32) throw new Error("APP_SECRET_KEY must be 32 bytes, base64 encoded");
  return buffer;
}

/** True when a valid key is configured, so screens can explain what is missing instead of failing on save. */
export function isSecretKeyConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
}

/** Throws if the payload is malformed, was encrypted with another key, or was modified. */
export function decryptSecret(payload: string): string {
  const [version, iv, tag, data] = payload.split(":");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Unsupported secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
