import { beforeEach, describe, expect, it } from "vitest";
import type { ServiceContext } from "@/core/database/tx";
import { createBrand, createCategory, createTestContext, resetDatabase } from "@/test/helpers";
import { hasActiveProductFilters, parseProductFilters } from "./filters";
import { searchProducts } from "./queries";
import { aliasAddSchema, productCreateSchema } from "./schemas";
import { addAlias, createProduct, setProductStatus } from "./service";

let ctx: ServiceContext;
let ids: Record<string, string>;

beforeEach(async () => {
  await resetDatabase();
  ctx = await createTestContext();
  const dell = await createBrand("Dell");
  const lenovo = await createBrand("Lenovo");
  const laptop = await createCategory("Laptop");
  const server = await createCategory("Server");

  const make = (over: Record<string, unknown>) => createProduct(ctx, productCreateSchema.parse(over));
  const latitude = await make({ name: "TEST Dell Latitude 5440", brandId: dell.id, categoryId: laptop.id, family: "Latitude", model: "5440" });
  const v15 = await make({ name: "TEST Lenovo V15 G4 IRU", brandId: lenovo.id, categoryId: laptop.id, model: "V15 G4 IRU", partNumber: "83A100SUAK" });
  const poweredge = await make({ name: "TEST Dell PowerEdge R650", brandId: dell.id, categoryId: server.id, model: "R650" });
  await addAlias(ctx, aliasAddSchema.parse({ productId: v15.id, alias: "V15G4" }));
  ids = { latitude: latitude.id, v15: v15.id, poweredge: poweredge.id };
});

const search = async (q: string, extra: Record<string, unknown> = {}) => (await searchProducts({ q, page: 1, ...extra })).rows.map((r) => r.id).sort();

describe("searchProducts", () => {
  it("requires every word to match, across different fields", async () => {
    expect(await search("dell 5440")).toEqual([ids.latitude]);
    expect(await search("dell")).toEqual([ids.latitude, ids.poweredge].sort());
    expect(await search("dell laptop")).toEqual([ids.latitude]);
    expect(await search("dell laptop server")).toEqual([]);
  });

  it("finds a part number typed with different punctuation and case", async () => {
    expect(await search("83A100SUAK")).toEqual([ids.v15]);
    expect(await search("83a100-suak")).toEqual([ids.v15]);
  });

  it("finds a product by an alias, in normalised or readable form", async () => {
    expect(await search("V15G4")).toEqual([ids.v15]);
    expect(await search("v15 g4")).toEqual([ids.v15]);
  });

  it("finds by brand, category and model words", async () => {
    expect(await search("lenovo")).toEqual([ids.v15]);
    expect(await search("server")).toEqual([ids.poweredge]);
    expect(await search("r650")).toEqual([ids.poweredge]);
  });

  it("returns everything for an empty query, and nothing for a non-match", async () => {
    expect(await search("")).toHaveLength(3);
    expect(await search("zzz-nothing")).toEqual([]);
  });

  it("treats hostile input as plain text", async () => {
    expect(await search("'; DROP TABLE products; --")).toEqual([]);
    expect(await search("%")).toEqual([]);
    expect(await search("\\")).toEqual([]);
  });

  it("hides archived products unless asked, and filters by brand, category and temporary", async () => {
    await setProductStatus(ctx, { id: ids.poweredge!, status: "ARCHIVED" });
    expect(await search("")).toHaveLength(2);
    expect(await search("", { status: "ARCHIVED" })).toEqual([ids.poweredge]);

    const dell = await (await import("@/test/helpers")).testDb.brand.findFirstOrThrow({ where: { name: "Dell" } });
    expect(await search("", { brandId: dell.id })).toEqual([ids.latitude]);
    expect(await search("", { temporaryOnly: true })).toEqual([]);
  });

  it("reports no supplier observations yet for products with none (unknown, not zero-price)", async () => {
    const { rows } = await searchProducts({ page: 1 });
    expect(rows.every((r) => r.supplierCount === 0 && r.latestObservedAt === null)).toBe(true);
  });
});

describe("parseProductFilters", () => {
  const uuid = "0198f000-0000-7000-8000-000000000001";

  it("accepts valid values and ignores invalid ones", () => {
    expect(parseProductFilters({ q: " dell ", brand: uuid, category: uuid, status: "ARCHIVED", temporary: "1", page: "2" })).toEqual({
      q: "dell",
      brandId: uuid,
      categoryId: uuid,
      status: "ARCHIVED",
      temporaryOnly: true,
      page: 2,
    });
    expect(parseProductFilters({ brand: "x", category: "1 OR 1=1", status: "NOPE", temporary: "yes", page: "0" })).toEqual({
      q: undefined,
      brandId: undefined,
      categoryId: undefined,
      status: undefined,
      temporaryOnly: undefined,
      page: 1,
    });
  });

  it("detects active filters but not just a page", () => {
    expect(hasActiveProductFilters({ page: 3 })).toBe(false);
    expect(hasActiveProductFilters({ page: 1, temporaryOnly: true })).toBe(true);
  });
});
