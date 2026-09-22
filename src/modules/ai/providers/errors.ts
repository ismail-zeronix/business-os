import { DomainError } from "../../../core/errors";

/**
 * Every AI failure is one of these codes, whichever provider was used, so the screen and the execution log speak one language.
 * Messages are shown to users: plain, and never the provider's raw error (which is logged server-side only, without the key).
 */
export type AiErrorCode =
  | "NO_PROVIDER"
  | "NO_SECRET_KEY"
  | "AUTH"
  | "QUOTA"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "BAD_REQUEST"
  | "REFUSED"
  | "TRUNCATED"
  | "INVALID_OUTPUT"
  | "BUDGET"
  | "UNKNOWN";

const MESSAGE: Record<AiErrorCode, string> = {
  NO_PROVIDER: "No AI provider is set up yet. An admin can add one in Settings > AI.",
  NO_SECRET_KEY: "APP_SECRET_KEY is not set, so the stored AI key cannot be read. Add it to .env and restart.",
  AUTH: "The AI provider did not accept the key. An admin can replace it in Settings > AI.",
  QUOTA: "The AI provider account has no credit or quota left. Add credit in the provider's billing settings, or switch provider in Settings > AI.",
  RATE_LIMITED: "The AI provider is busy right now (rate limit). Try again in a minute.",
  UNAVAILABLE: "The AI provider could not be reached. Try again shortly.",
  BAD_REQUEST: "The AI provider rejected the request. Check the model name in Settings > AI.",
  REFUSED: "The AI provider declined to answer this request.",
  TRUNCATED: "The AI answer was cut off before it finished. Try a narrower question.",
  INVALID_OUTPUT: "The AI answer did not pass the evidence checks, so it is not shown. Try again or rephrase the question.",
  BUDGET: "This question needed more steps than one request allows. Try a narrower question.",
  UNKNOWN: "The AI request failed. Try again.",
};

export class AiError extends DomainError {
  readonly aiCode: AiErrorCode;

  constructor(aiCode: AiErrorCode, message?: string) {
    super(message ?? MESSAGE[aiCode], "INVARIANT");
    this.aiCode = aiCode;
  }
}

/** Server-side note of a provider failure. The SDKs never put the key in an error message; the text is still kept out of the UI. */
export function logProviderFailure(provider: string, error: unknown): void {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.warn(`[ai] ${provider} request failed: ${detail.slice(0, 500)}`);
}
