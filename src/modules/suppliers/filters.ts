import { z } from "zod";
import { RecordStatus, SupplierType } from "../../generated/prisma/enums";
import { firstParam, parsePage, type SearchParams } from "../../lib/search-params";
import type { SupplierListParams } from "./queries";

const isUuid = (value: string | undefined) => (value !== undefined && z.uuid().safeParse(value).success ? value : undefined);
const oneOf = <T extends string>(obj: Record<string, T>, value: string | undefined): T | undefined =>
  value !== undefined && (Object.values(obj) as string[]).includes(value) ? (value as T) : undefined;

/** Turns untrusted URL params into safe query params. Anything invalid is ignored rather than passed to the database. */
export function parseSupplierFilters(searchParams: SearchParams): SupplierListParams {
  return {
    q: firstParam(searchParams, "q"),
    status: oneOf(RecordStatus, firstParam(searchParams, "status")),
    type: oneOf(SupplierType, firstParam(searchParams, "type")),
    brandId: isUuid(firstParam(searchParams, "brand")),
    categoryId: isUuid(firstParam(searchParams, "category")),
    page: parsePage(searchParams),
  };
}

/** True when any filter (not the page) is set, so the UI can offer "Clear" and pick the right empty state. */
export function hasActiveSupplierFilters(params: SupplierListParams): boolean {
  return Boolean(params.q || params.status || params.type || params.brandId || params.categoryId);
}
