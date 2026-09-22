import { z } from "zod";
import { QuotationStatus } from "../../generated/prisma/enums";
import { firstParam, parsePage, type SearchParams } from "../../lib/search-params";
import type { QuotationListParams } from "./queries";

/** Turns untrusted URL params into safe query params. Anything invalid is ignored rather than passed to the database. */
export function parseQuotationFilters(searchParams: SearchParams): QuotationListParams {
  const status = firstParam(searchParams, "status");
  const enquiry = firstParam(searchParams, "enquiry");
  return {
    q: firstParam(searchParams, "q"),
    status: status && (Object.values(QuotationStatus) as string[]).includes(status) ? (status as QuotationStatus) : undefined,
    enquiryId: enquiry && z.uuid().safeParse(enquiry).success ? enquiry : undefined,
    page: parsePage(searchParams),
  };
}

export function hasActiveQuotationFilters(params: QuotationListParams): boolean {
  return Boolean(params.q || params.status || params.enquiryId);
}
