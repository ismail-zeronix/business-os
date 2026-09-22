import { db } from "../../core/database/client";
import type { Prisma } from "../../generated/prisma/client";
import type { EnquiryPriority, EnquiryStatus, EvidenceChannel } from "../../generated/prisma/enums";
import { escapeLike } from "../../lib/like";
import { PAGE_SIZE } from "../../lib/search-params";
import { findMatchCandidates } from "../products/matching";

export type EnquiryView = "attention" | "new" | "sourcing" | "waiting" | "quote" | "all" | "archived";
export const ENQUIRY_VIEWS: readonly EnquiryView[] = ["attention", "new", "sourcing", "waiting", "quote", "all", "archived"];

export type EnquiryListParams = {
  view: EnquiryView;
  page: number;
  q?: string;
  customerId?: string;
  /** Multi-value filters from the filter pills. Empty or absent = no restriction. */
  statuses?: EnquiryStatus[];
  priorities?: EnquiryPriority[];
  channels?: EvidenceChannel[];
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
function filterWhere(params: FilterParams): Prisma.EnquiryWhereInput {
  const q = params.q?.trim();
  const contains = (value: string) => ({ contains: escapeLike(value), mode: "insensitive" as const });
  const number = q ? /^ENQ-?0*(\d+)$/i.exec(q)?.[1] : undefined;

  return {
    AND: [
      params.customerId ? { customerId: params.customerId } : {},
      params.statuses?.length ? { status: { in: params.statuses } } : {},
      params.priorities?.length ? { priority: { in: params.priorities } } : {},
      params.channels?.length ? { evidenceSource: { channel: { in: params.channels } } } : {},
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
export async function countEnquiriesByView(params: FilterParams): Promise<Record<EnquiryView, number>> {
  const filters = filterWhere(params);
  const counts = await Promise.all(ENQUIRY_VIEWS.map((view) => db.enquiry.count({ where: { AND: [viewWhere(view), filters] } })));
  return Object.fromEntries(ENQUIRY_VIEWS.map((view, index) => [view, counts[index]!])) as Record<EnquiryView, number>;
}

/** Server-side filtered, paginated enquiry list, newest request first (by when the customer sent it). */
export async function listEnquiries(params: EnquiryListParams): Promise<{ rows: EnquiryListRow[]; total: number }> {
  const where: Prisma.EnquiryWhereInput = { AND: [viewWhere(params.view), filterWhere(params)] };

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
        customer: { select: { name: true } },
        evidenceSource: { select: { observedAt: true, channel: true } },
        items: { orderBy: { position: "asc" }, select: { reviewStatus: true, description: true, modelText: true } },
      },
    }),
    db.enquiry.count({ where }),
  ]);

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
    })),
  };
}

/** Work queue for the Overview: open enquiries that are new or still have requirements to review. */
export async function listEnquiriesNeedingAttention(limit = 8): Promise<EnquiryListRow[]> {
  return (await listEnquiries({ view: "attention", page: 1 })).rows.slice(0, limit);
}

/** Everything the enquiry workspace needs: the immutable evidence, customer/contact/owner, and all requirements with their linked product. */
export async function getEnquiry(id: string) {
  return db.enquiry.findUnique({
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
        include: { product: { select: { id: true, name: true, partNumber: true, status: true, brandId: true, brand: { select: { name: true } } } } },
      },
      _count: { select: { supplierRequests: true } },
    },
  });
}

export type EnquiryDetail = NonNullable<Awaited<ReturnType<typeof getEnquiry>>>;

/** Suggested products for one requirement (computed on demand for the item being reviewed, never stored). */
export async function getEnquiryItemCandidates(item: { partNumber: string | null; modelText: string | null; brandText: string | null; description: string | null }) {
  return findMatchCandidates(db, { partNumber: item.partNumber, model: item.modelText, brandText: item.brandText, description: item.description });
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
