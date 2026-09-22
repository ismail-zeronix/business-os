import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A short-lived, single-purpose link token for the server's own headless browser. When the app turns a page into a PDF it opens that page
 * itself, and the browser has no sign-in session, so the request carries this token instead: an HMAC (keyed by APP_SECRET_KEY) over what the
 * page is and when the token expires. It proves "this server asked for exactly this page, moments ago" and nothing else: it works for one
 * subject (a quotation id), for two minutes, and only for the read-only print page. Pure: no imports from the application.
 */

const purpose = "render";

function key(): Buffer {
  const raw = process.env.APP_SECRET_KEY?.trim();
  if (!raw) throw new Error("APP_SECRET_KEY is not configured");
  return Buffer.from(raw, "base64");
}

const mac = (subject: string, expires: number) => createHmac("sha256", key()).update(`${purpose}:${subject}:${expires}`).digest("base64url");

/** `<expires>.<mac>`. Throws if the key is missing. */
export function signRenderToken(subject: string, ttlSeconds = 120, now: number = Date.now()): string {
  const expires = Math.floor(now / 1000) + ttlSeconds;
  return `${expires}.${mac(subject, expires)}`;
}

/** True only for an unexpired token that was signed for exactly this subject. Never throws. */
export function verifyRenderToken(subject: string, token: string | undefined | null, now: number = Date.now()): boolean {
  if (!token) return false;
  try {
    const [expiresText, given] = token.split(".");
    const expires = Number(expiresText);
    if (!given || !Number.isInteger(expires) || expires * 1000 < now) return false;
    const expected = Buffer.from(mac(subject, expires));
    const actual = Buffer.from(given);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
