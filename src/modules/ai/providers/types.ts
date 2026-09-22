import type { AiProvider } from "../../../generated/prisma/enums";

/**
 * The provider contract (docs/ai-intelligence/architecture.md section 4). Everything the user can notice about an answer (context,
 * prompt, style block, schema, token limit, validation) is decided before an adapter is called, so switching provider changes only
 * which API is called. An adapter translates this request to its SDK and the reply back. It adds no instructions, sends no sampling
 * parameters (current Claude and OpenAI reasoning models reject them) and never interprets the content.
 */

export type ProviderConfig = { provider: AiProvider; model: string; apiKey: string };

export type AIMessage = { role: "user" | "assistant"; content: string };

export type AITextRequest = {
  /** The complete system prompt, built centrally. Passed through unchanged. */
  system: string;
  messages: AIMessage[];
  maxOutputTokens: number;
};

export type AIStructuredRequest = AITextRequest & {
  /** Letters, digits and underscores (OpenAI requires a name for the schema). */
  schemaName: string;
  /** Strict JSON Schema from `toStrictJsonSchema`, identical for every provider. */
  jsonSchema: Record<string, unknown>;
};

/**
 * Token use of one call, the same meaning for every provider: `inputTokens` is ALL input (cached or not); `cacheReadTokens` is the part
 * served from the provider's prompt cache; `cacheWriteTokens` the part written to it (only Claude reports writes).
 */
export type AIUsage = { inputTokens: number | null; outputTokens: number | null; cacheReadTokens: number | null; cacheWriteTokens: number | null };

export type AITextResponse = {
  text: string;
  /** The model that actually answered (a refusal fallback can differ from the configured one). */
  model: string;
  usage: AIUsage;
};

/** `json` is unparsed-for-meaning: the caller validates it with zod. Adapters never trust or reshape it. */
export type AIStructuredResponse = AITextResponse & { json: unknown };

export interface AIProvider {
  readonly id: AiProvider;
  readonly model: string;
  generateText(input: AITextRequest): Promise<AITextResponse>;
  generateStructured(input: AIStructuredRequest): Promise<AIStructuredResponse>;
  generateEmbedding?(input: string[]): Promise<number[][]>;
}
