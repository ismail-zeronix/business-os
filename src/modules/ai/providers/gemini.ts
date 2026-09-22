import { ApiError, FinishReason, GoogleGenAI, type GenerateContentResponse } from "@google/genai";
import { AiError, logProviderFailure } from "./errors";
import { parseJsonReply } from "./json-schema";
import type { AIProvider, AIStructuredRequest, AITextRequest, AITextResponse, ProviderConfig } from "./types";

/**
 * Google Gemini through the official SDK. Structured output uses `responseMimeType: application/json` with `responseJsonSchema`.
 * No temperature, as for the other providers.
 */

const REFUSAL_REASONS = new Set<FinishReason>([
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
]);

function mapError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  logProviderFailure("gemini", error);
  if (error instanceof ApiError) {
    // Gemini answers an invalid key with 400 INVALID_ARGUMENT, so the message is the only way to tell it from a bad request.
    if (error.status === 401 || error.status === 403 || (error.status === 400 && /api key/i.test(error.message))) return new AiError("AUTH");
    // Gemini reports a per-minute limit and an exhausted plan with the same 429; billing wording means the plan.
    if (error.status === 429) return new AiError(/billing|credit|prepay/i.test(error.message) ? "QUOTA" : "RATE_LIMITED");
    if (error.status === 400 || error.status === 404) return new AiError("BAD_REQUEST");
    if (error.status >= 500) return new AiError("UNAVAILABLE");
    return new AiError("UNKNOWN");
  }
  if (error instanceof TypeError) return new AiError("UNAVAILABLE"); // fetch failed: network or DNS
  return new AiError("UNKNOWN");
}

function toResponse(response: GenerateContentResponse, configuredModel: string): AITextResponse {
  if (response.promptFeedback?.blockReason) throw new AiError("REFUSED");
  const reason = response.candidates?.[0]?.finishReason;
  if (reason && REFUSAL_REASONS.has(reason)) throw new AiError("REFUSED");
  if (reason === FinishReason.MAX_TOKENS) throw new AiError("TRUNCATED");
  const usage = response.usageMetadata;
  const output = usage?.candidatesTokenCount === undefined ? null : usage.candidatesTokenCount + (usage.thoughtsTokenCount ?? 0);
  return {
    text: response.text ?? "",
    model: response.modelVersion ?? configuredModel,
    // Gemini caches implicitly; promptTokenCount already includes the cached part.
    usage: { inputTokens: usage?.promptTokenCount ?? null, outputTokens: output, cacheReadTokens: usage?.cachedContentTokenCount ?? null, cacheWriteTokens: null },
  };
}

export function createGeminiProvider(config: ProviderConfig): AIProvider {
  const client = new GoogleGenAI({ apiKey: config.apiKey, httpOptions: { timeout: 180_000 } });

  async function send(input: AITextRequest, schema?: Record<string, unknown>): Promise<AITextResponse> {
    try {
      const response = await client.models.generateContent({
        model: config.model,
        contents: input.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        config: {
          systemInstruction: input.system,
          maxOutputTokens: input.maxOutputTokens,
          ...(schema ? { responseMimeType: "application/json", responseJsonSchema: schema } : {}),
        },
      });
      return toResponse(response, config.model);
    } catch (error) {
      throw mapError(error);
    }
  }

  return {
    id: "GEMINI",
    model: config.model,
    generateText: (input) => send(input),
    async generateStructured(input: AIStructuredRequest) {
      const response = await send(input, input.jsonSchema);
      return { ...response, json: parseJsonReply(response.text) };
    },
  };
}
