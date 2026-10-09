import { db } from "../../core/database/client";
import type { Prisma } from "../../generated/prisma/client";
import type { TaskLinkType, TaskPriority, TaskStatus } from "../../generated/prisma/enums";
import { PAGE_SIZE } from "../../lib/search-params";
import { countDerivedEmailTasks, listDerivedEmailTasks } from "./derived-email";
import { countDerivedEnquiryTasks, listDerivedEnquiryTasks } from "./derived-enquiry";
import { compareUnifiedTasks } from "./rank";
import { resolveUrgency, type TaskUrgency } from "./urgency";
import type { DerivedTask } from "./types";

/**
 * The read side of task management: manual Task rows merged with the live Enquiry/Email rules (derived-*.ts) into one
 * list and one set of counts, so the "Open" tab, the tab counts and the sidebar/topbar badge can never disagree.
 */

export type TaskAssigneeFilter = "all" | "mine" | "unassigned";
export type TaskStatusFilter = "open" | "done" | "cancelled";
export type TaskListParams = { status: TaskStatusFilter; assignee: TaskAssigneeFilter; page: number };

export type UnifiedTaskRow = {
  id: string;
  origin: "manual" | "derived";
  title: string;
  description: string | null;
  status: TaskStatus | null;
  priority: TaskPriority;
  urgency: TaskUrgency;
  dueAt: Date | null;
  anchorAt: Date;
  assignedTo: { id: string; name: string } | null;
  linkedType: TaskLinkType | null;
  linkedId: string | null;
  href: string;
};

/** "mine" needs the current user's id; "unassigned"/"all" don't. Same shape as email/queries.ts's own assigneeWhere -
 *  Enquiry, EmailMessage and Task all carry an advisory, nullable assignedToId, so one helper serves all three. */
function assigneeWhere(assignee: TaskAssigneeFilter, currentUserId: string | undefined): { assignedToId?: string | null } {
  if (assignee === "unassigned") return { assignedToId: null };
  if (assignee === "mine") return { assignedToId: currentUserId ?? "__none__" };
  return {};
}

const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueAt: true,
  linkedType: true,
  linkedId: true,
  createdAt: true,
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.TaskSelect;

type TaskRow = Prisma.TaskGetPayload<{ select: typeof TASK_SELECT }>;

function toManualRow(task: TaskRow, now: Date): UnifiedTaskRow {
  return {
    id: task.id,
    origin: "manual",
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    urgency: resolveUrgency(task.dueAt, task.createdAt, now),
    dueAt: task.dueAt,
    anchorAt: task.createdAt,
    assignedTo: task.assignedTo,
    linkedType: task.linkedType,
    linkedId: task.linkedId,
    href: `/tasks?task=${task.id}`,
  };
}

function toDerivedRow(task: DerivedTask): UnifiedTaskRow {
  return {
    id: task.id,
    origin: "derived",
    title: task.title,
    description: null,
    status: null,
    priority: task.priority,
    urgency: task.urgency,
    dueAt: task.dueAt,
    anchorAt: task.anchorAt,
    assignedTo: task.assignedTo,
    linkedType: task.linkedType,
    linkedId: task.linkedId,
    href: task.href,
  };
}

/**
 * Server-side filtered, paginated task list. "Done"/"Cancelled" are plain Task queries (derived rows never appear
 * there - there is nothing to be "done"). "Open" merges manual OPEN rows with the live derived rules, sorted by
 * urgency then priority then age, and paginated in memory - an accepted trade-off at this app's real scale (dozens
 * to low hundreds of open items company-wide), not a scaling plan.
 */
export async function listTasks(params: TaskListParams, currentUserId?: string): Promise<{ rows: UnifiedTaskRow[]; total: number }> {
  const assignee = assigneeWhere(params.assignee, currentUserId);
  const now = new Date();

  if (params.status !== "open") {
    const status: TaskStatus = params.status === "done" ? "DONE" : "CANCELLED";
    const where: Prisma.TaskWhereInput = { AND: [{ status }, assignee] };
    const [tasks, total] = await Promise.all([
      db.task.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (params.page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: TASK_SELECT }),
      db.task.count({ where }),
    ]);
    return { total, rows: tasks.map((t) => toManualRow(t, now)) };
  }

  const [manual, derivedEnquiry, derivedEmail] = await Promise.all([
    db.task.findMany({ where: { AND: [{ status: "OPEN" }, assignee] }, select: TASK_SELECT }),
    listDerivedEnquiryTasks(assignee, now),
    listDerivedEmailTasks(assignee, now),
  ]);
  const rows = [...manual.map((t) => toManualRow(t, now)), ...derivedEnquiry.map(toDerivedRow), ...derivedEmail.map(toDerivedRow)].sort(compareUnifiedTasks);
  const total = rows.length;
  return { total, rows: rows.slice((params.page - 1) * PAGE_SIZE, params.page * PAGE_SIZE) };
}

/** Counts for the Open/Done/Cancelled tabs - the same where-clauses listTasks uses, so the numbers always match a click. */
export async function countTasksByStatus(assignee: TaskAssigneeFilter, currentUserId?: string): Promise<Record<TaskStatusFilter, number>> {
  const filter = assigneeWhere(assignee, currentUserId);
  const [manualOpen, derivedEnquiry, derivedEmail, done, cancelled] = await Promise.all([
    db.task.count({ where: { AND: [{ status: "OPEN" }, filter] } }),
    countDerivedEnquiryTasks(filter),
    countDerivedEmailTasks(filter),
    db.task.count({ where: { AND: [{ status: "DONE" }, filter] } }),
    db.task.count({ where: { AND: [{ status: "CANCELLED" }, filter] } }),
  ]);
  return { open: manualOpen + derivedEnquiry + derivedEmail, done, cancelled };
}

/** The signed-in person's own open work (manual + derived), for the sidebar/topbar badge - "my work", not "everyone's". */
export async function countTasksForActor(userId: string): Promise<number> {
  return (await countTasksByStatus("mine", userId)).open;
}

/** Manual tasks linked to one entity (an Enquiry/Customer/EmailMessage detail page's "Tasks" panel). Derived rows are
 *  never included here - the entity's own page already shows the state they're computed from. */
export async function listTasksForEntity(linkedType: TaskLinkType, linkedId: string): Promise<UnifiedTaskRow[]> {
  const now = new Date();
  const tasks = await db.task.findMany({ where: { linkedType, linkedId }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], select: TASK_SELECT });
  return tasks.map((t) => toManualRow(t, now));
}

export type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: Date | null;
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  createdAt: Date;
  completedAt: Date | null;
  completedBy: { name: string } | null;
  cancelledAt: Date | null;
  cancelledBy: { name: string } | null;
  cancelledReason: string | null;
  linked: { type: TaskLinkType; id: string; label: string; href: string } | null;
};

async function resolveLink(linkedType: TaskLinkType | null, linkedId: string | null): Promise<TaskDetail["linked"]> {
  if (!linkedType || !linkedId) return null;
  if (linkedType === "ENQUIRY") {
    const enquiry = await db.enquiry.findUnique({ where: { id: linkedId }, select: { number: true } });
    return enquiry ? { type: linkedType, id: linkedId, label: `ENQ-${String(enquiry.number).padStart(5, "0")}`, href: `/enquiries/${linkedId}` } : null;
  }
  if (linkedType === "EMAIL") {
    const email = await db.emailMessage.findUnique({ where: { id: linkedId }, select: { subject: true } });
    return email ? { type: linkedType, id: linkedId, label: email.subject ?? "(no subject)", href: `/enquiries?view=email&email=${linkedId}` } : null;
  }
  const customer = await db.customer.findUnique({ where: { id: linkedId }, select: { name: true } });
  return customer ? { type: linkedType, id: linkedId, label: customer.name, href: `/customers/${linkedId}` } : null;
}

/** Full detail for the `?task=` sheet, including a resolved label and link for whatever it is linked to, if anything. */
export async function getTaskDetail(id: string): Promise<TaskDetail | null> {
  const task = await db.task.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueAt: true,
      linkedType: true,
      linkedId: true,
      createdAt: true,
      completedAt: true,
      cancelledAt: true,
      cancelledReason: true,
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      completedBy: { select: { name: true } },
      cancelledBy: { select: { name: true } },
    },
  });
  if (!task) return null;
  const linked = await resolveLink(task.linkedType, task.linkedId);
  return { ...task, linked };
}
