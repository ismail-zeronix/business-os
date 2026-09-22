import type { z } from "zod";
import type { ServiceContext } from "../../../core/database/tx";
import type { Capability } from "../../../core/permissions/capabilities";

/**
 * A predefined, parameterised capability the orchestrator may call (docs/ai-intelligence/tool-registry.md). The registry is a static
 * list in code: a model can never create a tool, run SQL or reach a table. Every tool validates its input, checks capabilities,
 * returns only what the actor may see, and carries an id for every fact it returns.
 */
export type AIToolDefinition<I, O> = {
  name: string;
  description: string;
  inputSchema: z.ZodType<I, unknown>;
  requiredCapabilities: readonly Capability[];
  execute: (input: I, ctx: ServiceContext) => Promise<O>;
};
