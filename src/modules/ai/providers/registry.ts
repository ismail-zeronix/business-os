import { createAnthropicProvider } from "./anthropic";
import { createGeminiProvider } from "./gemini";
import { createOpenAIProvider } from "./openai";
import type { AIProvider, ProviderConfig } from "./types";

/** Server only: builds the adapter for a stored configuration. Screens use `../provider-info.ts`, which imports no SDK. */
export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.provider) {
    case "ANTHROPIC":
      return createAnthropicProvider(config);
    case "OPENAI":
      return createOpenAIProvider(config);
    case "GEMINI":
      return createGeminiProvider(config);
  }
}
