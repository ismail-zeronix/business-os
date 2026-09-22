import { RecordStatus } from "../../generated/prisma/enums";
import { firstParam, parsePage, type SearchParams } from "../../lib/search-params";
import type { CustomerListParams } from "./queries";

const oneOf = <T extends string>(obj: Record<string, T>, value: string | undefined): T | undefined =>
  value !== undefined && (Object.values(obj) as string[]).includes(value) ? (value as T) : undefined;

/** Turns untrusted URL params into safe query params. Anything invalid is ignored rather than passed to the database. */
export function parseCustomerFilters(searchParams: SearchParams): CustomerListParams {
  return { q: firstParam(searchParams, "q"), status: oneOf(RecordStatus, firstParam(searchParams, "status")), page: parsePage(searchParams) };
}

export function hasActiveCustomerFilters(params: CustomerListParams): boolean {
  return Boolean(params.q || params.status);
}
