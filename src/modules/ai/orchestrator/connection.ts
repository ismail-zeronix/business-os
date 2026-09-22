import { AiError } from "../providers/errors";
import { createProvider } from "../providers/registry";
import type { ProviderConfig } from "../providers/types";
import { connectionCheckPrompt } from "../prompts/registry";
import { connectionCheckSchema } from "../schemas";
import { generateValidated } from "./generate";

/** Test connection for Settings > AI: one small structured call. Stores nothing and logs nothing but a sanitised server-side note on failure. */
export async function testProviderConnection(config: ProviderConfig): Promise<{ model: string; latencyMs: number }> {
  const started = Date.now();
  const result = await generateValidated(createProvider(config), connectionCheckPrompt(), connectionCheckSchema, {
    schemaName: "connection_check",
    allowRepair: false,
  });
  if (!result.value.ok) throw new AiError("INVALID_OUTPUT");
  return { model: result.model, latencyMs: Date.now() - started };
}
