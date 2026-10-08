import type { Prisma } from "../../generated/prisma/client";
import type { TaskLinkType, TaskPriority } from "../../generated/prisma/enums";
import { inTransaction, type Db, type ServiceContext } from "../../core/database/tx";
import { ForbiddenError, InvariantError, NotFoundError, ValidationError } from "../../core/errors";
import { writeAudit } from "../audit/service";
import type { AuditScope } from "../audit/types";

/**
 * Manual task CRUD - the other half of "hybrid" task management (derived-*.ts covers the live, computed half).
 * Thin service, `app -> actions.ts -> service.ts -> Prisma` like every other module.
 */

export type TaskCreateInput = {
  title: string;
  description: string | null;
  priority: TaskPriority;
  dueAt: Date | null;
  assignedToId: string | null;
  linkedType: TaskLinkType | null;
  linkedId: string | null;
};

export type TaskUpdateInput = { id: string; title: string; description: string | null; priority: TaskPriority; dueAt: Date | null };

/**
 * Decision: an ADMIN may assign/reassign a task to anyone; a STAFF member may only claim a task for themselves or
 * release it back to unassigned - they can never hand it to a colleague. Unlike every other assignment in this app
 * (Enquiry, EmailMessage), this is a real, new permission check, matching how the owner described the feature.
 */
function assertSelfAssignOrAdmin(ctx: ServiceContext, assignedToId: string | null): void {
  if (ctx.actor.role === "ADMIN") return;
  if (assignedToId === null || assignedToId === ctx.actor.id) return;
  throw new ForbiddenError("Only an admin can assign a task to someone else.");
}

function scopeFor(linkedType: TaskLinkType | null, linkedId: string | null): AuditScope | undefined {
  if (!linkedType || !linkedId) return undefined;
  if (linkedType === "ENQUIRY") return { type: "Enquiry", id: linkedId };
  if (linkedType === "CUSTOMER") return { type: "Customer", id: linkedId };
  return { type: "EmailMessage", id: linkedId };
}

async function assertLinkedEntityExists(db: Db, linkedType: TaskLinkType, linkedId: string): Promise<void> {
  const row =
    linkedType === "ENQUIRY"
      ? await db.enquiry.findUnique({ where: { id: linkedId }, select: { id: true } })
      : linkedType === "CUSTOMER"
        ? await db.customer.findUnique({ where: { id: linkedId }, select: { id: true } })
        : await db.emailMessage.findUnique({ where: { id: linkedId }, select: { id: true } });
  if (!row) throw new NotFoundError(linkedType === "ENQUIRY" ? "Enquiry" : linkedType === "CUSTOMER" ? "Customer" : "Email");
}

async function assertActiveAssignee(db: Db, assignedToId: string | null): Promise<void> {
  if (!assignedToId) return;
  const user = await db.user.findUnique({ where: { id: assignedToId }, select: { status: true } });
  if (!user || user.status !== "ACTIVE") throw new ValidationError("That person is not available.", { assignedToId: "Choose an active user" });
}

export async function createTask(ctx: ServiceContext, input: TaskCreateInput) {
  assertSelfAssignOrAdmin(ctx, input.assignedToId);
  return inTransaction(ctx, async (c) => {
    if (input.linkedType) await assertLinkedEntityExists(c.db, input.linkedType, input.linkedId!);
    await assertActiveAssignee(c.db, input.assignedToId);
    const task = await c.db.task.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        dueAt: input.dueAt,
        assignedToId: input.assignedToId,
        linkedType: input.linkedType,
        linkedId: input.linkedId,
        createdById: c.actor.id,
      },
    });
    await writeAudit(c, { action: "task.created", entityType: "Task", entityId: task.id, scope: scopeFor(input.linkedType, input.linkedId), details: { title: task.title } });
    return task;
  });
}

/** Title/description/priority/due date. OPEN only - reopen a DONE/CANCELLED task before editing it. */
export async function updateTask(ctx: ServiceContext, input: TaskUpdateInput) {
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.task.findUnique({ where: { id: input.id }, select: { id: true, status: true, title: true, linkedType: true, linkedId: true } });
    if (!existing) throw new NotFoundError("Task");
    if (existing.status !== "OPEN") throw new InvariantError("Reopen the task before editing it.");
    const updated = await c.db.task.update({ where: { id: input.id }, data: { title: input.title, description: input.description, priority: input.priority, dueAt: input.dueAt } });
    await writeAudit(c, {
      action: "task.updated",
      entityType: "Task",
      entityId: updated.id,
      scope: scopeFor(existing.linkedType, existing.linkedId),
      details: { title: { from: existing.title, to: updated.title } },
    });
    return updated;
  });
}

/** One function for assign AND reassign AND release. OPEN only; gated by assertSelfAssignOrAdmin above. */
export async function assignTask(ctx: ServiceContext, input: { id: string; assignedToId: string | null }) {
  assertSelfAssignOrAdmin(ctx, input.assignedToId);
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.task.findUnique({
      where: { id: input.id },
      select: { id: true, status: true, assignedToId: true, assignedTo: { select: { name: true } }, linkedType: true, linkedId: true },
    });
    if (!existing) throw new NotFoundError("Task");
    if (existing.status !== "OPEN") throw new InvariantError("Reopen the task before reassigning it.");
    if (input.assignedToId === existing.assignedToId) return existing;
    await assertActiveAssignee(c.db, input.assignedToId);
    const nextUser = input.assignedToId ? await c.db.user.findUnique({ where: { id: input.assignedToId }, select: { name: true } }) : null;
    const updated = await c.db.task.update({ where: { id: input.id }, data: { assignedToId: input.assignedToId } });
    await writeAudit(c, {
      action: "task.assigned",
      entityType: "Task",
      entityId: updated.id,
      scope: scopeFor(existing.linkedType, existing.linkedId),
      details: { assignee: { from: existing.assignedTo?.name ?? null, to: nextUser?.name ?? null } },
    });
    return updated;
  });
}

type StatusTransition = { status: "DONE"; completedById: string } | { status: "CANCELLED"; cancelledById: string; cancelledReason: string } | { status: "OPEN" };

async function setTaskStatus(ctx: ServiceContext, id: string, next: StatusTransition) {
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.task.findUnique({ where: { id }, select: { id: true, status: true, linkedType: true, linkedId: true } });
    if (!existing) throw new NotFoundError("Task");

    let data: Prisma.TaskUncheckedUpdateInput;
    if (next.status === "DONE") {
      if (existing.status !== "OPEN") throw new InvariantError("Only an open task can be completed.");
      data = { status: "DONE", completedAt: new Date(), completedById: next.completedById, cancelledAt: null, cancelledById: null, cancelledReason: null };
    } else if (next.status === "CANCELLED") {
      if (existing.status !== "OPEN") throw new InvariantError("Only an open task can be cancelled.");
      data = { status: "CANCELLED", cancelledAt: new Date(), cancelledById: next.cancelledById, cancelledReason: next.cancelledReason, completedAt: null, completedById: null };
    } else {
      if (existing.status === "OPEN") return existing;
      data = { status: "OPEN", completedAt: null, completedById: null, cancelledAt: null, cancelledById: null, cancelledReason: null };
    }

    const updated = await c.db.task.update({ where: { id }, data });
    await writeAudit(c, {
      action: "task.status_changed",
      entityType: "Task",
      entityId: id,
      scope: scopeFor(existing.linkedType, existing.linkedId),
      details: { status: { from: existing.status, to: next.status }, ...(next.status === "CANCELLED" ? { reason: next.cancelledReason } : {}) },
    });
    return updated;
  });
}

export async function completeTask(ctx: ServiceContext, input: { id: string }) {
  return setTaskStatus(ctx, input.id, { status: "DONE", completedById: ctx.actor.id });
}

export async function reopenTask(ctx: ServiceContext, input: { id: string }) {
  return setTaskStatus(ctx, input.id, { status: "OPEN" });
}

export async function cancelTask(ctx: ServiceContext, input: { id: string; reason: string }) {
  return setTaskStatus(ctx, input.id, { status: "CANCELLED", cancelledById: ctx.actor.id, cancelledReason: input.reason });
}
