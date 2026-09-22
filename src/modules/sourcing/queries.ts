import { db } from "../../core/database/client";
import { normalizeName } from "../../lib/normalize";
import { getProductsIntelligence, type SupplierIntelligenceRow } from "../observations/procurement-queries";

/** Everything the Sourcing tab shows for an enquiry's requests. */
export async function listRequestsForEnquiry(enquiryId: string) {
  return db.supplierRequest.findMany({
    where: { enquiryId },
    orderBy: { createdAt: "asc" },
    include: {
      supplier: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      sentBy: { select: { name: true } },
      replies: {
        orderBy: { createdAt: "desc" },
        select: { id: true, archivedAt: true, evidenceSource: { select: { observedAt: true } }, _count: { select: { items: true } } },
      },
    },
  });
}

export type SupplierRequestRow = Awaited<ReturnType<typeof listRequestsForEnquiry>>[number];

export type SupplierSuggestion = { supplierId: string; name: string; reasons: string[]; latestObservedAt: Date | null };

/**
 * Who could be asked, for the enquiry's CONFIRMED requirements: suppliers with a latest price or stock for a linked product (freshest first),
 * then active suppliers who handle the requirement's brand. Suppliers already on the enquiry are left out. Read-only; nothing is stored.
 */
export async function getSupplierSuggestions(enquiryId: string, limit = 12): Promise<SupplierSuggestion[]> {
  const [items, asked] = await Promise.all([
    db.enquiryItem.findMany({ where: { enquiryId, reviewStatus: "CONFIRMED" }, select: { productId: true, brandText: true, product: { select: { brandId: true } } } }),
    db.supplierRequest.findMany({ where: { enquiryId }, select: { supplierId: true } }),
  ]);
  const alreadyAsked = new Set(asked.map((r) => r.supplierId));
  const suggestions = new Map<string, SupplierSuggestion>();

  const productIds = [...new Set(items.map((i) => i.productId).filter((id): id is string => Boolean(id)))];
  const offers: Map<string, SupplierIntelligenceRow[]> = productIds.length ? await getProductsIntelligence(productIds) : new Map();
  for (const rows of offers.values()) {
    for (const row of rows) {
      if (alreadyAsked.has(row.supplierId)) continue;
      const current = suggestions.get(row.supplierId) ?? { supplierId: row.supplierId, name: row.supplierName, reasons: ["has a price or stock on record"], latestObservedAt: null };
      if (!current.latestObservedAt || row.latestObservedAt > current.latestObservedAt) current.latestObservedAt = row.latestObservedAt;
      suggestions.set(row.supplierId, current);
    }
  }

  const brandIds = new Set(items.map((i) => i.product?.brandId).filter((id): id is string => Boolean(id)));
  const brandTexts = [...new Set(items.filter((i) => !i.product?.brandId && i.brandText).map((i) => normalizeName(i.brandText as string)))];
  if (brandTexts.length) {
    for (const brand of await db.brand.findMany({ where: { normalizedName: { in: brandTexts } }, select: { id: true } })) brandIds.add(brand.id);
  }
  if (brandIds.size) {
    const ids = [...brandIds];
    const covering = await db.supplier.findMany({
      where: { status: "ACTIVE", brands: { some: { brandId: { in: ids } } } },
      select: { id: true, name: true, brands: { where: { brandId: { in: ids } }, select: { brand: { select: { name: true } } } } },
    });
    for (const supplier of covering) {
      if (alreadyAsked.has(supplier.id)) continue;
      const current = suggestions.get(supplier.id) ?? { supplierId: supplier.id, name: supplier.name, reasons: [], latestObservedAt: null };
      current.reasons.push(`handles ${supplier.brands.map((b) => b.brand.name).join(", ")}`);
      suggestions.set(supplier.id, current);
    }
  }

  return [...suggestions.values()]
    .sort((a, b) => (b.latestObservedAt?.getTime() ?? 0) - (a.latestObservedAt?.getTime() ?? 0) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/**
 * The ACTIVE choices on an enquiry (one per requirement), with the price and stock the buyer saw when choosing. The observations are
 * immutable, so these are the values as they were, even if the supplier has quoted differently since.
 */
export async function listDecisionsForEnquiry(enquiryId: string) {
  return db.procurementDecision.findMany({
    where: { retractedAt: null, enquiryItem: { enquiryId } },
    include: {
      supplier: { select: { id: true, name: true } },
      decidedBy: { select: { name: true } },
      priceObservation: { select: { id: true, amount: true, currencyCode: true, vatState: true, observedAt: true } },
      stockObservation: { select: { id: true, quantity: true, status: true, observedAt: true } },
    },
  });
}

export type DecisionRow = Awaited<ReturnType<typeof listDecisionsForEnquiry>>[number];

/** The request behind `/broadcasts/new?request=`: enough to pre-fill the reply form and show what it is a reply to. */
export async function getRequestForReply(requestId: string) {
  return db.supplierRequest.findUnique({
    where: { id: requestId },
    select: { id: true, supplierId: true, contactId: true, supplier: { select: { name: true } }, enquiry: { select: { id: true, number: true, archivedAt: true } } },
  });
}
