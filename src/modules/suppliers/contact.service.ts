import { InvariantError, NotFoundError } from "../../core/errors";
import type { Prisma } from "../../generated/prisma/client";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { diffFields, hasChanges } from "../../lib/diff";
import { writeAudit } from "../audit/service";
import { diffIds, requireBrands, requireCategories } from "./associations";
import type { ContactCreateInput, ContactStatusInput, ContactUpdateInput } from "./schemas";

const CONTACT_FIELDS = ["name", "jobTitle", "department", "phone", "whatsapp", "email", "preferredChannel", "notes"] as const;

/** Contact changes are audited with scope = the owning supplier, so they appear in the supplier's Activity tab. */
const supplierScope = (supplierId: string) => ({ type: "Supplier" as const, id: supplierId });

export async function addContact(ctx: ServiceContext, input: ContactCreateInput) {
  return inTransaction(ctx, async (c) => {
    const { supplierId, brandIds, categoryIds, ...profile } = input;
    const supplier = await c.db.supplier.findUnique({ where: { id: supplierId }, select: { id: true, status: true } });
    if (!supplier) throw new NotFoundError("Supplier");
    if (supplier.status === "ARCHIVED") throw new InvariantError("This supplier is archived. Restore it before adding contacts.");

    const brands = await requireBrands(c, brandIds, []);
    const categories = await requireCategories(c, categoryIds, []);

    const contact = await c.db.supplierContact.create({
      data: {
        ...profile,
        supplierId,
        brands: { create: brandIds.map((brandId) => ({ brandId })) },
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
      },
    });
    await writeAudit(c, {
      action: "supplier_contact.created",
      entityType: "SupplierContact",
      entityId: contact.id,
      scope: supplierScope(supplierId),
      details: { name: contact.name, brands: brands.map((b) => b.name), categories: categories.map((cat) => cat.name) },
    });
    return contact;
  });
}

export async function updateContact(ctx: ServiceContext, input: ContactUpdateInput) {
  return inTransaction(ctx, async (c) => {
    const { id, brandIds, categoryIds, ...profile } = input;
    const existing = await c.db.supplierContact.findUnique({
      where: { id },
      include: { brands: { select: { brandId: true, brand: { select: { name: true } } } }, categories: { select: { categoryId: true, category: { select: { name: true } } } } },
    });
    if (!existing) throw new NotFoundError("Contact");

    const fieldChanges = diffFields(existing, profile, CONTACT_FIELDS);
    const details: Record<string, Prisma.InputJsonValue> = { ...fieldChanges };

    const currentBrandIds = existing.brands.map((b) => b.brandId);
    const brandDiff = diffIds(currentBrandIds, brandIds);
    if (brandDiff.toAdd.length || brandDiff.toRemove.length) {
      const wanted = await requireBrands(c, brandIds, currentBrandIds);
      const added = wanted.filter((b) => brandDiff.toAdd.includes(b.id));
      if (brandDiff.toRemove.length) await c.db.supplierContactBrand.deleteMany({ where: { contactId: id, brandId: { in: brandDiff.toRemove } } });
      if (added.length) await c.db.supplierContactBrand.createMany({ data: added.map((b) => ({ contactId: id, brandId: b.id })) });
      details.brands = { added: added.map((b) => b.name), removed: existing.brands.filter((b) => brandDiff.toRemove.includes(b.brandId)).map((b) => b.brand.name) };
    }

    const currentCategoryIds = existing.categories.map((cat) => cat.categoryId);
    const categoryDiff = diffIds(currentCategoryIds, categoryIds);
    if (categoryDiff.toAdd.length || categoryDiff.toRemove.length) {
      const wanted = await requireCategories(c, categoryIds, currentCategoryIds);
      const added = wanted.filter((cat) => categoryDiff.toAdd.includes(cat.id));
      if (categoryDiff.toRemove.length) await c.db.supplierContactCategory.deleteMany({ where: { contactId: id, categoryId: { in: categoryDiff.toRemove } } });
      if (added.length) await c.db.supplierContactCategory.createMany({ data: added.map((cat) => ({ contactId: id, categoryId: cat.id })) });
      details.categories = {
        added: added.map((cat) => cat.name),
        removed: existing.categories.filter((cat) => categoryDiff.toRemove.includes(cat.categoryId)).map((cat) => cat.category.name),
      };
    }

    if (!hasChanges(fieldChanges) && Object.keys(details).length === 0) return existing;

    const updated = await c.db.supplierContact.update({ where: { id }, data: profile });
    await writeAudit(c, {
      action: "supplier_contact.updated",
      entityType: "SupplierContact",
      entityId: id,
      scope: supplierScope(existing.supplierId),
      details,
    });
    return updated;
  });
}

/** Archive (soft-delete), deactivate or restore a contact. Contacts referenced by broadcasts and observations are never hard-deleted. */
export async function setContactStatus(ctx: ServiceContext, input: ContactStatusInput) {
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.supplierContact.findUnique({ where: { id: input.id }, select: { id: true, supplierId: true, status: true } });
    if (!existing) throw new NotFoundError("Contact");
    if (existing.status === input.status) return existing;
    const updated = await c.db.supplierContact.update({ where: { id: input.id }, data: { status: input.status } });
    await writeAudit(c, {
      action: input.status === "ARCHIVED" ? "supplier_contact.archived" : "supplier_contact.updated",
      entityType: "SupplierContact",
      entityId: input.id,
      scope: supplierScope(existing.supplierId),
      details: { status: { from: existing.status, to: input.status } },
    });
    return updated;
  });
}
