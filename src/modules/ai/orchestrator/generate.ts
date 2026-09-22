import type { z } from "zod";
import { AiError } from "../providers/errors";
import { toStrictJsonSchema } from "../providers/json-schema";
import type { AIProvider, AIStructuredRequest, AIStructuredResponse, AITextRequest, AIUsage } from "../providers/types";
import { MAX_OUTPUT_TOKENS } from "../prompts/registry";

/**
 * The single place a structured reply is requested and checked, identical for every provider: the same strict schema, the same zod
 * validation, the same extra checks (evidence references, figures), and at most one repair retry that shows the model its errors.
 * After that the request fails with INVALID_OUTPUT: an unchecked answer is never shown.
 */

/** Called before and after every provider call, so counting and metering survive a failure halfway. */
export type CallMeter = { beforeCall(): void; afterCall(usage: AIUsage, model: string): void };

export type Generated<T> = { value: T; model: string; repairAttempted: boolean };

function problemsOf<S extends z.ZodType>(schema: S, json: unknown, check?: (value: z.output<S>) => string[]): { value?: z.output<S>; problems: string[] } {
  const parsed = schema.safeParse(json);
  if (!parsed.success) return { problems: parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".") || "reply"}: ${i.message}`) };
  const problems = check ? check(parsed.data) : [];
  return { value: parsed.data, problems };
}

export async function generateValidated<S extends z.ZodType>(
  provider: AIProvider,
  prompt: Omit<AITextRequest, "maxOutputTokens">,
  schema: S,
  options: { schemaName: string; check?: (value: z.output<S>) => string[]; allowRepair?: boolean; meter?: CallMeter },
): Promise<Generated<z.output<S>>> {
  const request: AIStructuredRequest = { ...prompt, maxOutputTokens: MAX_OUTPUT_TOKENS, schemaName: options.schemaName, jsonSchema: toStrictJsonSchema(schema) };

  const call = async (req: AIStructuredRequest): Promise<AIStructuredResponse> => {
    options.meter?.beforeCall();
    const response = await provider.generateStructured(req);
    options.meter?.afterCall(response.usage, response.model);
    return response;
  };

  const first = await call(request);
  const firstResult = problemsOf(schema, first.json, options.check);
  if (firstResult.problems.length === 0 && firstResult.value !== undefined) return { value: firstResult.value, model: first.model, repairAttempted: false };
  if (options.allowRepair === false) throw new AiError("INVALID_OUTPUT");

  const second = await call({
    ...request,
    messages: [
      ...prompt.messages,
      { role: "assistant", content: first.text },
      {
        role: "user",
        content: `Your reply failed these checks:\n${firstResult.problems.map((p) => `- ${p}`).join("\n")}\nReturn a corrected reply that uses only the evidence provided.`,
      },
    ],
  });
  const secondResult = problemsOf(schema, second.json, options.check);
  if (secondResult.problems.length > 0 || secondResult.value === undefined) throw new AiError("INVALID_OUTPUT");
  return { value: secondResult.value, model: second.model, repairAttempted: true };
}
