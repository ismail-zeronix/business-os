import { db } from "../../core/database/client";
import { decryptSecret, isSecretKeyConfigured } from "../../core/security/secret-box";
import type { AiExecutionStatus, AiProvider } from "../../generated/prisma/enums";
import { AiError } from "./providers/errors";
import type { ProviderConfig } from "./providers/types";

/**
 * Reads for Settings > AI and the orchestrator. The encrypted key is selected ONLY by `loadProviderConfig`, which decrypts it in memory
 * to build a provider on the server. It is never part of a row sent to a page.
 */

export type ProviderSettingRow = { id: string; provider: AiProvider; model: string; isActive: boolean; updatedAt: Date };

export async function listProviderSettings(): Promise<ProviderSettingRow[]> {
  return db.aiProviderSetting.findMany({ orderBy: { provider: "asc" }, select: { id: true, provider: true, model: true, isActive: true, updatedAt: true } });
}

function toConfig(row: { provider: AiProvider; model: string; apiKeyEncrypted: string }): ProviderConfig {
  if (!isSecretKeyConfigured()) throw new AiError("NO_SECRET_KEY");
  try {
    return { provider: row.provider, model: row.model, apiKey: decryptSecret(row.apiKeyEncrypted) };
  } catch {
    // A different APP_SECRET_KEY than the one the key was stored with. The key must be entered again.
    throw new AiError("NO_SECRET_KEY", "The stored AI key cannot be read with the current APP_SECRET_KEY. An admin must enter it again in Settings > AI.");
  }
}

/** The provider the assistant uses now, or null when AI is switched off / not set up. */
export async function loadActiveProviderConfig(): Promise<ProviderConfig | null> {
  const row = await db.aiProviderSetting.findFirst({ where: { isActive: true }, select: { provider: true, model: true, apiKeyEncrypted: true } });
  return row ? toConfig(row) : null;
}

/** A saved provider's config, for Test connection with the stored key. */
export async function loadProviderConfig(id: string): Promise<ProviderConfig | null> {
  const row = await db.aiProviderSetting.findUnique({ where: { id }, select: { provider: true, model: true, apiKeyEncrypted: true } });
  return row ? toConfig(row) : null;
}

export type ExecutionRow = {
  id: string;
  createdAt: Date;
  actorName: string;
  intent: string;
  status: AiExecutionStatus;
  errorCode: string | null;
  provider: AiProvider | null;
  model: string | null;
  promptVersion: string | null;
  inputSummary: string;
  outputSummary: string | null;
  confidenceScore: number | null;
  evidenceCount: number;
  repairAttempted: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  latencyMs: number;
};

export async function listRecentExecutions(limit = 25): Promise<ExecutionRow[]> {
  const rows = await db.aiExecution.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      actor: { select: { name: true } },
      intent: true,
      status: true,
      errorCode: true,
      provider: true,
      model: true,
      promptVersion: true,
      inputSummary: true,
      outputSummary: true,
      confidenceScore: true,
      evidenceCount: true,
      repairAttempted: true,
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheWriteTokens: true,
      latencyMs: true,
    },
  });
  return rows.map(({ actor, confidenceScore, ...row }) => ({ ...row, actorName: actor.name, confidenceScore: confidenceScore === null ? null : Number(confidenceScore) }));
}
