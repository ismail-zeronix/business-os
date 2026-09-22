import type { ServiceContext } from "../../core/database/tx";
import type { AuditEntry } from "./types";

/**
 * Writes one audit row. Call it with the SAME ctx.db as the change it describes (i.e. inside the same transaction),
 * so an audited change and its audit row commit or roll back together. There is no hidden ORM middleware: audit is explicit.
 */
export async function writeAudit(ctx: ServiceContext, entry: AuditEntry): Promise<void> {
  await ctx.db.auditLog.create({
    data: {
      actorId: ctx.actor.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      scopeType: entry.scope?.type ?? null,
      scopeId: entry.scope?.id ?? null,
      details: entry.details,
    },
  });
}
