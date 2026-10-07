import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The shared secret the internal mail-sync cron trigger (`src/app/api/cron/mail-sync/route.ts`) must present. Unlike
 * `setup-token.ts`, this fails CLOSED when unset: there is no legitimate caller of that route besides the configured
 * trigger, so a missing secret must refuse every request, not allow them.
 */
const configured = (): string => process.env.MAIL_CRON_SECRET?.trim() ?? "";

const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

/** True only when a secret is configured AND `given` matches it. Compared in constant time. */
export function cronSecretAccepted(given: string | null | undefined): boolean {
  const expected = configured();
  if (expected === "") return false;
  return timingSafeEqual(digest(expected), digest((given ?? "").trim()));
}
