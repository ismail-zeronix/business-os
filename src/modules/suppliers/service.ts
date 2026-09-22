import { ConflictError, NotFoundError, uniqueViolation } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { diffFields, hasChanges } from "../../lib/diff";
import { normalizeName } from "../../lib/normalize";
import { writeAudit } from "../audit/service";
import { diffIds, requireBrands, requireCategories } from "./associations";
import type { SupplierAssociationsInput, SupplierCreateInput, SupplierStatusInput, SupplierUpdateInput } from "./schemas";

/** Fields whose changes are recorded in the audit log. */
const PROFILE_FIELDS = [
  "name", "legalName", "code", "type", "country", "emirate", "area", "address", "website", "phone", "whatsapp", "email", "trn",
  "paymentTerms", "creditTerms", "warrantyNotes", "deliveryNotes", "notes",
] as const;

const duplicateNameMessage = (archived: boolean) =>
  archived
    ? "A supplier with this name exists but is archived. Restore it instead of creating a duplicate."
    : "A supplier with this name already exists. If this is a different branch, make the name distinct (e.g. 'ABC Computers - Sharjah').";

function conflictFromUnique(fields: string[]): ConflictError {
  if (fields.some((f) => f.includes("code"))) return new ConflictError("Another supplier already uses this code.", { code: "Already in use" });
  return new ConflictError(duplicateNameMessage(false), { name: "Already in use" });
}

async function assertNameAndCodeFree(c: ServiceContext, normalizedName: string, code: string | null, exceptId?: string) {
  const byName = await c.db.supplier.findUnique({ where: { normalizedName }, select: { id: true, status: true } });
  if (byName && byName.id !== exceptId) throw new ConflictError(duplicateNameMessage(byName.status === "ARCHIVED"), { name: "Already in use" });
  if (code) {
    const byCode = await c.db.supplier.findUnique({ where: { code }, select: { id: true } });
    if (byCode && byCode.id !== exceptId) throw new ConflictError("Another supplier already uses this code.", { code: "Already in use" });
  }
}

export async function createSupplier(ctx: ServiceContext, input: SupplierCreateInput) {
  try {
    return await inTransaction(ctx, async (c) => {
      const { brandIds, categoryIds, ...profile } = input;
      const normalizedName = normalizeName(profile.name);
      await assertNameAndCodeFree(c, normalizedName, profile.code);

      const brands = await requireBrands(c, brandIds, []);
      const categories = await requireCategories(c, categoryIds, []);

      const supplier = await c.db.supplier.create({
        data: {
          ...profile,
          normalizedName,
          brands: { create: brandIds.map((brandId) => ({ brandId })) },
          categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
        },
      });
      await writeAudit(c, {
        action: "supplier.created",
        entityType: "Supplier",
        entityId: supplier.id,
        details: { name: supplier.name, brands: brands.map((b) => b.name), categories: categories.map((cat) => cat.name) },
      });
      return supplier;
    });
  } catch (error) {
    const unique = uniqueViolation(error);
    if (unique) throw conflictFromUnique(unique.fields);
    throw error;
  }
}

export async function updateSupplier(ctx: ServiceContext, input: SupplierUpdateInput) {
  try {
    return await inTransaction(ctx, async (c) => {
      const { id, ...profile } = input;
      const existing = await c.db.supplier.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Supplier");

      const normalizedName = normalizeName(profile.name);
      await assertNameAndCodeFree(c, normalizedName, profile.code, id);

      const changes = diffFields(existing, profile, PROFILE_FIELDS);
      if (!hasChanges(changes)) return existing;

      const updated = await c.db.supplier.update({ where: { id }, data: { ...profile, normalizedName } });
      await writeAudit(c, { action: "supplier.updated", entityType: "Supplier", entityId: id, details: changes });
      return updated;
    });
  } catch (error) {
    const unique = uniqueViolation(error);
    if (unique) throw conflictFromUnique(unique.fields);
    throw error;
  }
}

export async function setSupplierStatus(ctx: ServiceContext, input: SupplierStatusInput) {
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.supplier.findUnique({ where: { id: input.id }, select: { id: true, status: true } });
    if (!existing) throw new NotFoundError("Supplier");
    if (existing.status === input.status) return existing;
    const updated = await c.db.supplier.update({ where: { id: input.id }, data: { status: input.status } });
    await writeAudit(c, {
      action: "supplier.status_changed",
      entityType: "Supplier",
      entityId: input.id,
      details: { status: { from: existing.status, to: input.status } },
    });
    return updated;
  });
}

/** Replaces the supplier's brands and categories. Only differences are written, and only real differences are audited. */
export async function setSupplierAssociations(ctx: ServiceContext, input: SupplierAssociationsInput) {
  return inTransaction(ctx, async (c) => {
    const supplier = await c.db.supplier.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        brands: { select: { brandId: true, brand: { select: { name: true } } } },
        categories: { select: { categoryId: true, category: { select: { name: true } } } },
      },
    });
    if (!supplier) throw new NotFoundError("Supplier");

    const currentBrandIds = supplier.brands.map((b) => b.brandId);
    const brandDiff = diffIds(currentBrandIds, input.brandIds);
    if (brandDiff.toAdd.length || brandDiff.toRemove.length) {
      const wanted = await requireBrands(c, input.brandIds, currentBrandIds);
      const added = wanted.filter((b) => brandDiff.toAdd.includes(b.id));
      if (brandDiff.toRemove.length) await c.db.supplierBrand.deleteMany({ where: { supplierId: input.id, brandId: { in: brandDiff.toRemove } } });
      if (added.length) await c.db.supplierBrand.createMany({ data: added.map((b) => ({ supplierId: input.id, brandId: b.id })) });
      await writeAudit(c, {
        action: "supplier.brands_changed",
        entityType: "Supplier",
        entityId: input.id,
        details: {
          added: added.map((b) => b.name),
          removed: supplier.brands.filter((b) => brandDiff.toRemove.includes(b.brandId)).map((b) => b.brand.name),
        },
      });
    }

    const currentCategoryIds = supplier.categories.map((cat) => cat.categoryId);
    const categoryDiff = diffIds(currentCategoryIds, input.categoryIds);
    if (categoryDiff.toAdd.length || categoryDiff.toRemove.length) {
      const wanted = await requireCategories(c, input.categoryIds, currentCategoryIds);
      const added = wanted.filter((cat) => categoryDiff.toAdd.includes(cat.id));
      if (categoryDiff.toRemove.length) await c.db.supplierCategory.deleteMany({ where: { supplierId: input.id, categoryId: { in: categoryDiff.toRemove } } });
      if (added.length) await c.db.supplierCategory.createMany({ data: added.map((cat) => ({ supplierId: input.id, categoryId: cat.id })) });
      await writeAudit(c, {
        action: "supplier.categories_changed",
        entityType: "Supplier",
        entityId: input.id,
        details: {
          added: added.map((cat) => cat.name),
          removed: supplier.categories.filter((cat) => categoryDiff.toRemove.includes(cat.categoryId)).map((cat) => cat.category.name),
        },
      });
    }
  });
}
