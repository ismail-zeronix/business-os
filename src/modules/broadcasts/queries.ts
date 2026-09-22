import { db } from "../../core/database/client";
import type { Prisma } from "../../generated/prisma/client";
import type { EvidenceChannel } from "../../generated/prisma/enums";
import { PAGE_SIZE } from "../../lib/search-params";
import { findMatchCandidates } from "../products/matching";
import { isItemReady } from "./readiness";

export type BroadcastView = "review" | "all" | "archived";

export type BroadcastListParams = { view: BroadcastView; supplierId?: string; page: number };

export type BroadcastListRow = {
  id: string;
  observedAt: Date;
  channel: EvidenceChannel;
  supplierId: string;
  supplierName: string;
  contactName: string | null;
  createdByName: string;
  archived: boolean;
  counts: { total: number; pending: number; confirmed: number; ignored: number };
};

/** Server-side filtered, paginated broadcast list, newest evidence first. "review" = has at least one pending item. */
export async function listBroadcasts(params: BroadcastListParams): Promise<{ rows: BroadcastListRow[]; total: number }> {
  const where: Prisma.BroadcastWhereInput = {
    ...(params.view === "archived" ? { archivedAt: { not: null } } : { archivedAt: null }),
    ...(params.view === "review" ? { items: { some: { reviewStatus: "PENDING" } } } : {}),
    ...(params.supplierId ? { supplierId: params.supplierId } : {}),
  };

  const [broadcasts, total] = await Promise.all([
    db.broadcast.findMany({
      where,
      orderBy: [{ evidenceSource: { observedAt: "desc" } }, { id: "desc" }],
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        archivedAt: true,
        supplier: { select: { id: true, name: true } },
        contact: { select: { name: true } },
        createdBy: { select: { name: true } },
        evidenceSource: { select: { observedAt: true, channel: true } },
        items: { select: { reviewStatus: true } },
      },
    }),
    db.broadcast.count({ where }),
  ]);

  return {
    total,
    rows: broadcasts.map((b) => ({
      id: b.id,
      observedAt: b.evidenceSource.observedAt,
      channel: b.evidenceSource.channel,
      supplierId: b.supplier.id,
      supplierName: b.supplier.name,
      contactName: b.contact?.name ?? null,
      createdByName: b.createdBy.name,
      archived: b.archivedAt !== null,
      counts: {
        total: b.items.length,
        pending: b.items.filter((i) => i.reviewStatus === "PENDING").length,
        confirmed: b.items.filter((i) => i.reviewStatus === "CONFIRMED").length,
        ignored: b.items.filter((i) => i.reviewStatus === "IGNORED").length,
      },
    })),
  };
}

/** Everything the review workspace needs: the immutable evidence, supplier/contact, and all items with their linked product. */
export async function getBroadcast(id: string) {
  const broadcast = await db.broadcast.findUnique({
    where: { id },
    include: {
      evidenceSource: { select: { id: true, rawText: true, observedAt: true, channel: true, createdAt: true } },
      supplier: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      supplierRequest: { select: { id: true, enquiry: { select: { id: true, number: true } } } },
      items: {
        orderBy: { position: "asc" },
        include: { product: { select: { id: true, name: true, partNumber: true, status: true, brand: { select: { name: true } } } } },
      },
    },
  });
  if (!broadcast) return null;
  // "Confirm N ready items": every PENDING item already linked to an active product, computed here so the page and the
  // action agree on exactly the same set (see readiness.ts).
  const readyItemIds = broadcast.items.filter((i) => i.reviewStatus === "PENDING" && isItemReady(i)).map((i) => i.id);
  return { ...broadcast, readyItemIds };
}

export type BroadcastDetail = NonNullable<Awaited<ReturnType<typeof getBroadcast>>>;

/** Suggested products for one item (computed on demand for the item being reviewed, never stored). */
export async function getItemCandidates(item: { partNumber: string | null; modelText: string | null; brandText: string | null; description: string | null }) {
  return findMatchCandidates(db, { partNumber: item.partNumber, model: item.modelText, brandText: item.brandText, description: item.description });
}

/**
 * Each candidate product's own spec text, from its most recently CONFIRMED item (a person already verified that link, so
 * it's a real fact, not another proposal) — so an ambiguous picker can show *why* two same-named candidates differ (e.g.
 * "15.3\"" vs "15.6\""), not just their names. Candidates are already scoped to one expanded item (a handful at most), so a
 * single ordered query reduced to "first per product" in JS is enough — no need for a DISTINCT ON query.
 */
export async function getCandidateSpecs(productIds: string[]): Promise<Record<string, string>> {
  if (!productIds.length) return {};
  const rows = await db.broadcastItem.findMany({
    where: { productId: { in: productIds }, reviewStatus: "CONFIRMED" },
    orderBy: { confirmedAt: "desc" },
    select: { productId: true, specText: true },
  });
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.specText && r.productId && !out[r.productId]) out[r.productId] = r.specText; // first hit per product = most recent (newest-first order)
  }
  return out;
}

/** Work queue for the Overview: broadcasts that still have pending items. */
export async function listAwaitingReview(limit = 8): Promise<BroadcastListRow[]> {
  return (await listBroadcasts({ view: "review", page: 1 })).rows.slice(0, limit);
}

/** Broadcasts that still have pending items (the sidebar chip). */
export async function countBroadcastsAwaitingReview(): Promise<number> {
  return db.broadcast.count({ where: { archivedAt: null, items: { some: { reviewStatus: "PENDING" } } } });
}

/** How many broadcasts each tab shows (Needs review / All / Archived), for the tab count chips. */
export async function countBroadcastsByView(supplierId?: string): Promise<Record<BroadcastView, number>> {
  const base = supplierId ? { supplierId } : {};
  const [review, all, archived] = await Promise.all([
    db.broadcast.count({ where: { ...base, archivedAt: null, items: { some: { reviewStatus: "PENDING" } } } }),
    db.broadcast.count({ where: { ...base, archivedAt: null } }),
    db.broadcast.count({ where: { ...base, archivedAt: { not: null } } }),
  ]);
  return { review, all, archived };
}
