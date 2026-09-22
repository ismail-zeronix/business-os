import { createHash, randomBytes } from "node:crypto";

/**
 * Sign-in sessions. The browser holds a random token in a cookie; the database holds only its SHA-256 hash, so a copy of the database
 * cannot be used to sign in. A session lasts a fixed number of days from sign-in (nothing extends it silently).
 */
export const SESSION_COOKIE = "zx_session";
export const SESSION_DAYS = 7;

/** 5 wrong passwords in a row lock the account for 15 minutes. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export const newSessionToken = (): string => randomBytes(32).toString("base64url");
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
export const sessionExpiry = (from = new Date()): Date => new Date(from.getTime() + SESSION_DAYS * 86_400_000);

/** httpOnly (scripts cannot read it), same-site (not sent from other sites), Secure on the production build. */
export function sessionCookieOptions(expires: Date) {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", expires };
}

/** Only a path inside this site is a valid place to go after signing in: never another site, never "//host". */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\r\n]/.test(next)) return "/";
  return next;
}
