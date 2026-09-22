import { beforeEach, describe, expect, it } from "vitest";
import type { ServiceContext } from "@/core/database/tx";
import { createBrand, createTestContext, resetDatabase, testDb } from "@/test/helpers";
import { findMatchCandidates, pickAutoLink, type MatchCandidate } from "./matching";
import { aliasAddSchema, productCreateSchema } from "./schemas";
import { addAlias, createProduct, setProductStatus } from "./service";

let ctx: ServiceContext;
let lenovoId: string;
let dellId: string;

beforeEach(async () => {
  await resetDatabase();
  ctx = await createTestContext();
  // Brand names are real reference data; the matcher compares them with the brand text written in a broadcast.
  lenovoId = (await createBrand("Lenovo")).id;
  dellId = (await createBrand("Dell")).id;
});

const product = (over: Record<string, unknown>) => createProduct(ctx, productCreateSchema.parse(over));
const alias = (productId: string, text: string) => addAlias(ctx, aliasAddSchema.parse({ productId, alias: text }));

describe("findMatchCandidates", () => {
  it("layer 1: an exact part number is an EXACT match, whatever its formatting", async () => {
    const v15 = await product({ name: "TEST Lenovo V15 G4 IRU", brandId: lenovoId, partNumber: "83A100SUAK" });
    const candidates = await findMatchCandidates(testDb, { partNumber: "83a100-suak" });
    expect(candidates).toEqual([expect.objectContaining({ productId: v15.id, basis: "PART_NUMBER", strength: "EXACT" })]);
  });

  it("layer 2: model plus a matching brand is PROBABLE; unknown brand stays POSSIBLE", async () => {
    const latitude = await product({ name: "TEST Dell Latitude 5440", brandId: dellId, model: "5440" });

    expect((await findMatchCandidates(testDb, { model: "5440", brandText: "Dell" }))[0]).toMatchObject({ productId: latitude.id, basis: "MODEL", strength: "PROBABLE" });
    expect((await findMatchCandidates(testDb, { model: "5440" }))[0]).toMatchObject({ productId: latitude.id, basis: "MODEL", strength: "POSSIBLE" });
  });

  it("layer 2: a brand that contradicts the product rules it out", async () => {
    await product({ name: "TEST Dell Latitude 5440", brandId: dellId, model: "5440" });
    expect(await findMatchCandidates(testDb, { model: "5440", brandText: "Lenovo" })).toEqual([]);
  });

  it("layer 2: a product with no brand is not ruled out by a brand in the broadcast", async () => {
    const unbranded = await product({ name: "TEST Unbranded 5440", model: "5440" });
    expect((await findMatchCandidates(testDb, { model: "5440", brandText: "Dell" }))[0]).toMatchObject({ productId: unbranded.id, strength: "POSSIBLE" });
  });

  it("layer 3: a unique alias is PROBABLE", async () => {
    const v15 = await product({ name: "TEST Lenovo V15 G4 IRU", brandId: lenovoId, partNumber: "83A100SUAK" });
    await alias(v15.id, "V15G4");
    const candidates = await findMatchCandidates(testDb, { model: "v15 g4", brandText: "Lenovo" });
    expect(candidates).toEqual([expect.objectContaining({ productId: v15.id, basis: "ALIAS", strength: "PROBABLE" })]);
  });

  it("layer 3: an alias shared by several products is ambiguous, so every candidate stays POSSIBLE", async () => {
    const g3 = await product({ name: "TEST V15 G3", brandId: lenovoId });
    const g4 = await product({ name: "TEST V15 G4", brandId: lenovoId });
    await alias(g3.id, "V15");
    await alias(g4.id, "V15");

    const candidates = await findMatchCandidates(testDb, { model: "V15" });
    expect(candidates.map((c) => c.productId).sort()).toEqual([g3.id, g4.id].sort());
    expect(new Set(candidates.map((c) => c.strength))).toEqual(new Set(["POSSIBLE"]));
    expect(pickAutoLink(candidates)).toBeNull();
  });

  it("layer 3: matches an alias written as 'brand model' and as the full description", async () => {
    const latitude = await product({ name: "TEST Dell Latitude 5440", brandId: dellId, model: "5440-X" });
    await alias(latitude.id, "Dell 5440");
    await alias(latitude.id, "Dell Latitude 5440 i7 16GB");

    expect((await findMatchCandidates(testDb, { brandText: "Dell", model: "5440" }))[0]?.productId).toBe(latitude.id);
    expect((await findMatchCandidates(testDb, { description: "DELL latitude 5440 i7 16gb" }))[0]?.productId).toBe(latitude.id);
  });

  it("never proposes an archived product", async () => {
    const v15 = await product({ name: "TEST Lenovo V15", brandId: lenovoId, partNumber: "83A100SUAK" });
    await setProductStatus(ctx, { id: v15.id, status: "ARCHIVED" });
    expect(await findMatchCandidates(testDb, { partNumber: "83A100SUAK" })).toEqual([]);
  });

  it("returns nothing when there is no usable identifier (unknown stays unknown)", async () => {
    await product({ name: "TEST Something", partNumber: "X1" });
    expect(await findMatchCandidates(testDb, {})).toEqual([]);
    expect(await findMatchCandidates(testDb, { partNumber: "  ", model: "---" })).toEqual([]);
  });

  it("keeps the strongest reason per product and ranks EXACT before PROBABLE before POSSIBLE", async () => {
    const exact = await product({ name: "TEST Z Exact", brandId: dellId, partNumber: "PN-1", model: "5440" });
    const other = await product({ name: "TEST A Other", brandId: dellId, model: "5440" });

    const candidates = await findMatchCandidates(testDb, { partNumber: "pn1", model: "5440", brandText: "Dell" });
    expect(candidates.map((c) => [c.productId, c.strength])).toEqual([
      [exact.id, "EXACT"],
      [other.id, "PROBABLE"],
    ]);
  });
});

describe("pickAutoLink", () => {
  const candidate = (id: string, strength: MatchCandidate["strength"]): MatchCandidate => ({
    productId: id,
    name: id,
    partNumber: null,
    brandName: null,
    basis: strength === "EXACT" ? "PART_NUMBER" : "MODEL",
    strength,
  });

  it("pre-links a single EXACT match", () => {
    expect(pickAutoLink([candidate("a", "EXACT"), candidate("b", "POSSIBLE")])?.productId).toBe("a");
  });

  it("pre-links a single PROBABLE match when nothing is EXACT", () => {
    expect(pickAutoLink([candidate("a", "PROBABLE"), candidate("b", "POSSIBLE")])?.productId).toBe("a");
  });

  it("does not guess when matches are ambiguous or weak", () => {
    expect(pickAutoLink([])).toBeNull();
    expect(pickAutoLink([candidate("a", "EXACT"), candidate("b", "EXACT")])).toBeNull();
    expect(pickAutoLink([candidate("a", "PROBABLE"), candidate("b", "PROBABLE")])).toBeNull();
    expect(pickAutoLink([candidate("a", "POSSIBLE")])).toBeNull();
  });
});
