import { QUOTATION_STATUS_LABEL } from "@/lib/labels";
import type { QuotationStatus } from "@/generated/prisma/enums";
import { quotationLabel } from "../shared";

export type EnquiryQuotation = { id: string; quoteDate: Date; quoteSeq: number; revision: number; status: QuotationStatus };

export type QuotationNavPlan = {
  /** The single current quotation whose link should be the navbar's one primary action, or null when the Create button is primary (or neither is). */
  primaryQuotation: EnquiryQuotation | null;
  /** True when the Create quotation button itself is the primary action. */
  promoteCreate: boolean;
  /** Current (non-superseded) quotations whose link belongs in the overflow menu instead of the primary slot. */
  overflowQuotations: EnquiryQuotation[];
  /** True when a Create quotation button (enabled or disabled) belongs in the overflow menu because it exists but was not promoted. */
  showCreateInOverflow: boolean;
};

/**
 * Decides which single quotation action is the enquiry navbar's one primary action, and which quotation actions
 * fall back to the overflow menu. Pure decision only — the page renders the actual link/button, since
 * `CreateQuotationButton` (confirm popover, disabled state) must keep behaving exactly as before.
 *
 * Priority: a usable Create quotation button (no current draft, not archived, at least one confirmed requirement)
 * is the most relevant action. Otherwise, a single current (non-superseded) quotation's link is promoted instead.
 * Everything else — additional quotation links, or a Create button that exists but wasn't promoted — goes to overflow.
 */
export function planQuotationNav({ quotations, confirmedCount, archived }: { quotations: EnquiryQuotation[]; confirmedCount: number; archived: boolean }): QuotationNavPlan {
  const current = quotations.filter((q) => q.status !== "SUPERSEDED");
  const hasDraft = current.some((q) => q.status === "DRAFT");
  const canCreate = !hasDraft && !archived;
  const promoteCreate = canCreate && confirmedCount > 0;

  if (promoteCreate) {
    return { primaryQuotation: null, promoteCreate: true, overflowQuotations: current, showCreateInOverflow: false };
  }
  if (current.length === 1) {
    return { primaryQuotation: current[0], promoteCreate: false, overflowQuotations: [], showCreateInOverflow: canCreate };
  }
  return { primaryQuotation: null, promoteCreate: false, overflowQuotations: current, showCreateInOverflow: canCreate };
}

/** The label used on a quotation's link button/menu item: its reference plus current status. */
export const quotationLinkLabel = (quotation: EnquiryQuotation): string => `${quotationLabel(quotation)} · ${QUOTATION_STATUS_LABEL[quotation.status]}`;
