import { db } from "../../core/database/client";
import type { Prisma } from "../../generated/prisma/client";
import { urgencyFromAge } from "./urgency";
import type { DerivedTask } from "./types";

/**
 * One system task: an email still waiting for a triage decision. Reuses the exact where-clause behind the existing
 * triage queue's own count (email/queries.ts countEmailTriage) so the two can never disagree about what is pending.
 * "What mail is assigned to me today" is this same rule filtered to assignedToId = me - no second rule needed.
 */
const EMAIL_TRIAGE_WHERE: Prisma.EmailMessageWhereInput = { triageStatus: "NEW", band: { in: ["LIKELY", "REVIEW"] } };

const SELECT = {
  id: true,
  subject: true,
  receivedAt: true,
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.EmailMessageSelect;

type EmailForRule = Prisma.EmailMessageGetPayload<{ select: typeof SELECT }>;

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function toTask(row: EmailForRule, now: Date): DerivedTask {
  return {
    id: `derived:email:${row.id}:email_triage`,
    kind: "derived.email",
    title: `Triage email: "${truncate(row.subject ?? "(no subject)", 60)}"`,
    href: `/enquiries?view=email&email=${row.id}`,
    urgency: urgencyFromAge(row.receivedAt, now),
    priority: "NORMAL",
    dueAt: null,
    anchorAt: row.receivedAt,
    assignedTo: row.assignedTo,
    linkedType: "EMAIL",
    linkedId: row.id,
  };
}

export async function listDerivedEmailTasks(assigneeWhere: Prisma.EmailMessageWhereInput, now: Date = new Date()): Promise<DerivedTask[]> {
  const rows = await db.emailMessage.findMany({ where: { AND: [EMAIL_TRIAGE_WHERE, assigneeWhere] }, select: SELECT });
  return rows.map((row) => toTask(row, now));
}

export async function countDerivedEmailTasks(assigneeWhere: Prisma.EmailMessageWhereInput): Promise<number> {
  return db.emailMessage.count({ where: { AND: [EMAIL_TRIAGE_WHERE, assigneeWhere] } });
}
