import { z } from "zod";
import { DomainError, ForbiddenError } from "../../../core/errors";
import type { ServiceContext } from "../../../core/database/tx";
import { assertCapability } from "../../../core/permissions/capabilities";
import { AiError } from "../providers/errors";
import { createProvider } from "../providers/registry";
import { enquiryDraftPrompt } from "../prompts/registry";
import { loadActiveProviderConfig } from "../queries";
import { createEnquiryFromChatSchema, enquiryChatTurnSchema, enquiryDraftReplySchema, type CreateEnquiryFromChatInput, type EnquiryChatTurnInput } from "../schemas";
import { recordExecution } from "../service";
import { draftEnquiryTool, type DraftEnquiryOutput } from "../tools/draft-enquiry";
import { runTool } from "../tools/registry";
import { Budget } from "./budget";
import { generateValidated } from "./generate";

/**
 * The enquiry intake chat (docs/ai-intelligence/agents.md, Enquiry agent). One function per turn, plus the explicit create step.
 * The model only words the reply and compiles the request text; it cannot save anything. Saving happens in `createEnquiryFromChat`, which
 * runs only when a person presses the button. Every run is written to the execution log.
 */

const INTENT = "CAPTURE_ENQUIRY";

export type EnquiryChatTurn = {
  executionId: string;
  reply: string;
  status: "GATHERING" | "READY";
  missing: string[];
  quickReplies: string[];
  summary: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
};

const emailOrNull = (value: string | null) => (value && z.email().safeParse(value).success ? value : null);
const blankToNull = (value: string | null) => (value && value.trim() ? value.trim() : null);

function failureCode(error: unknown): string {
  return error instanceof AiError ? error.aiCode : error instanceof ForbiddenError ? "FORBIDDEN" : "UNKNOWN";
}

/** One turn: the conversation so far plus the new message in, the next reply (and, when ready, the compiled request) out. */
export async function runEnquiryDraftTurn(ctx: ServiceContext, rawInput: EnquiryChatTurnInput): Promise<EnquiryChatTurn> {
  const started = Date.now();
  const input = enquiryChatTurnSchema.parse(rawInput);
  const budget = new Budget();
  let config: Awaited<ReturnType<typeof loadActiveProviderConfig>> = null;
  let promptVersion: string | null = null;
  let repairAttempted = false;
  let outputSummary: string | null = null;

  const record = (status: "SUCCEEDED" | "FAILED", errorCode: string | null) => {
    const called = budget.providerCalls > 0 && config !== null;
    return recordExecution(ctx, {
      intent: INTENT,
      status,
      errorCode,
      provider: called ? config!.provider : null,
      model: called ? (budget.servedModel ?? config!.model) : null,
      promptVersion: called ? promptVersion : null,
      entity: null,
      question: input.message,
      outputSummary,
      confidenceScore: null,
      toolCalls: 0,
      providerCalls: budget.providerCalls,
      evidenceCount: 0,
      repairAttempted,
      inputTokens: budget.inputTokens,
      outputTokens: budget.outputTokens,
      cacheReadTokens: budget.cacheReadTokens,
      cacheWriteTokens: budget.cacheWriteTokens,
      latencyMs: Date.now() - started,
    });
  };

  try {
    assertCapability(ctx, "ai.use", "You do not have access to the assistant.");
    config = await loadActiveProviderConfig();
    if (!config) throw new AiError("NO_PROVIDER");
    const provider = createProvider(config);

    // The provider expects the conversation to open with the person's message; the panel's greeting is never sent.
    const history = [...input.history];
    while (history[0]?.role === "assistant") history.shift();
    const prompt = enquiryDraftPrompt({ history, message: input.message });
    promptVersion = prompt.version;

    const result = await generateValidated(provider, prompt, enquiryDraftReplySchema, {
      schemaName: "enquiry_draft",
      allowRepair: budget.roomForRepair(),
      meter: { beforeCall: () => budget.useProvider(), afterCall: (usage, model) => budget.meter(usage, model) },
    });
    repairAttempted = result.repairAttempted;
    const value = result.value;
    outputSummary = `${value.status}, ${value.missing.length} missing`;

    const execution = await record("SUCCEEDED", null);
    return {
      executionId: execution.id,
      reply: value.reply,
      status: value.status,
      missing: value.missing,
      quickReplies: value.quickReplies,
      summary: value.status === "READY" ? value.summary : null,
      requesterName: blankToNull(value.requesterName),
      requesterEmail: emailOrNull(value.requesterEmail),
    };
  } catch (error) {
    try {
      await record("FAILED", failureCode(error));
    } catch (logError) {
      console.error("[ai] could not record a failed execution:", logError);
    }
    if (error instanceof DomainError) throw error;
    console.error("[ai] unexpected error in the enquiry chat:", error);
    throw new AiError("UNKNOWN");
  }
}

/** The person pressed "Create enquiry draft". Saves the compiled request through the draft_enquiry tool; no model is called. */
export async function createEnquiryFromChat(ctx: ServiceContext, rawInput: CreateEnquiryFromChatInput): Promise<DraftEnquiryOutput> {
  const started = Date.now();
  const input = createEnquiryFromChatSchema.parse(rawInput);
  const budget = new Budget();
  let created: DraftEnquiryOutput | null = null;

  const record = (status: "SUCCEEDED" | "FAILED", errorCode: string | null) =>
    recordExecution(ctx, {
      intent: `${INTENT}_CREATE`,
      status,
      errorCode,
      provider: null,
      model: null,
      promptVersion: null,
      entity: created ? { type: "Enquiry", id: created.enquiryId } : null,
      question: input.summary,
      outputSummary: created ? `${created.reference}, ${created.itemCount} requirements proposed` : null,
      confidenceScore: null,
      toolCalls: budget.toolCalls,
      providerCalls: 0,
      evidenceCount: 0,
      repairAttempted: false,
      inputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      latencyMs: Date.now() - started,
    });

  try {
    assertCapability(ctx, "ai.use", "You do not have access to the assistant.");
    created = await runTool(draftEnquiryTool, { summary: input.summary, requesterName: input.requesterName, requesterEmail: input.requesterEmail }, ctx, budget);
  } catch (error) {
    try {
      await record("FAILED", failureCode(error));
    } catch (logError) {
      console.error("[ai] could not record a failed execution:", logError);
    }
    throw error;
  }

  // The enquiry exists now; a failure to log must not turn that into an error for the person.
  try {
    await record("SUCCEEDED", null);
  } catch (logError) {
    console.error("[ai] could not record the execution:", logError);
  }
  return created;
}
