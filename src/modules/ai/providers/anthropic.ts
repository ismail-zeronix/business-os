import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { AiError, logProviderFailure } from "./errors";
import { parseJsonReply } from "./json-schema";
import type { AIProvider, AIStructuredRequest, AITextRequest, AITextResponse, ProviderConfig } from "./types";

/**
 * Anthropic Claude through the official SDK. Structured output uses `output_config.format` (JSON Schema). For Claude Opus 5 and
 * Fable 5.1 the server-side refusal fallback is on (`fallbacks: "default"`): a declined request is re-run on Anthropic's recommended
 * model inside the same call, and `response.model` says which model answered. No sampling parameters: Opus 5 rejects them.
 *
 * Prompt caching: ONE breakpoint, at the end of the system prompt, the only part identical across questions (the style block and
 * evidence rules). Never on the question or the evidence: they change every request, so a breakpoint there would pay the cache-write
 * premium every time and almost never be read. Below the model's minimum cacheable length (512 tokens on Opus 5, more on others) it
 * silently does nothing. It changes no answer.
 */

const FALLBACK_MODELS = new Set(["claude-opus-5", "claude-fable-5-1"]);

function mapError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  logProviderFailure("anthropic", error);
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return new AiError("AUTH");
  // An empty credit balance arrives as a billing_error or a 400 "credit balance is too low", not as a rate limit.
  if (error instanceof Anthropic.APIError && (error.type === "billing_error" || /credit balance/i.test(error.message))) return new AiError("QUOTA");
  if (error instanceof Anthropic.RateLimitError) return new AiError("RATE_LIMITED");
  if (error instanceof Anthropic.APIConnectionError) return new AiError("UNAVAILABLE");
  if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.NotFoundError || error instanceof Anthropic.UnprocessableEntityError) {
    return new AiError("BAD_REQUEST");
  }
  if (error instanceof Anthropic.APIError && typeof error.status === "number" && error.status >= 500) return new AiError("UNAVAILABLE");
  return new AiError("UNKNOWN");
}

function toResponse(message: BetaMessage): AITextResponse {
  if (message.stop_reason === "refusal") throw new AiError("REFUSED");
  if (message.stop_reason === "max_tokens" || message.stop_reason === "model_context_window_exceeded") throw new AiError("TRUNCATED");
  const text = message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  // Claude's input_tokens counts only what came after the last cache breakpoint; the total adds the cached reads and writes.
  const read = message.usage.cache_read_input_tokens ?? 0;
  const written = message.usage.cache_creation_input_tokens ?? 0;
  return {
    text,
    model: message.model,
    usage: { inputTokens: message.usage.input_tokens + read + written, outputTokens: message.usage.output_tokens, cacheReadTokens: read, cacheWriteTokens: written },
  };
}

export function createAnthropicProvider(config: ProviderConfig): AIProvider {
  const client = new Anthropic({ apiKey: config.apiKey, timeout: 180_000, maxRetries: 2 });
  const fallback = FALLBACK_MODELS.has(config.model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {};

  async function send(input: AITextRequest, schema?: Record<string, unknown>): Promise<AITextResponse> {
    try {
      const message = await client.beta.messages.create({
        model: config.model,
        max_tokens: input.maxOutputTokens,
        system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }],
        messages: input.messages,
        ...(schema ? { output_config: { format: { type: "json_schema", schema } } } : {}),
        ...fallback,
      });
      return toResponse(message);
    } catch (error) {
      throw mapError(error);
    }
  }

  return {
    id: "ANTHROPIC",
    model: config.model,
    generateText: (input) => send(input),
    async generateStructured(input: AIStructuredRequest) {
      const response = await send(input, input.jsonSchema);
      return { ...response, json: parseJsonReply(response.text) };
    },
  };
}
