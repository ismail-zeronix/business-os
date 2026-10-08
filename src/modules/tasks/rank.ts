import type { TaskPriority } from "../../generated/prisma/enums";
import type { TaskUrgency } from "./urgency";

export type RankedTask = { urgency: TaskUrgency; priority: TaskPriority; anchorAt: Date };

const URGENCY_RANK: Record<TaskUrgency, number> = { overdue: 0, aging: 1, normal: 2 };
const PRIORITY_RANK: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

/**
 * How late something is outranks its priority label - an overdue NORMAL task sorts above an on-time URGENT one.
 * Priority is the tie-breaker within the same urgency, and older wins beyond that. Pure and deterministic.
 */
export function compareUnifiedTasks(a: RankedTask, b: RankedTask): number {
  return URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.anchorAt.getTime() - b.anchorAt.getTime();
}
