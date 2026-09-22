import { z } from "zod";
import { RecordStatus } from "../../generated/prisma/enums";
import { firstParam, parsePage, type SearchParams } from "../../lib/search-params";
import type { ProductListParams } from "./queries";

const isUuid = (value: string | undefined) => (value !== undefined && z.uuid().safeParse(value).success ? value : undefined);

/** Turns untrusted URL params into safe query params; anything invalid is ignored rather than passed to the database. */
export function parseProductFilters(searchParams: SearchParams): ProductListParams {
  const status = firstParam(searchParams, "status");
  return {
    q: firstParam(searchParams, "q"),
    brandId: isUuid(firstParam(searchParams, "brand")),
    categoryId: isUuid(firstParam(searchParams, "category")),
    status: status && (Object.values(RecordStatus) as string[]).includes(status) ? (status as RecordStatus) : undefined,
    temporaryOnly: firstParam(searchParams, "temporary") === "1" ? true : undefined,
    page: parsePage(searchParams),
  };
}

export function hasActiveProductFilters(params: ProductListParams): boolean {
  return Boolean(params.q || params.brandId || params.categoryId || params.status || params.temporaryOnly);
}
