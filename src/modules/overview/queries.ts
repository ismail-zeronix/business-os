import { db } from "../../core/database/client";
import type { FreshnessBand } from "../../lib/freshness";
import { viewWhere } from "../enquiries/queries";
import {
  countInPreviousWindow,
  dailyCounts,
  freshnessCounts,
  percentChange,
  pipelineCounts,
  rangeStart,
  winRate,
  type DayCount,
  type OverviewRange,
  type PipelineStage,
} from "./stats";

/**
 * Read queries for the Overview. Reads only: every figure is derived from real records, and each query is one small, indexed read so the
 * page stays fast. Adding a widget later means adding one query here and one entry in the page's card or tab list.
 */

export type QueueCounts = {
  enquiriesToReview: { count: number; oldestAt: Date | null };
  awaitingSupplierReply: { count: number; oldestAt: Date | null };
  broadcastsToReview: { count: number; pendingItems: number };
  emailsToTriage: { count: number; newestAt: Date | null };
};

const TRIAGE_WHERE = { band: { in: ["LIKELY", "REVIEW"] as ("LIKELY" | "REVIEW")[] }, triageStatus: "NEW" as const };

/** The four work queues: how many things wait on a person, and how long the oldest has waited. */
export async function getQueueCounts(): Promise<QueueCounts> {
  const attention = viewWhere("attention");
  const [enquiryCount, oldestEnquiry, requests, broadcastCount, pendingItems, emails] = await Promise.all([
    db.enquiry.count({ where: attention }),
    db.enquiry.findFirst({ where: attention, orderBy: { evidenceSource: { observedAt: "asc" } }, select: { evidenceSource: { select: { observedAt: true } } } }),
    db.supplierRequest.aggregate({ where: { status: "SENT", enquiry: { archivedAt: null } }, _count: true, _min: { sentAt: true } }),
    db.broadcast.count({ where: { archivedAt: null, items: { some: { reviewStatus: "PENDING" } } } }),
    db.broadcastItem.count({ where: { reviewStatus: "PENDING", broadcast: { archivedAt: null } } }),
    db.emailMessage.aggregate({ where: TRIAGE_WHERE, _count: true, _max: { receivedAt: true } }),
  ]);
  return {
    enquiriesToReview: { count: enquiryCount, oldestAt: oldestEnquiry?.evidenceSource.observedAt ?? null },
    awaitingSupplierReply: { count: requests._count, oldestAt: requests._min.sentAt },
    broadcastsToReview: { count: broadcastCount, pendingItems },
    emailsToTriage: { count: emails._count, newestAt: emails._max.receivedAt },
  };
}

export type EnquiryCharts = {
  days: number;
  received: { series: DayCount[]; total: number; changePercent: number | null };
  pipeline: { counts: Record<PipelineStage, number>; total: number; winRate: number | null };
};

/** Enquiries received (by when the customer sent them) in the range: per-day counts, the previous range for comparison, and the stage split. */
export async function getEnquiryCharts(range: OverviewRange, now: Date): Promise<EnquiryCharts> {
  const enquiries = await db.enquiry.findMany({
    where: { archivedAt: null, evidenceSource: { observedAt: { gte: rangeStart(now, range * 2) } } },
    select: { status: true, evidenceSource: { select: { observedAt: true } } },
  });
  const start = rangeStart(now, range).getTime();
  const current = enquiries.filter((e) => e.evidenceSource.observedAt.getTime() >= start);
  const dates = enquiries.map((e) => e.evidenceSource.observedAt);
  const series = dailyCounts(dates, now, range);
  const total = current.length;
  const counts = pipelineCounts(current.map((e) => e.status));
  return {
    days: range,
    received: { series, total, changePercent: percentChange(total, countInPreviousWindow(dates, now, range)) },
    pipeline: { counts, total, winRate: winRate(counts) },
  };
}

export type PriceFreshness = { counts: Record<FreshnessBand, number>; total: number };

/** How old the latest price is for each product and supplier pair (retracted prices ignored). Age is from when the supplier stated it. */
export async function getPriceFreshness(now: Date): Promise<PriceFreshness> {
  const latest = await db.priceObservation.groupBy({ by: ["productId", "supplierId"], where: { retractedAt: null }, _max: { observedAt: true } });
  const dates = latest.map((row) => row._max.observedAt).filter((date): date is Date => date !== null);
  return { counts: freshnessCounts(dates, now), total: dates.length };
}

export type WaitingRequestRow = { id: string; enquiryId: string; enquiryNumber: number; customerName: string | null; supplierName: string; sentAt: Date | null };

/** Sourcing requests sent and not answered yet, longest wait first. */
export async function listWaitingOnSuppliers(limit = 8): Promise<WaitingRequestRow[]> {
  const requests = await db.supplierRequest.findMany({
    where: { status: "SENT", enquiry: { archivedAt: null } },
    orderBy: [{ sentAt: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true, sentAt: true, supplier: { select: { name: true } }, enquiry: { select: { id: true, number: true, customer: { select: { name: true } }, requesterName: true } } },
  });
  return requests.map((r) => ({
    id: r.id,
    enquiryId: r.enquiry.id,
    enquiryNumber: r.enquiry.number,
    customerName: r.enquiry.customer?.name ?? r.enquiry.requesterName,
    supplierName: r.supplier.name,
    sentAt: r.sentAt,
  }));
}
