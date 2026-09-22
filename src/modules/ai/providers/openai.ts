import OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import { AiError, logProviderFailure } from "./errors";
import { parseJsonReply } from "./json-schema";
import type { AIProvider, AIStructuredRequest, AITextRequest, AITextResponse, ProviderConfig } from "./types";

/**
 * OpenAI through the official SDK (Chat Completions). Structured output uses `response_format: json_schema` with `strict: true`.
 * No temperature: reasoning models reject it, and consistency comes from the shared prompt and schema.
 */

function mapError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  logProviderFailure("openai", error);
  if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) return new AiError("AUTH");
  // OpenAI answers "no credit left" with the same 429 as a rate limit; only the error code tells them apart.
  if (error instanceof OpenAI.RateLimitError) return new AiError(error.code === "insufficient_quota" || /credits|quota|billing/i.test(error.message) ? "QUOTA" : "RATE_LIMITED");
  if (error instanceof OpenAI.APIConnectionError) return new AiError("UNAVAILABLE");
  if (error instanceof OpenAI.BadRequestError || error instanceof OpenAI.NotFoundError || error instanceof OpenAI.UnprocessableEntityError) {
    return new AiError("BAD_REQUEST");
  }
  if (error instanceof OpenAI.APIError && typeof error.status === "number" && error.status >= 500) return new AiError("UNAVAILABLE");
  return new AiError("UNKNOWN");
}

function toResponse(completion: ChatCompletion): AITextResponse {
  const choice = completion.choices[0];
  if (!choice) throw new AiError("UNKNOWN");
  if (choice.finish_reason === "content_filter" || choice.message.refusal) throw new AiError("REFUSED");
  if (choice.finish_reason === "length") throw new AiError("TRUNCATED");
  return {
    text: choice.message.content ?? "",
    model: completion.model,
    // OpenAI caches long identical prefixes by itself (nothing to mark); prompt_tokens already includes the cached part.
    usage: {
      inputTokens: completion.usage?.prompt_tokens ?? null,
      outputTokens: completion.usage?.completion_tokens ?? null,
      cacheReadTokens: completion.usage?.prompt_tokens_details?.cached_tokens ?? null,
      cacheWriteTokens: null,
    },
  };
}

export function createOpenAIProvider(config: ProviderConfig): AIProvider {
  const client = new OpenAI({ apiKey: config.apiKey, timeout: 180_000, maxRetries: 2 });

  async function send(input: AITextRequest, format?: { name: string; schema: Record<string, unknown> }): Promise<AITextResponse> {
    try {
      const completion = await client.chat.completions.create({
        model: config.model,
        max_completion_tokens: input.maxOutputTokens,
        messages: [{ role: "system", content: input.system }, ...input.messages],
        ...(format ? { response_format: { type: "json_schema", json_schema: { name: format.name, schema: format.schema, strict: true } } } : {}),
      });
      return toResponse(completion);
    } catch (error) {
      throw mapError(error);
    }
  }

  return {
    id: "OPENAI",
    model: config.model,
    generateText: (input) => send(input),
    async generateStructured(input: AIStructuredRequest) {
      const response = await send(input, { name: input.schemaName, schema: input.jsonSchema });
      return { ...response, json: parseJsonReply(response.text) };
    },
  };
}
