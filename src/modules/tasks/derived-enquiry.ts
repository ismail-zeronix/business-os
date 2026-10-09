import { db } from "../../core/database/client";
import type { Prisma } from "../../generated/prisma/client";
import { urgencyFromAge, urgencyFromDeadline, urgencyFromFixedAge } from "./urgency";
import type { DerivedTask } from "./types";

/**
 * System tasks computed live from Enquiry state - nothing here is stored (src/modules/tasks/types.ts). Each rule's `where`
 * powers both the count and the list (same trick as viewWhere/filterWhere in enquiries/queries.ts), so they can never drift.
 */

const SELECT = {
  id: true,
  number: true,
  priority: true,
  blocker: true,
  requiredBy: true,
  lastActivityAt: true,
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.EnquirySelect;

type EnquiryForRule = Prisma.EnquiryGetPayload<{ select: typeof SELECT }>;

const enquiryReference = (number: number) => `ENQ-${String(number).padStart(5, "0")}`;

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

type EnquiryTaskRule = { code: string; where: Prisma.EnquiryWhereInput; toTask: (e: EnquiryForRule, now: Date) => DerivedTask };

const base = (e: EnquiryForRule, code: string, title: string, urgency: ReturnType<typeof urgencyFromAge>, dueAt: Date | null = null): DerivedTask => ({
  id: `derived:enquiry:${e.id}:${code}`,
  kind: "derived.enquiry",
  title,
  href: `/enquiries/${e.id}`,
  urgency,
  priority: e.priority,
  dueAt,
  anchorAt: e.lastActivityAt,
  assignedTo: e.assignedTo,
  linkedType: "ENQUIRY",
  linkedId: e.id,
});

// Too early to expect a quote before sourcing even starts, so no_quote excludes ASSIGNED on purpose - it never
// fires alongside assigned_no_sourcing for the same enquiry.
const NOT_YET_SOURCING_OR_CLOSED = ["NEW", "ASSIGNED", "WON", "LOST", "ON_HOLD"] as const;

export const ENQUIRY_TASK_RULES: EnquiryTaskRule[] = [
  {
    code: "new_triage",
    where: { status: "NEW", archivedAt: null },
    toTask: (e, now) => base(e, "new_triage", `Triage new enquiry ${enquiryReference(e.number)}`, urgencyFromAge(e.lastActivityAt, now)),
  },
  {
    code: "assigned_no_sourcing",
    where: { status: "ASSIGNED", archivedAt: null },
    toTask: (e, now) => base(e, "assigned_no_sourcing", `Start sourcing for ${enquiryReference(e.number)}`, urgencyFromAge(e.lastActivityAt, now)),
  },
  {
    code: "no_quote",
    where: { status: { notIn: [...NOT_YET_SOURCING_OR_CLOSED] }, archivedAt: null, quotations: { none: {} } },
    toTask: (e, now) =>
      base(
        e,
        "no_quote",
        `Send a quote for ${enquiryReference(e.number)}`,
        e.requiredBy ? urgencyFromDeadline(e.requiredBy, now) : urgencyFromFixedAge(e.lastActivityAt, now, 48, 96),
        e.requiredBy,
      ),
  },
  {
    code: "blocker",
    where: { blocker: { not: null }, archivedAt: null },
    toTask: (e, now) => base(e, "blocker", `Resolve blocker on ${enquiryReference(e.number)}: "${truncate(e.blocker ?? "", 60)}"`, urgencyFromAge(e.lastActivityAt, now)),
  },
  {
    code: "required_by",
    where: { requiredBy: { not: null }, status: { notIn: ["WON", "LOST"] }, archivedAt: null },
    toTask: (e, now) => base(e, "required_by", `${enquiryReference(e.number)} has a required-by date — follow up`, urgencyFromDeadline(e.requiredBy!, now), e.requiredBy),
  },
];

/** One query per rule (each bounded to just that rule's matches, never the whole table), flattened - an enquiry can
 *  legitimately produce more than one row (e.g. no_quote and required_by both firing is two real problems, not a bug). */
export async function listDerivedEnquiryTasks(assigneeWhere: Prisma.EnquiryWhereInput, now: Date = new Date()): Promise<DerivedTask[]> {
  const results = await Promise.all(
    ENQUIRY_TASK_RULES.map((rule) =>
      db.enquiry.findMany({ where: { AND: [rule.where, assigneeWhere] }, select: SELECT }).then((rows) => rows.map((row) => rule.toTask(row, now))),
    ),
  );
  return results.flat();
}

export async function countDerivedEnquiryTasks(assigneeWhere: Prisma.EnquiryWhereInput): Promise<number> {
  const counts = await Promise.all(ENQUIRY_TASK_RULES.map((rule) => db.enquiry.count({ where: { AND: [rule.where, assigneeWhere] } })));
  return counts.reduce((sum, n) => sum + n, 0);
}
