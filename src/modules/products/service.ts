import { ConflictError, InvariantError, NotFoundError, ValidationError, uniqueViolation } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import type { Prisma } from "../../generated/prisma/client";
import type { AliasSource } from "../../generated/prisma/enums";
import { diffFields } from "../../lib/diff";
import { normalizeCode, normalizeCodeOrNull } from "../../lib/normalize";
import { writeAudit } from "../audit/service";
import { DuplicateProductError } from "./errors";
import type { AliasAddInput, AliasRemoveInput, ProductCreateInput, ProductStatusInput, ProductUpdateInput } from "./schemas";

const PRODUCT_FIELDS = ["name", "family", "model", "partNumber", "manufacturerSku", "description"] as const;

/** Brand and category are optional (unknown is valid), but if given they must exist, and an archived one can't be newly assigned. */
async function requireBrandAndCategory(c: ServiceContext, brandId: string | null, categoryId: string | null, current?: { brandId: string | null; categoryId: string | null }) {
  const brand = brandId ? await c.db.brand.findUnique({ where: { id: brandId }, select: { id: true, name: true, status: true } }) : null;
  if (brandId && !brand) throw new ValidationError("The selected brand no longer exists.", { brandId: "Choose another brand" });
  if (brand && brand.status === "ARCHIVED" && brand.id !== current?.brandId) throw new ValidationError(`Brand "${brand.name}" is archived and cannot be newly assigned.`, { brandId: "Archived" });

  const category = categoryId ? await c.db.category.findUnique({ where: { id: categoryId }, select: { id: true, name: true, status: true } }) : null;
  if (categoryId && !category) throw new ValidationError("The selected category no longer exists.", { categoryId: "Choose another category" });
  if (category && category.status === "ARCHIVED" && category.id !== current?.categoryId) {
    throw new ValidationError(`Category "${category.name}" is archived and cannot be newly assigned.`, { categoryId: "Archived" });
  }
  return { brandName: brand?.name ?? null, categoryName: category?.name ?? null };
}

async function assertPartNumberFree(c: ServiceContext, normalizedPartNumber: string, partNumber: string, exceptId?: string) {
  const existing = await c.db.product.findUnique({ where: { normalizedPartNumber }, select: { id: true, name: true } });
  if (existing && existing.id !== exceptId) throw new DuplicateProductError(existing, partNumber);
}

/**
 * Creates a product. `isTemporary` is set when the product is created on the fly from a broadcast, so procurement is never blocked
 * by incomplete master data; it can be curated later. The part number is globally unique (normalised).
 */
export async function createProduct(ctx: ServiceContext, input: ProductCreateInput, options: { isTemporary?: boolean } = {}) {
  try {
    return await inTransaction(ctx, async (c) => {
      const names = await requireBrandAndCategory(c, input.brandId, input.categoryId);
      const normalizedPartNumber = normalizeCodeOrNull(input.partNumber);
      if (normalizedPartNumber && input.partNumber) await assertPartNumberFree(c, normalizedPartNumber, input.partNumber);

      const product = await c.db.product.create({
        data: { ...input, normalizedPartNumber, normalizedModel: normalizeCodeOrNull(input.model), isTemporary: options.isTemporary ?? false },
      });
      await writeAudit(c, {
        action: "product.created",
        entityType: "Product",
        entityId: product.id,
        details: {
          name: product.name,
          brand: names.brandName,
          category: names.categoryName,
          partNumber: product.partNumber,
          temporary: product.isTemporary,
        },
      });
      return product;
    });
  } catch (error) {
    if (uniqueViolation(error)) throw new ConflictError("A product with this part number already exists.", { partNumber: "Already in use" });
    throw error;
  }
}

export async function updateProduct(ctx: ServiceContext, input: ProductUpdateInput) {
  try {
    return await inTransaction(ctx, async (c) => {
      const { id, needsCuration, brandId, categoryId, ...profile } = input;
      const existing = await c.db.product.findUnique({ where: { id }, include: { brand: { select: { name: true } }, category: { select: { name: true } } } });
      if (!existing) throw new NotFoundError("Product");

      const names = await requireBrandAndCategory(c, brandId, categoryId, { brandId: existing.brandId, categoryId: existing.categoryId });
      const normalizedPartNumber = normalizeCodeOrNull(profile.partNumber);
      if (normalizedPartNumber && profile.partNumber) await assertPartNumberFree(c, normalizedPartNumber, profile.partNumber, id);

      const details: Record<string, Prisma.InputJsonValue> = { ...diffFields(existing, profile, PRODUCT_FIELDS) };
      if (existing.brandId !== brandId) details.brand = { from: existing.brand?.name ?? null, to: names.brandName };
      if (existing.categoryId !== categoryId) details.category = { from: existing.category?.name ?? null, to: names.categoryName };
      if (existing.isTemporary !== needsCuration) details.needsCuration = { from: existing.isTemporary, to: needsCuration };
      if (Object.keys(details).length === 0) return existing;

      const updated = await c.db.product.update({
        where: { id },
        data: { ...profile, brandId, categoryId, normalizedPartNumber, normalizedModel: normalizeCodeOrNull(profile.model), isTemporary: needsCuration },
      });
      await writeAudit(c, { action: "product.updated", entityType: "Product", entityId: id, details });
      return updated;
    });
  } catch (error) {
    if (uniqueViolation(error)) throw new ConflictError("A product with this part number already exists.", { partNumber: "Already in use" });
    throw error;
  }
}

export async function setProductStatus(ctx: ServiceContext, input: ProductStatusInput) {
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.product.findUnique({ where: { id: input.id }, select: { id: true, status: true } });
    if (!existing) throw new NotFoundError("Product");
    if (existing.status === input.status) return existing;
    const updated = await c.db.product.update({ where: { id: input.id }, data: { status: input.status } });
    await writeAudit(c, {
      action: "product.status_changed",
      entityType: "Product",
      entityId: input.id,
      details: { status: { from: existing.status, to: input.status } },
    });
    return updated;
  });
}

/**
 * Adds an alternative name for a product. The same alias may exist on several products (that produces a "possible match" for a human,
 * never a silent pick); it can't be duplicated on the SAME product, and it must add information beyond the product's own part number/model.
 */
export async function addAlias(ctx: ServiceContext, input: AliasAddInput, provenance: { source?: AliasSource; sourceBroadcastItemId?: string } = {}) {
  return inTransaction(ctx, async (c) => {
    const product = await c.db.product.findUnique({
      where: { id: input.productId },
      select: { id: true, status: true, normalizedPartNumber: true, normalizedModel: true },
    });
    if (!product) throw new NotFoundError("Product");
    if (product.status === "ARCHIVED") throw new InvariantError("This product is archived. Restore it before adding aliases.");

    const normalizedAlias = normalizeCode(input.alias);
    if (!normalizedAlias) throw new ValidationError("An alias needs at least one letter or number.", { alias: "Add letters or numbers" });
    if (normalizedAlias === product.normalizedPartNumber || normalizedAlias === product.normalizedModel) {
      throw new ValidationError("This already matches the product's part number or model, so an alias is not needed.", { alias: "Not needed" });
    }
    const duplicate = await c.db.productAlias.findUnique({ where: { productId_normalizedAlias: { productId: product.id, normalizedAlias } }, select: { id: true } });
    if (duplicate) throw new ConflictError("That alias already exists for this product.", { alias: "Already added" });

    const alias = await c.db.productAlias.create({
      data: {
        productId: product.id,
        alias: input.alias,
        normalizedAlias,
        source: provenance.source ?? "MANUAL",
        sourceBroadcastItemId: provenance.sourceBroadcastItemId ?? null,
        createdById: ctx.actor.id,
      },
    });
    await writeAudit(c, {
      action: "product_alias.added",
      entityType: "ProductAlias",
      entityId: alias.id,
      scope: { type: "Product", id: product.id },
      details: { alias: alias.alias },
    });
    return alias;
  });
}

/** Removing an alias is a real delete (it is naming metadata, not evidence), but the removed value is kept in the audit log. */
export async function removeAlias(ctx: ServiceContext, input: AliasRemoveInput) {
  return inTransaction(ctx, async (c) => {
    const alias = await c.db.productAlias.findUnique({ where: { id: input.id } });
    if (!alias) throw new NotFoundError("Alias");
    await c.db.productAlias.delete({ where: { id: alias.id } });
    await writeAudit(c, {
      action: "product_alias.removed",
      entityType: "ProductAlias",
      entityId: alias.id,
      scope: { type: "Product", id: alias.productId },
      details: { alias: alias.alias },
    });
    return { id: alias.id, productId: alias.productId };
  });
}
