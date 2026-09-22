import { beforeEach, describe, expect, it } from "vitest";
import type { ServiceContext } from "@/core/database/tx";
import { ConflictError, InvariantError, NotFoundError, ValidationError } from "@/core/errors";
import { createBrand, createCategory, createTestContext, resetDatabase, testDb } from "@/test/helpers";
import { DuplicateProductError } from "./errors";
import { aliasAddSchema, aliasRemoveSchema, productCreateSchema, productUpdateSchema } from "./schemas";
import { addAlias, createProduct, removeAlias, setProductStatus, updateProduct } from "./service";

let ctx: ServiceContext;

beforeEach(async () => {
  await resetDatabase();
  ctx = await createTestContext();
});

const newProduct = (over: Record<string, unknown> = {}) => productCreateSchema.parse({ name: "TEST Lenovo V15 G4 IRU", ...over });
const update = (id: string, over: Record<string, unknown>) => productUpdateSchema.parse({ id, name: "TEST Lenovo V15 G4 IRU", ...over });

describe("createProduct", () => {
  it("stores normalised keys, leaves unknown identity fields null, and audits", async () => {
    const product = await createProduct(ctx, newProduct({ partNumber: "83A100-SUAK", model: "V15 G4 IRU" }));

    expect(product.normalizedPartNumber).toBe("83A100SUAK");
    expect(product.normalizedModel).toBe("V15G4IRU");
    expect(product.brandId).toBeNull();
    expect(product.categoryId).toBeNull();
    expect(product.family).toBeNull();
    expect(product.isTemporary).toBe(false);
    expect(await testDb.auditLog.count({ where: { action: "product.created", entityId: product.id } })).toBe(1);
  });

  it("can be created as temporary (from a broadcast) without brand or part number", async () => {
    const product = await createProduct(ctx, newProduct({ name: "TEST Mystery box" }), { isTemporary: true });
    expect(product.isTemporary).toBe(true);
    expect(product.normalizedPartNumber).toBeNull();
  });

  it("rejects the same part number in any formatting, pointing at the existing product", async () => {
    const first = await createProduct(ctx, newProduct({ partNumber: "83A100SUAK" }));
    const duplicate = createProduct(ctx, newProduct({ name: "TEST Another", partNumber: " 83a100-suak " }));

    await expect(duplicate).rejects.toBeInstanceOf(DuplicateProductError);
    await expect(duplicate).rejects.toMatchObject({ existing: { id: first.id, name: first.name }, fieldErrors: { partNumber: "Already in use" } });
    expect(await testDb.product.count()).toBe(1);
  });

  it("allows many products without a part number", async () => {
    await createProduct(ctx, newProduct({ name: "TEST A" }));
    await createProduct(ctx, newProduct({ name: "TEST B" }));
    expect(await testDb.product.count()).toBe(2);
  });

  it("validates brand and category, and blocks newly assigning an archived brand", async () => {
    const brand = await createBrand("TEST Old", "ARCHIVED");
    await expect(createProduct(ctx, newProduct({ brandId: brand.id }))).rejects.toThrow(/archived/i);
    await expect(createProduct(ctx, newProduct({ categoryId: "0198f000-0000-7000-8000-000000000000" }))).rejects.toBeInstanceOf(ValidationError);
    expect(await testDb.product.count()).toBe(0);
  });
});

describe("updateProduct", () => {
  it("audits changed fields and resolves brand/category to names, not ids", async () => {
    const lenovo = await createBrand("TEST Lenovo");
    const laptop = await createCategory("TEST Laptop");
    const product = await createProduct(ctx, newProduct());

    await updateProduct(ctx, update(product.id, { brandId: lenovo.id, categoryId: laptop.id, model: "V15 G4", needsCuration: "" }));

    const audit = await testDb.auditLog.findFirstOrThrow({ where: { action: "product.updated" } });
    expect(audit.details).toEqual({
      model: { from: null, to: "V15 G4" },
      brand: { from: null, to: "TEST Lenovo" },
      category: { from: null, to: "TEST Laptop" },
    });
    expect((await testDb.product.findUniqueOrThrow({ where: { id: product.id } })).normalizedModel).toBe("V15G4");
  });

  it("lets a person clear the temporary flag once curated", async () => {
    const product = await createProduct(ctx, newProduct(), { isTemporary: true });
    await updateProduct(ctx, update(product.id, { needsCuration: "" }));
    expect((await testDb.product.findUniqueOrThrow({ where: { id: product.id } })).isTemporary).toBe(false);

    const audit = await testDb.auditLog.findFirstOrThrow({ where: { action: "product.updated" } });
    expect(audit.details).toEqual({ needsCuration: { from: true, to: false } });
  });

  it("keeps the temporary flag when the checkbox stays ticked", async () => {
    const product = await createProduct(ctx, newProduct(), { isTemporary: true });
    await updateProduct(ctx, update(product.id, { needsCuration: "on" }));
    expect((await testDb.product.findUniqueOrThrow({ where: { id: product.id } })).isTemporary).toBe(true);
    expect(await testDb.auditLog.count({ where: { action: "product.updated" } })).toBe(0);
  });

  it("blocks changing a part number onto another product's, but allows keeping its own", async () => {
    await createProduct(ctx, newProduct({ name: "TEST A", partNumber: "PN-A" }));
    const b = await createProduct(ctx, newProduct({ name: "TEST B", partNumber: "PN-B" }));

    await expect(updateProduct(ctx, update(b.id, { name: "TEST B", partNumber: "pn a", needsCuration: "" }))).rejects.toBeInstanceOf(DuplicateProductError);
    await expect(updateProduct(ctx, update(b.id, { name: "TEST B", partNumber: "pn-b", needsCuration: "" }))).resolves.toBeTruthy();
  });

  it("reports a missing product", async () => {
    await expect(updateProduct(ctx, update("0198f000-0000-7000-8000-000000000000", { needsCuration: "" }))).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("setProductStatus", () => {
  it("archives without deleting and audits the change", async () => {
    const product = await createProduct(ctx, newProduct());
    await setProductStatus(ctx, { id: product.id, status: "ARCHIVED" });
    expect((await testDb.product.findUniqueOrThrow({ where: { id: product.id } })).status).toBe("ARCHIVED");
    const audit = await testDb.auditLog.findFirstOrThrow({ where: { action: "product.status_changed" } });
    expect(audit.details).toEqual({ status: { from: "ACTIVE", to: "ARCHIVED" } });
  });
});

describe("aliases", () => {
  it("adds an alias with a normalised key and audits it under the product's scope", async () => {
    const product = await createProduct(ctx, newProduct({ partNumber: "83A100SUAK" }));
    const alias = await addAlias(ctx, aliasAddSchema.parse({ productId: product.id, alias: "V15 G4" }));

    expect(alias.normalizedAlias).toBe("V15G4");
    expect(alias.source).toBe("MANUAL");
    const audit = await testDb.auditLog.findFirstOrThrow({ where: { action: "product_alias.added" } });
    expect(audit).toMatchObject({ scopeType: "Product", scopeId: product.id, details: { alias: "V15 G4" } });
  });

  it("rejects the same alias on the same product in any spelling", async () => {
    const product = await createProduct(ctx, newProduct());
    await addAlias(ctx, aliasAddSchema.parse({ productId: product.id, alias: "V15 G4" }));
    await expect(addAlias(ctx, aliasAddSchema.parse({ productId: product.id, alias: "v15-g4" }))).rejects.toBeInstanceOf(ConflictError);
  });

  it("allows the same alias on different products (ambiguity is resolved by a human, not the database)", async () => {
    const a = await createProduct(ctx, newProduct({ name: "TEST V15 G3" }));
    const b = await createProduct(ctx, newProduct({ name: "TEST V15 G4" }));
    await addAlias(ctx, aliasAddSchema.parse({ productId: a.id, alias: "V15" }));
    await expect(addAlias(ctx, aliasAddSchema.parse({ productId: b.id, alias: "V15" }))).resolves.toBeTruthy();
  });

  it("rejects aliases that add no information", async () => {
    const product = await createProduct(ctx, newProduct({ partNumber: "83A100SUAK", model: "V15 G4" }));
    await expect(addAlias(ctx, aliasAddSchema.parse({ productId: product.id, alias: "83a100-suak" }))).rejects.toBeInstanceOf(ValidationError);
    await expect(addAlias(ctx, aliasAddSchema.parse({ productId: product.id, alias: "v15g4" }))).rejects.toBeInstanceOf(ValidationError);
    await expect(addAlias(ctx, aliasAddSchema.parse({ productId: product.id, alias: "---" }))).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses aliases on an archived product", async () => {
    const product = await createProduct(ctx, newProduct());
    await setProductStatus(ctx, { id: product.id, status: "ARCHIVED" });
    await expect(addAlias(ctx, aliasAddSchema.parse({ productId: product.id, alias: "V15" }))).rejects.toBeInstanceOf(InvariantError);
  });

  it("removes an alias but keeps its text in the audit log", async () => {
    const product = await createProduct(ctx, newProduct());
    const alias = await addAlias(ctx, aliasAddSchema.parse({ productId: product.id, alias: "V15 G4" }));

    await removeAlias(ctx, aliasRemoveSchema.parse({ id: alias.id }));

    expect(await testDb.productAlias.count()).toBe(0);
    const audit = await testDb.auditLog.findFirstOrThrow({ where: { action: "product_alias.removed" } });
    expect(audit.details).toEqual({ alias: "V15 G4" });
  });
});
