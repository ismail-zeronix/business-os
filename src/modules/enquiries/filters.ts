import { z } from "zod";
import { EnquiryPriority, EnquiryStatus, EvidenceChannel } from "../../generated/prisma/enums";
import { firstParam, parsePage, type SearchParams } from "../../lib/search-params";
import { ENQUIRY_VIEWS, type EnquiryListParams, type EnquiryView } from "./queries";

const isUuid = (value: string | undefined) => (value !== undefined && z.uuid().safeParse(value).success ? value : undefined);

/** A comma-separated URL value as a list of members of an enum. Unknown members are dropped, never passed to the database. */
function listOf<T extends string>(members: Record<string, T>, value: string | undefined): T[] {
  const allowed = new Set<string>(Object.values(members));
  return [...new Set((value ?? "").split(",").map((v) => v.trim()).filter((v) => allowed.has(v)))] as T[];
}

/** Turns untrusted URL params into safe query params. Anything invalid is ignored rather than passed to the database. */
export function parseEnquiryFilters(searchParams: SearchParams): EnquiryListParams {
  const requested = firstParam(searchParams, "view");
  return {
    view: (ENQUIRY_VIEWS as readonly string[]).includes(requested ?? "") ? (requested as EnquiryView) : "attention",
    q: firstParam(searchParams, "q"),
    customerId: isUuid(firstParam(searchParams, "customer")),
    statuses: listOf(EnquiryStatus, firstParam(searchParams, "status")),
    priorities: listOf(EnquiryPriority, firstParam(searchParams, "priority")),
    channels: listOf(EvidenceChannel, firstParam(searchParams, "source")),
    page: parsePage(searchParams),
  };
}

/** True when any search or filter (not the tab or page) is set, so the UI can offer "Clear". */
export function hasActiveEnquiryFilters(params: EnquiryListParams): boolean {
  return Boolean(params.q || params.customerId || params.statuses?.length || params.priorities?.length || params.channels?.length);
}
