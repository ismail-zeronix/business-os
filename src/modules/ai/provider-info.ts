import type { AiProvider } from "../../generated/prisma/enums";

/**
 * What Settings > AI shows per provider. Client-safe (no SDK imports). Model names change often, so only Anthropic's is pre-filled;
 * `claude-opus-5` is the recommended Claude model.
 */
export const PROVIDER_INFO: Record<AiProvider, { defaultModel: string | null; modelHint: string; keyHint: string }> = {
  ANTHROPIC: {
    defaultModel: "claude-opus-5",
    modelHint: "claude-opus-5 is recommended. For it, a declined request is retried on Anthropic's fallback model automatically.",
    keyHint: "An API key from the Claude Console (it starts with sk-ant-).",
  },
  OPENAI: {
    defaultModel: null,
    modelHint: "The model name exactly as your OpenAI account lists it.",
    keyHint: "An API key from the OpenAI platform (it starts with sk-).",
  },
  GEMINI: {
    defaultModel: null,
    modelHint: "The model name exactly as Google AI Studio lists it.",
    keyHint: "An API key from Google AI Studio.",
  },
};

export const PROVIDER_ORDER: readonly AiProvider[] = ["ANTHROPIC", "OPENAI", "GEMINI"];
