import { beforeEach, describe, expect, it } from "vitest";
import type { ServiceContext } from "@/core/database/tx";
import { ConflictError, NotFoundError } from "@/core/errors";
import { createTestContext, resetDatabase, testDb } from "@/test/helpers";
import { createBrand, createCategory, renameBrand, setBrandStatus, setCategoryStatus } from "./master-data.service";
import { listBrandOptions, listBrands } from "./master-data.queries";

let ctx: ServiceContext;

beforeEach(async () => {
  await resetDatabase();
  ctx = await createTestContext();
});

describe("brands", () => {
  it("creates a brand with a normalised key and audits it", async () => {
    const brand = await createBrand(ctx, { name: "TEST Dell" });
    expect(brand.normalizedName).toBe("test dell");
    expect(await testDb.auditLog.count({ where: { action: "brand.created", entityId: brand.id } })).toBe(1);
  });

  it("rejects a duplicate regardless of case, and explains an archived duplicate", async () => {
    const brand = await createBrand(ctx, { name: "TEST Dell" });
    await expect(createBrand(ctx, { name: "test  DELL" })).rejects.toBeInstanceOf(ConflictError);

    await setBrandStatus(ctx, { id: brand.id, status: "ARCHIVED" });
    await expect(createBrand(ctx, { name: "TEST Dell" })).rejects.toThrow(/archived/i);
  });

  it("renames with an audited from/to, and blocks a rename onto another brand", async () => {
    const a = await createBrand(ctx, { name: "TEST Alpha" });
    await createBrand(ctx, { name: "TEST Beta" });

    await renameBrand(ctx, { id: a.id, name: "TEST Alpha Inc" });
    const audit = await testDb.auditLog.findFirstOrThrow({ where: { action: "brand.updated" } });
    expect(audit.details).toEqual({ name: { from: "TEST Alpha", to: "TEST Alpha Inc" } });

    await expect(renameBrand(ctx, { id: a.id, name: "test beta" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("archives instead of deleting, and reports a missing brand", async () => {
    const brand = await createBrand(ctx, { name: "TEST Dell" });
    await setBrandStatus(ctx, { id: brand.id, status: "ARCHIVED" });
    expect(await testDb.brand.count()).toBe(1);
    await expect(setBrandStatus(ctx, { id: "0198f000-0000-7000-8000-000000000000", status: "ARCHIVED" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lists archived brands in Settings but keeps them out of pickers unless already selected", async () => {
    const active = await createBrand(ctx, { name: "TEST Active" });
    const archived = await createBrand(ctx, { name: "TEST Archived" });
    await setBrandStatus(ctx, { id: archived.id, status: "ARCHIVED" });

    expect((await listBrands()).map((b) => b.name)).toEqual(["TEST Active", "TEST Archived"]);
    expect((await listBrandOptions()).map((o) => o.value)).toEqual([active.id]);
    const withSelected = await listBrandOptions([archived.id]);
    expect(withSelected.map((o) => o.label)).toEqual(["TEST Active", "TEST Archived (archived)"]);
  });
});

describe("categories", () => {
  it("creates, rejects duplicates, and archives", async () => {
    const category = await createCategory(ctx, { name: "TEST Laptop" });
    await expect(createCategory(ctx, { name: "test laptop" })).rejects.toBeInstanceOf(ConflictError);
    await setCategoryStatus(ctx, { id: category.id, status: "ARCHIVED" });
    expect((await testDb.category.findUniqueOrThrow({ where: { id: category.id } })).status).toBe("ARCHIVED");
    expect(await testDb.auditLog.count({ where: { action: "category.status_changed" } })).toBe(1);
  });
});
