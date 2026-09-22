import { ConflictError, InvariantError, NotFoundError, uniqueViolation } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { assertCapability } from "../../core/permissions/capabilities";
import { encryptSecret, isSecretKeyConfigured } from "../../core/security/secret-box";
import type { AiExecutionStatus, AiProvider } from "../../generated/prisma/enums";
import { AI_PROVIDER_LABEL } from "../../lib/labels";
import { writeAudit } from "../audit/service";
import type { AiProviderActiveInput, AiProviderCreateInput, AiProviderUpdateInput } from "./schemas";

/**
 * AI provider settings and the execution log. SECURITY (ADR 0005, ADR 0007): the key is encrypted before it is stored, is never
 * returned by these services, and never appears in audit details, errors or logs. Audit records only THAT a key changed.
 */

const requireKey = () => {
  if (!isSecretKeyConfigured()) throw new InvariantError("APP_SECRET_KEY is not set, so AI keys cannot be stored safely. Add it to .env (see .env.example) and restart.");
};

const DUPLICATE = "This provider is already set up. Edit it instead.";

export async function createProviderSetting(ctx: ServiceContext, input: AiProviderCreateInput) {
  assertCapability(ctx, "ai.settings.manage");
  requireKey();
  try {
    return await inTransaction(ctx, async (c) => {
      if (await c.db.aiProviderSetting.findUnique({ where: { provider: input.provider }, select: { id: true } })) throw new ConflictError(DUPLICATE);
      // The first provider set up becomes the active one, so the assistant works as soon as one key is saved.
      const isActive = (await c.db.aiProviderSetting.count({ where: { isActive: true } })) === 0;
      const setting = await c.db.aiProviderSetting.create({
        data: { provider: input.provider, model: input.model, apiKeyEncrypted: encryptSecret(input.apiKey), isActive, createdById: ctx.actor.id },
        select: { id: true },
      });
      await writeAudit(c, { action: "ai_provider.created", entityType: "AiProviderSetting", entityId: setting.id, details: { provider: input.provider, model: input.model, active: isActive } });
      return setting;
    });
  } catch (error) {
    if (uniqueViolation(error)) throw new ConflictError(DUPLICATE);
    throw error;
  }
}

export async function updateProviderSetting(ctx: ServiceContext, input: AiProviderUpdateInput) {
  assertCapability(ctx, "ai.settings.manage");
  if (input.apiKey !== undefined) requireKey();
  return inTransaction(ctx, async (c) => {
    // Explicit select: the encrypted key is never loaded here.
    const existing = await c.db.aiProviderSetting.findUnique({ where: { id: input.id }, select: { id: true, model: true } });
    if (!existing) throw new NotFoundError("AI provider");
    const modelChanged = existing.model !== input.model;
    const keyChanged = input.apiKey !== undefined;
    if (!modelChanged && !keyChanged) return { id: input.id };

    await c.db.aiProviderSetting.update({
      where: { id: input.id },
      data: { model: input.model, ...(keyChanged ? { apiKeyEncrypted: encryptSecret(input.apiKey!) } : {}) },
      select: { id: true },
    });
    if (modelChanged) await writeAudit(c, { action: "ai_provider.updated", entityType: "AiProviderSetting", entityId: input.id, details: { model: { from: existing.model, to: input.model } } });
    if (keyChanged) await writeAudit(c, { action: "ai_provider.key_changed", entityType: "AiProviderSetting", entityId: input.id });
    return { id: input.id };
  });
}

/** Make this provider the one the assistant uses (the previous one stops), or switch the assistant off entirely. */
export async function setProviderActive(ctx: ServiceContext, input: AiProviderActiveInput) {
  assertCapability(ctx, "ai.settings.manage");
  return inTransaction(ctx, async (c) => {
    const target = await c.db.aiProviderSetting.findUnique({ where: { id: input.id }, select: { id: true, provider: true, isActive: true } });
    if (!target) throw new NotFoundError("AI provider");
    if (target.isActive === input.active) return { id: target.id };

    if (!input.active) {
      await c.db.aiProviderSetting.update({ where: { id: target.id }, data: { isActive: false }, select: { id: true } });
      await writeAudit(c, { action: "ai_provider.deactivated", entityType: "AiProviderSetting", entityId: target.id, details: { provider: target.provider } });
      return { id: target.id };
    }

    const previous = await c.db.aiProviderSetting.findFirst({ where: { isActive: true }, select: { id: true, provider: true } });
    // Deactivate first: the database allows at most one active row at any moment.
    if (previous) await c.db.aiProviderSetting.update({ where: { id: previous.id }, data: { isActive: false }, select: { id: true } });
    await c.db.aiProviderSetting.update({ where: { id: target.id }, data: { isActive: true }, select: { id: true } });
    await writeAudit(c, {
      action: "ai_provider.activated",
      entityType: "AiProviderSetting",
      entityId: target.id,
      details: { provider: { from: previous ? AI_PROVIDER_LABEL[previous.provider] : null, to: AI_PROVIDER_LABEL[target.provider] } },
    });
    return { id: target.id };
  });
}

export type ExecutionRecord = {
  intent: string;
  status: AiExecutionStatus;
  errorCode: string | null;
  provider: AiProvider | null;
  model: string | null;
  promptVersion: string | null;
  entity: { type: string; id: string } | null;
  question: string;
  outputSummary: string | null;
  confidenceScore: number | null;
  toolCalls: number;
  providerCalls: number;
  evidenceCount: number;
  repairAttempted: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  latencyMs: number;
};

/**
 * One row per assistant run, successful or not. It is itself the record (append-only in the database), so no audit row is written:
 * reading is not a change. The question is cut to 500 characters; nothing else from the evidence is stored.
 */
export async function recordExecution(ctx: ServiceContext, record: ExecutionRecord): Promise<{ id: string }> {
  return ctx.db.aiExecution.create({
    data: {
      actorId: ctx.actor.id,
      intent: record.intent,
      status: record.status,
      errorCode: record.status === "FAILED" ? (record.errorCode ?? "UNKNOWN") : null,
      provider: record.provider,
      model: record.provider ? record.model : null,
      promptVersion: record.promptVersion,
      entityType: record.entity?.type ?? null,
      entityId: record.entity?.id ?? null,
      inputSummary: record.question.slice(0, 500),
      outputSummary: record.outputSummary,
      confidenceScore: record.confidenceScore === null ? null : Math.round(record.confidenceScore * 100) / 100,
      toolCalls: record.toolCalls,
      providerCalls: record.providerCalls,
      evidenceCount: record.evidenceCount,
      repairAttempted: record.repairAttempted,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      cacheReadTokens: record.cacheReadTokens,
      cacheWriteTokens: record.cacheWriteTokens,
      latencyMs: Math.max(0, Math.round(record.latencyMs)),
    },
    select: { id: true },
  });
}
