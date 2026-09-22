import type { ServiceContext } from "../../../core/database/tx";
import { assertCapability } from "../../../core/permissions/capabilities";
import type { Budget } from "../orchestrator/budget";
import { searchProductsTool } from "./search-products";
import type { AIToolDefinition } from "./types";

/** Every tool the AI layer can use. Static: adding a tool is a code change with its own plan, never something a model can do. */
export const TOOLS = {
  search_products: searchProductsTool,
} as const;

export type ToolName = keyof typeof TOOLS;

/** Runs one tool: counts it against the request's budget, validates the input, checks capabilities, then executes. */
export async function runTool<I, O>(tool: AIToolDefinition<I, O>, rawInput: unknown, ctx: ServiceContext, budget: Budget): Promise<O> {
  budget.useTool();
  const input = tool.inputSchema.parse(rawInput);
  for (const capability of tool.requiredCapabilities) assertCapability(ctx, capability, "You do not have access to the information this question needs.");
  return tool.execute(input, ctx);
}
