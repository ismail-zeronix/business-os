import { createHash, timingSafeEqual } from "node:crypto";
import { ValidationError } from "../errors";

/**
 * An optional one-time code for first-time setup. On a fresh deployment /setup is open to whoever reaches it first; when SETUP_TOKEN is set
 * in the environment, the setup form asks for it and refuses everyone who does not know it. Unset (as on a machine that is already set up
 * or only used locally), nothing changes. Pure: reads only the environment.
 */
const configured = (): string => process.env.SETUP_TOKEN?.trim() ?? "";

export const setupTokenRequired = (): boolean => configured() !== "";

const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

/** True when no code is required, or `given` is the code. Compared in constant time. */
export function setupTokenAccepted(given: string | null | undefined): boolean {
  const expected = configured();
  if (expected === "") return true;
  return timingSafeEqual(digest(expected), digest((given ?? "").trim()));
}

export function assertSetupToken(given: string | null | undefined): void {
  if (!setupTokenAccepted(given)) throw new ValidationError("That setup code is not correct.", { setupToken: "Not correct" });
}
