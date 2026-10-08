import { db } from "../../core/database/client";
import type { Prisma } from "../../generated/prisma/client";
import type { EnquiryPriority, EnquiryStatus, EvidenceChannel } from "../../generated/prisma/enums";
import { formatRelativeAge } from "../../lib/format";
import { escapeLike } from "../../lib/like";
import { PAGE_SIZE } from "../../lib/search-params";
import { findMatchCandidates } from "../products/matching";
import type { MatchCandidate } from "../products/matching";
import { loadActiveAttributes } from "../products/attributes.service";
import { compareRequirementsToProduct, overallVerdict, toRequirementInput, SPEC_VERDICT_SEVERITY, type PersistedRequirement, type RequirementVerdict, type SpecVerdict } from "../specs/verdict";
import { isEnquiryItemReady } from "./readiness";

export type EnquiryView = "attention" | "new" | "sourcing" | "waiting" | "quote" | "all" | "archived";
export const ENQUIRY_VIEWS: readonly EnquiryView[] = ["attention", "new", "sourcing", "waiting", "quote", "all", "archived"];

export type EnquiryAssigneeFilter = "all" | "mine" | "unassigned";

export type EnquiryListParams = {
  view: EnquiryView;
  page: number;
  q?: string;
  customerId?: string;
  /** Multi-value filters from the filter pills. Empty or absent = no restriction. */
  statuses?: EnquiryStatus[];
  priorities?: EnquiryPriority[];
  channels?: EvidenceChannel[];
  /** Who it's assigned to (Enquiry.assignedToId) - attribution only. "mine" needs the caller's id, passed separately to listEnquiries/countEnquiriesByView (not part of the URL-derived params so it can never be spoofed via a query string). */
  assignee?: EnquiryAssigneeFilter;
  /** Only meaningful when view === "all": also include archived enquiries (selected via the Status filter's "Archived" option) instead of the view's default archivedAt: null. */
  includeArchived?: boolean;
};

/** The part of the list filter that is independent of the tab: search, customer and the three pill filters. */
type FilterParams = Omit<EnquiryListParams, "view" | "page">;

export type EnquiryListRow = {
  id: string;
  number: number;
  status: EnquiryStatus;
  priority: EnquiryPriority;
  observedAt: Date;
  channel: EvidenceChannel;
  customerName: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  subject: string | null;
  /** Descriptions of the first two requirements, for the "Requirement" column. */
  requirements: string[];
  counts: { total: number; pending: number; confirmed: number; ignored: number };
  assignedTo: { id: string; name: string } | null;
  /** Raw free-text next action (Enquiry.nextAction), kept for potential reuse beyond the table. */
  nextAction: string | null;
  /** What the "Next action" column renders: an explicit nextAction if set, otherwise a status-derived hint. null = nothing to show. */
  nextActionDisplay: ReturnType<typeof deriveNextAction>;
};

/** Statuses that mean the enquiry is finished: it no longer "needs attention". */
const CLOSED: EnquiryStatus[] = ["WON", "LOST"];

export function viewWhere(view: EnquiryView): Prisma.EnquiryWhereInput {
  switch (view) {
    case "attention":
      return { archivedAt: null, status: { notIn: CLOSED }, OR: [{ status: "NEW" }, { items: { some: { reviewStatus: "PENDING" } } }] };
    case "new":
      return { archivedAt: null, status: "NEW" };
    case "sourcing":
      return { archivedAt: null, status: "SOURCING" };
    case "waiting":
      return { archivedAt: null, status: "WAITING_SUPPLIER" };
    case "quote":
      return { archivedAt: null, status: "QUOTATION_READY" };
    case "archived":
      return { archivedAt: { not: null } };
    default:
      return { archivedAt: null };
  }
}

/** Search, customer and pill filters as one where-clause. Shared by the list and by the per-tab counts so both always agree. */
function filterWhere(params: FilterParams, currentUserId?: string): Prisma.EnquiryWhereInput {
  const q = params.q?.trim();
  const contains = (value: string) => ({ contains: escapeLike(value), mode: "insensitive" as const });
  const number = q ? /^ENQ-?0*(\d+)$/i.exec(q)?.[1] : undefined;

  return {
    AND: [
      params.customerId ? { customerId: params.customerId } : {},
      params.statuses?.length ? { status: { in: params.statuses } } : {},
      params.priorities?.length ? { priority: { in: params.priorities } } : {},
      params.channels?.length ? { evidenceSource: { channel: { in: params.channels } } } : {},
      params.assignee === "unassigned" ? { assignedToId: null } : {},
      params.assignee === "mine" ? { assignedToId: currentUserId ?? "__none__" } : {},
      q
        ? {
            OR: [
              ...(number ? [{ number: Number(number) }] : []),
              { subject: contains(q) },
              { requesterName: contains(q) },
              { requesterEmail: contains(q) },
              { customer: { name: contains(q) } },
              { items: { some: { OR: [{ description: contains(q) }, { modelText: contains(q) }, { partNumber: contains(q) }, { brandText: contains(q) }] } } },
            ],
          }
        : {},
    ],
  };
}

/**
 * How many enquiries each tab would show with the current search and filters applied. The numbers on the tabs therefore always match
 * what a click will list. One count per tab, run in parallel.
 */
export async function countEnquiriesByView(params: FilterParams, currentUserId?: string): Promise<Record<EnquiryView, number>> {
  const filters = filterWhere(params, currentUserId);
  const counts = await Promise.all(
    ENQUIRY_VIEWS.map((view) => db.enquiry.count({ where: { AND: [view === "all" && params.includeArchived ? {} : viewWhere(view), filters] } })),
  );
  return Object.fromEntries(ENQUIRY_VIEWS.map((view, index) => [view, counts[index]!])) as Record<EnquiryView, number>;
}

/**
 * The "Next action" column's value: an explicit free-text Enquiry.nextAction wins when set, otherwise a status-derived hint computed
 * from the enquiry's own state (never fabricated — null means nothing to show). Pure function so it stays easy to test later.
 */
export function deriveNextAction(
  row: { status: EnquiryStatus; nextAction: string | null; items: { reviewStatus: string; productId: string | null }[]; supplierRequests: { status: string; sentAt: Date | null }[] },
  now: Date,
): { label: string; tone: "amber" | "green" | "violet" | "neutral" } | null {
  if (row.nextAction) return { label: row.nextAction, tone: "neutral" };
  if (row.status === "WAITING_SUPPLIER") {
    if (row.supplierRequests.some((r) => r.status === "REPLIED")) return { label: "Supplier replied", tone: "green" };
    const sent = row.supplierRequests.filter((r) => r.status === "SENT" && r.sentAt).sort((a, b) => a.sentAt!.getTime() - b.sentAt!.getTime())[0];
    if (sent?.sentAt) return { label: `Waiting ${formatRelativeAge(sent.sentAt, now)}`, tone: "violet" };
  }
  if (row.status === "SOURCING") {
    const unmatched = row.items.filter((i) => i.reviewStatus === "CONFIRMED" && i.productId === null).length;
    if (unmatched > 0) return { label: `${unmatched} unmatched`, tone: "amber" };
  }
  if (row.status === "NEW") return { label: "Needs triage", tone: "amber" };
  if (row.status === "QUOTATION_READY") return { label: "Ready to quote", tone: "green" };
  return null;
}

/** Server-side filtered, paginated enquiry list, newest request first (by when the customer sent it). */
export async function listEnquiries(params: EnquiryListParams, currentUserId?: string): Promise<{ rows: EnquiryListRow[]; total: number }> {
  const baseView = params.view === "all" && params.includeArchived ? {} : viewWhere(params.view);
  const where: Prisma.EnquiryWhereInput = { AND: [baseView, filterWhere(params, currentUserId)] };

  const [enquiries, total] = await Promise.all([
    db.enquiry.findMany({
      where,
      orderBy: [{ evidenceSource: { observedAt: "desc" } }, { id: "desc" }],
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        number: true,
        status: true,
        priority: true,
        requesterName: true,
        requesterEmail: true,
        subject: true,
        nextAction: true,
        customer: { select: { name: true } },
        assignedTo: { select: { id: true, name: true } },
        evidenceSource: { select: { observedAt: true, channel: true } },
        items: { orderBy: { position: "asc" }, select: { reviewStatus: true, description: true, modelText: true, productId: true } },
        supplierRequests: { select: { status: true, sentAt: true } },
      },
    }),
    db.enquiry.count({ where }),
  ]);

  const now = new Date();
  return {
    total,
    rows: enquiries.map((e) => ({
      id: e.id,
      number: e.number,
      status: e.status,
      priority: e.priority,
      observedAt: e.evidenceSource.observedAt,
      channel: e.evidenceSource.channel,
      customerName: e.customer?.name ?? null,
      requesterName: e.requesterName,
      requesterEmail: e.requesterEmail,
      subject: e.subject,
      requirements: e.items.map((i) => i.description ?? i.modelText).filter((v): v is string => Boolean(v)).slice(0, 2),
      counts: {
        total: e.items.length,
        pending: e.items.filter((i) => i.reviewStatus === "PENDING").length,
        confirmed: e.items.filter((i) => i.reviewStatus === "CONFIRMED").length,
        ignored: e.items.filter((i) => i.reviewStatus === "IGNORED").length,
      },
      assignedTo: e.assignedTo ? { id: e.assignedTo.id, name: e.assignedTo.name } : null,
      nextAction: e.nextAction,
      nextActionDisplay: deriveNextAction({ status: e.status, nextAction: e.nextAction, items: e.items, supplierRequests: e.supplierRequests }, now),
    })),
  };
}

/** Work queue for the Overview: open enquiries that are new or still have requirements to review. */
export async function listEnquiriesNeedingAttention(limit = 8): Promise<EnquiryListRow[]> {
  return (await listEnquiries({ view: "attention", page: 1 })).rows.slice(0, limit);
}

/** Everything the enquiry workspace needs: the immutable evidence, customer/contact/owner, and all requirements with their linked product. */
export async function getEnquiry(id: string) {
  const enquiry = await db.enquiry.findUnique({
    where: { id },
    include: {
      evidenceSource: { select: { id: true, kind: true, rawText: true, observedAt: true, channel: true, createdAt: true } },
      customer: { select: { id: true, name: true, status: true } },
      contact: { select: { id: true, name: true, email: true, status: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      email: { select: { id: true, rawSize: true, rawSource: false } },
      items: {
        orderBy: { position: "asc" },
        include: {
          product: { select: { id: true, name: true, partNumber: true, status: true, brandId: true, brand: { select: { name: true } } } },
          // Only the requirements in force; the parser's replaced values stay in the database and in the Activity tab.
          requirements: { where: { retractedAt: null }, orderBy: { createdAt: "asc" } },
        },
      },
      _count: { select: { supplierRequests: true } },
    },
  });
  if (!enquiry) return null;
  // "Confirm N ready requirements": every PENDING item that is identified and, if linked, points at an active product,
  // computed here so the page and the action agree on exactly the same set (see readiness.ts).
  const readyItemIds = enquiry.items.filter((i) => i.reviewStatus === "PENDING" && isEnquiryItemReady(i)).map((i) => i.id);
  return { ...enquiry, readyItemIds };
}

export type EnquiryDetail = NonNullable<Awaited<ReturnType<typeof getEnquiry>>>;

/** A match candidate plus how well its own specification satisfies the item's active requirements (src/modules/specs/verdict.ts). */
export type CandidateWithVerdict = MatchCandidate & { overall: SpecVerdict | null; perRequirement: RequirementVerdict[] };

/**
 * Suggested products for one requirement (computed on demand for the item being reviewed, never stored), ranked best spec-match
 * first. Display only: this does not change which product gets auto-linked.
 */
export async function getEnquiryItemCandidates(
  item: { partNumber: string | null; modelText: string | null; brandText: string | null; description: string | null },
  requirements: readonly PersistedRequirement[],
): Promise<CandidateWithVerdict[]> {
  const candidates = await findMatchCandidates(db, { partNumber: item.partNumber, model: item.modelText, brandText: item.brandText, description: item.description });
  if (candidates.length === 0 || requirements.length === 0) return candidates.map((c) => ({ ...c, overall: null, perRequirement: [] }));

  const inputs = requirements.map(toRequirementInput);
  const attributesByProduct = await loadActiveAttributes(db, candidates.map((c) => c.productId));
  const withVerdicts = candidates.map((c) => {
    const perRequirement = compareRequirementsToProduct(inputs, attributesByProduct.get(c.productId) ?? []);
    return { ...c, overall: overallVerdict(perRequirement), perRequirement };
  });
  // Ranking: text-match strength first — an exact part-number match is the strongest identity signal this system has,
  // and an attribute-coverage gap must never bury it below a weaker text match. Spec verdict is the tie-breaker within
  // a strength tier (phase 3's "ranking ... in the candidate list").
  const strengthRank: Record<MatchCandidate["strength"], number> = { EXACT: 2, PROBABLE: 1, POSSIBLE: 0 };
  return withVerdicts.sort(
    (a, b) => strengthRank[b.strength] - strengthRank[a.strength] || SPEC_VERDICT_SEVERITY[b.overall] - SPEC_VERDICT_SEVERITY[a.overall],
  );
}

/** Active users for the "Owner" picker. */
export async function listUserOptions() {
  const users = await db.user.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return users.map((u) => ({ value: u.id, label: u.name }));
}

/**
 * Everything the inbox quick-view panel shows for one enquiry: who and how urgent, the key facts, its requirements and the latest
 * activity. Read-only; no raw text (the workspace has that).
 */
export async function getEnquiryPeek(id: string) {
  const enquiry = await db.enquiry.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      status: true,
      priority: true,
      subject: true,
      requesterName: true,
      requesterEmail: true,
      requiredBy: true,
      deliveryLocation: true,
      blocker: true,
      nextAction: true,
      archivedAt: true,
      customer: { select: { id: true, name: true } },
      contact: { select: { name: true } },
      assignedTo: { select: { name: true } },
      evidenceSource: { select: { observedAt: true, channel: true } },
      items: { orderBy: { position: "asc" }, select: { id: true, position: true, description: true, modelText: true, quantity: true, reviewStatus: true, product: { select: { name: true } } } },
    },
  });
  return enquiry;
}

export type EnquiryPeek = NonNullable<Awaited<ReturnType<typeof getEnquiryPeek>>>;

/** Open enquiries that are new or still have requirements to review (the sidebar chip). */
export async function countEnquiriesNeedingAttention(): Promise<number> {
  return db.enquiry.count({ where: viewWhere("attention") });
}
