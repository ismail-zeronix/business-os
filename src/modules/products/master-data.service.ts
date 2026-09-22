import { ConflictError, NotFoundError, uniqueViolation } from "../../core/errors";
import { assertAdmin } from "../../core/permissions/roles";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { normalizeName } from "../../lib/normalize";
import { writeAudit } from "../audit/service";
import type { MasterDataCreateInput, MasterDataRenameInput, MasterDataStatusInput } from "./master-data.schemas";

/**
 * Brands and Categories: the small reference lists that suppliers, contacts and products point at.
 * Never hard-deleted: status ACTIVE / INACTIVE / ARCHIVED. Names are unique case-insensitively across ALL statuses, so an archived
 * brand can't be silently re-created as a duplicate; the user is told to restore it instead.
 * Brand and Category have identical rules; the two sets below are deliberately explicit rather than generic over Prisma delegates.
 */

const duplicateMessage = (kind: "brand" | "category", archived: boolean) =>
  archived
    ? `A ${kind} with this name exists but is archived. Restore it from Settings instead of creating a duplicate.`
    : `A ${kind} with this name already exists.`;

// ───────────────────────────────────────── Brands ─────────────────────────────────────────

export async function createBrand(ctx: ServiceContext, input: MasterDataCreateInput) {
  assertAdmin(ctx);
  return inTransaction(ctx, async (c) => {
    const normalizedName = normalizeName(input.name);
    const existing = await c.db.brand.findUnique({ where: { normalizedName }, select: { status: true } });
    if (existing) throw new ConflictError(duplicateMessage("brand", existing.status === "ARCHIVED"), { name: "Already in use" });

    try {
      const brand = await c.db.brand.create({ data: { name: input.name, normalizedName } });
      await writeAudit(c, { action: "brand.created", entityType: "Brand", entityId: brand.id, details: { name: brand.name } });
      return brand;
    } catch (error) {
      if (uniqueViolation(error)) throw new ConflictError(duplicateMessage("brand", false), { name: "Already in use" });
      throw error;
    }
  });
}

export async function renameBrand(ctx: ServiceContext, input: MasterDataRenameInput) {
  assertAdmin(ctx);
  return inTransaction(ctx, async (c) => {
    const brand = await c.db.brand.findUnique({ where: { id: input.id } });
    if (!brand) throw new NotFoundError("Brand");
    const normalizedName = normalizeName(input.name);
    if (brand.name === input.name) return brand;

    const clash = await c.db.brand.findUnique({ where: { normalizedName }, select: { id: true, status: true } });
    if (clash && clash.id !== brand.id) throw new ConflictError(duplicateMessage("brand", clash.status === "ARCHIVED"), { name: "Already in use" });

    const updated = await c.db.brand.update({ where: { id: brand.id }, data: { name: input.name, normalizedName } });
    await writeAudit(c, { action: "brand.updated", entityType: "Brand", entityId: brand.id, details: { name: { from: brand.name, to: input.name } } });
    return updated;
  });
}

export async function setBrandStatus(ctx: ServiceContext, input: MasterDataStatusInput) {
  assertAdmin(ctx);
  return inTransaction(ctx, async (c) => {
    const brand = await c.db.brand.findUnique({ where: { id: input.id } });
    if (!brand) throw new NotFoundError("Brand");
    if (brand.status === input.status) return brand;
    const updated = await c.db.brand.update({ where: { id: brand.id }, data: { status: input.status } });
    await writeAudit(c, {
      action: "brand.status_changed",
      entityType: "Brand",
      entityId: brand.id,
      details: { status: { from: brand.status, to: input.status } },
    });
    return updated;
  });
}

// ───────────────────────────────────────── Categories ─────────────────────────────────────────

export async function createCategory(ctx: ServiceContext, input: MasterDataCreateInput) {
  assertAdmin(ctx);
  return inTransaction(ctx, async (c) => {
    const normalizedName = normalizeName(input.name);
    const existing = await c.db.category.findUnique({ where: { normalizedName }, select: { status: true } });
    if (existing) throw new ConflictError(duplicateMessage("category", existing.status === "ARCHIVED"), { name: "Already in use" });

    try {
      const category = await c.db.category.create({ data: { name: input.name, normalizedName } });
      await writeAudit(c, { action: "category.created", entityType: "Category", entityId: category.id, details: { name: category.name } });
      return category;
    } catch (error) {
      if (uniqueViolation(error)) throw new ConflictError(duplicateMessage("category", false), { name: "Already in use" });
      throw error;
    }
  });
}

export async function renameCategory(ctx: ServiceContext, input: MasterDataRenameInput) {
  assertAdmin(ctx);
  return inTransaction(ctx, async (c) => {
    const category = await c.db.category.findUnique({ where: { id: input.id } });
    if (!category) throw new NotFoundError("Category");
    const normalizedName = normalizeName(input.name);
    if (category.name === input.name) return category;

    const clash = await c.db.category.findUnique({ where: { normalizedName }, select: { id: true, status: true } });
    if (clash && clash.id !== category.id) throw new ConflictError(duplicateMessage("category", clash.status === "ARCHIVED"), { name: "Already in use" });

    const updated = await c.db.category.update({ where: { id: category.id }, data: { name: input.name, normalizedName } });
    await writeAudit(c, { action: "category.updated", entityType: "Category", entityId: category.id, details: { name: { from: category.name, to: input.name } } });
    return updated;
  });
}

export async function setCategoryStatus(ctx: ServiceContext, input: MasterDataStatusInput) {
  assertAdmin(ctx);
  return inTransaction(ctx, async (c) => {
    const category = await c.db.category.findUnique({ where: { id: input.id } });
    if (!category) throw new NotFoundError("Category");
    if (category.status === input.status) return category;
    const updated = await c.db.category.update({ where: { id: category.id }, data: { status: input.status } });
    await writeAudit(c, {
      action: "category.status_changed",
      entityType: "Category",
      entityId: category.id,
      details: { status: { from: category.status, to: input.status } },
    });
    return updated;
  });
}
