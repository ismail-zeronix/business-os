/**
 * Whether a PENDING enquiry item is ready for "Confirm N ready requirements": it has something identifying it (a
 * description, model or part number — confirmEnquiryItem requires this) and, if it is linked to a product, that
 * product is ACTIVE. Unlike broadcasts, an unlinked item IS ready: confirming an enquiry item records no price or
 * stock, so there is nothing a product link is needed for (master data may simply be incomplete). Pure and
 * DB-shape-agnostic so the service (what to confirm) and the queries/page (the ready count) share one definition.
 */
export type EnquiryReadinessItem = {
  description: string | null;
  modelText: string | null;
  partNumber: string | null;
  productId: string | null;
  product: { status: string } | null;
};

export function isEnquiryItemReady(item: EnquiryReadinessItem): boolean {
  const identified = Boolean(item.description || item.modelText || item.partNumber);
  const productOk = !item.productId || item.product?.status === "ACTIVE";
  return identified && productOk;
}
