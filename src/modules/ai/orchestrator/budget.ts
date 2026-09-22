import { AiError } from "../providers/errors";
import type { AIUsage } from "../providers/types";

/** Per-request ceiling on work, so one question can never loop or spend without bound. */
export const MAX_TOOL_CALLS = 4;
export const MAX_PROVIDER_CALLS = 3;

/**
 * Counts one request's tool and provider calls against the ceiling, and meters what the provider calls cost. Counting happens per call
 * (not per result) so a request that fails halfway is still logged with what it actually did.
 */
export class Budget {
  toolCalls = 0;
  providerCalls = 0;
  inputTokens: number | null = null;
  outputTokens: number | null = null;
  cacheReadTokens: number | null = null;
  cacheWriteTokens: number | null = null;
  /** The model that served the last provider call. */
  servedModel: string | null = null;

  useTool(): void {
    if (this.toolCalls >= MAX_TOOL_CALLS) throw new AiError("BUDGET");
    this.toolCalls += 1;
  }

  useProvider(): void {
    if (this.providerCalls >= MAX_PROVIDER_CALLS) throw new AiError("BUDGET");
    this.providerCalls += 1;
  }

  /** True when a call and its repair retry both still fit. */
  roomForRepair(): boolean {
    return this.providerCalls + 2 <= MAX_PROVIDER_CALLS;
  }

  meter(usage: AIUsage, model: string): void {
    if (usage.inputTokens !== null) this.inputTokens = (this.inputTokens ?? 0) + usage.inputTokens;
    if (usage.outputTokens !== null) this.outputTokens = (this.outputTokens ?? 0) + usage.outputTokens;
    if (usage.cacheReadTokens !== null) this.cacheReadTokens = (this.cacheReadTokens ?? 0) + usage.cacheReadTokens;
    if (usage.cacheWriteTokens !== null) this.cacheWriteTokens = (this.cacheWriteTokens ?? 0) + usage.cacheWriteTokens;
    this.servedModel = model;
  }
}
