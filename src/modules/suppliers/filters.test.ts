import { describe, expect, it } from "vitest";
import { hasActiveSupplierFilters, parseSupplierFilters } from "./filters";

const uuid = "0198f000-0000-7000-8000-000000000001";

describe("parseSupplierFilters", () => {
  it("defaults to page 1 with no filters", () => {
    expect(parseSupplierFilters({})).toEqual({ q: undefined, status: undefined, type: undefined, brandId: undefined, categoryId: undefined, page: 1 });
  });

  it("accepts valid values", () => {
    const parsed = parseSupplierFilters({ q: " dell ", status: "ARCHIVED", type: "STOCKIST", brand: uuid, category: uuid, page: "3" });
    expect(parsed).toEqual({ q: "dell", status: "ARCHIVED", type: "STOCKIST", brandId: uuid, categoryId: uuid, page: 3 });
  });

  it("ignores invalid enum values and non-uuid ids instead of passing them on", () => {
    const parsed = parseSupplierFilters({ status: "DROP TABLE", type: "nope", brand: "not-a-uuid", category: "1 OR 1=1", page: "-4" });
    expect(parsed).toEqual({ q: undefined, status: undefined, type: undefined, brandId: undefined, categoryId: undefined, page: 1 });
  });
});

describe("hasActiveSupplierFilters", () => {
  it("is false for just a page, true when any filter is set", () => {
    expect(hasActiveSupplierFilters({ page: 4 })).toBe(false);
    expect(hasActiveSupplierFilters({ page: 1, q: "x" })).toBe(true);
    expect(hasActiveSupplierFilters({ page: 1, status: "ARCHIVED" })).toBe(true);
  });
});
