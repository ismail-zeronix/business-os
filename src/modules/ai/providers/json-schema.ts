import { z } from "zod";
import { AiError } from "./errors";

/**
 * One JSON Schema per request, used unchanged by every provider. Structured output on all three providers needs: every object closed
 * (`additionalProperties: false`), every property required (optional values are modelled as nullable in zod), and no range or length
 * keywords (Claude rejects them; OpenAI strict mode and Gemini support differs). Those constraints stay in the zod schema, which
 * validates the reply afterwards, so nothing is lost by stripping them here.
 */

const STRIPPED_KEYWORDS = new Set([
  "$schema",
  "$id",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minItems",
  "maxItems",
  "uniqueItems",
  "pattern",
  "format",
  "default",
]);

function strictify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictify);
  if (!node || typeof node !== "object") return node;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (STRIPPED_KEYWORDS.has(key)) continue;
    out[key] = key === "properties" && value && typeof value === "object" ? mapValues(value as Record<string, unknown>) : strictify(value);
  }
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    out.required = Object.keys(out.properties);
    out.additionalProperties = false;
  }
  return out;
}

function mapValues(properties: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(properties).map(([name, schema]) => [name, strictify(schema)]));
}

export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return strictify(z.toJSONSchema(schema, { io: "input", unrepresentable: "throw" })) as Record<string, unknown>;
}

/** The reply text of a structured call as JSON. A reply that is not JSON at all is INVALID_OUTPUT, the same for every provider. */
export function parseJsonReply(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new AiError("INVALID_OUTPUT");
  }
}
