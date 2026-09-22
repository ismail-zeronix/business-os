import { db } from "../../core/database/client";
import type { Prisma } from "../../generated/prisma/client";
import { PAGE_SIZE } from "../../lib/search-params";
import type { AuditEntityType } from "./types";

export type AuditRow = {
  id: string;
  createdAt: Date;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  scopeType: string | null;
  scopeId: string | null;
  details: unknown;
};

const auditSelect = {
  id: true,
  createdAt: true,
  action: true,
  entityType: true,
  entityId: true,
  scopeType: true,
  scopeId: true,
  details: true,
  actor: { select: { name: true } },
} satisfies Prisma.AuditLogSelect;

type AuditRecord = Prisma.AuditLogGetPayload<{ select: typeof auditSelect }>;

const toRow = (r: AuditRecord): AuditRow => ({
  id: r.id,
  createdAt: r.createdAt,
  actorName: r.actor?.name ?? null,
  action: r.action,
  entityType: r.entityType,
  entityId: r.entityId,
  scopeType: r.scopeType,
  scopeId: r.scopeId,
  details: r.details,
});

/** Users who appear as actors, for the Audit filter. */
export async function listActorOptions() {
  const users = await db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return users.map((u) => ({ value: u.id, label: u.name }));
}

/**
 * Activity for one entity: changes to the entity itself PLUS changes scoped to it (a supplier's activity includes its contacts;
 * a broadcast's includes its items and observations). Newest first.
 */
export async function listActivity(entity: { type: AuditEntityType; id: string }, limit = 100): Promise<AuditRow[]> {
  const rows = await db.auditLog.findMany({
    where: { OR: [{ entityType: entity.type, entityId: entity.id }, { scopeType: entity.type, scopeId: entity.id }] },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: auditSelect,
  });
  return rows.map(toRow);
}

export type AuditListParams = { entityType?: string; actorId?: string; from?: Date; to?: Date; page: number };

/** The global Audit page: paginated, newest first, filterable by entity type, actor and date range. */
export async function listAudit(params: AuditListParams): Promise<{ rows: AuditRow[]; total: number }> {
  const where: Prisma.AuditLogWhereInput = {
    ...(params.entityType ? { entityType: params.entityType } : {}),
    ...(params.actorId ? { actorId: params.actorId } : {}),
    ...(params.from || params.to ? { createdAt: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lt: params.to } : {}) } } : {}),
  };
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (params.page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: auditSelect }),
    db.auditLog.count({ where }),
  ]);
  return { rows: rows.map(toRow), total };
}
