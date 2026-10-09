import { z } from "zod";
import { firstParam, type SearchParams } from "../../lib/search-params";
import type { FreshnessBand } from "../../lib/freshness";
import type { StockValue } from "../observations/procurement-queries";

const isUuid = (value: string | undefined) => (value !== undefined && z.uuid().safeParse(value).success ? value : undefined);

const STOCK_VALUES: readonly StockValue[] = ["IN_STOCK", "LIMITED", "AVAILABLE", "INCOMING", "ON_REQUEST", "OUT_OF_STOCK", "UNKNOWN"];
const FRESHNESS_BANDS: readonly FreshnessBand[] = ["fresh", "recent", "aging", "stale"];

export type SearchFilters = { supplierId?: string; brandId?: string; categoryId?: string; stock?: StockValue; freshness?: FreshnessBand };

/** Turns untrusted URL params into safe search filters. Anything invalid is dropped rather than passed to the database. */
export function parseSearchFilters(searchParams: SearchParams): SearchFilters {
  const stock = firstParam(searchParams, "stock");
  const freshness = firstParam(searchParams, "freshness");
  return {
    supplierId: isUuid(firstParam(searchParams, "supplier")),
    brandId: isUuid(firstParam(searchParams, "brand")),
    categoryId: isUuid(firstParam(searchParams, "category")),
    stock: (STOCK_VALUES as readonly string[]).includes(stock ?? "") ? (stock as StockValue) : undefined,
    freshness: (FRESHNESS_BANDS as readonly string[]).includes(freshness ?? "") ? (freshness as FreshnessBand) : undefined,
  };
}

/** True when any supplier/brand/category/stock/freshness filter is set, so the UI can offer "Clear filters". */
export function hasActiveSearchFilters(filters: SearchFilters): boolean {
  return Boolean(filters.supplierId || filters.brandId || filters.categoryId || filters.stock || filters.freshness);
}
