import { beforeEach, describe, expect, it } from "vitest";
import type { ServiceContext } from "@/core/database/tx";
import { ConflictError, InvariantError, NotFoundError, ValidationError } from "@/core/errors";
import { createBrand, createCategory, createTestContext, resetDatabase, testDb } from "@/test/helpers";
import { listActivity } from "@/modules/audit/queries";
import { addContact, setContactStatus, updateContact } from "./contact.service";
import { listContacts, listSuppliers } from "./queries";
import { contactCreateSchema, contactUpdateSchema, supplierAssociationsSchema, supplierCreateSchema, supplierUpdateSchema } from "./schemas";
import { createSupplier, setSupplierAssociations, setSupplierStatus, updateSupplier } from "./service";

let ctx: ServiceContext;

beforeEach(async () => {
  await resetDatabase();
  ctx = await createTestContext();
});

const newSupplier = (over: Record<string, unknown> = {}) => supplierCreateSchema.parse({ name: "TEST ABC Computers", ...over });

describe("createSupplier", () => {
  it("stores a normalised name, keeps unknown fields null, and writes one audit row", async () => {
    const supplier = await createSupplier(ctx, newSupplier());

    expect(supplier.normalizedName).toBe("test abc computers");
    expect(supplier.type).toBeNull();
    expect(supplier.phone).toBeNull();
    expect(supplier.status).toBe("ACTIVE");

    const audit = await testDb.auditLog.findMany();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: "supplier.created", entityType: "Supplier", entityId: supplier.id, actorId: ctx.actor.id });
  });

  it("attaches brands and categories relationally", async () => {
    const dell = await createBrand("TEST Dell");
    const laptop = await createCategory("TEST Laptop");
    const supplier = await createSupplier(ctx, newSupplier({ brandIds: [dell.id], categoryIds: [laptop.id] }));

    const links = await testDb.supplier.findUniqueOrThrow({ where: { id: supplier.id }, include: { brands: true, categories: true } });
    expect(links.brands.map((b) => b.brandId)).toEqual([dell.id]);
    expect(links.categories.map((c) => c.categoryId)).toEqual([laptop.id]);
  });

  it("rejects a duplicate name regardless of case and spacing", async () => {
    await createSupplier(ctx, newSupplier());
    const duplicate = createSupplier(ctx, newSupplier({ name: "  test ABC   computers " }));
    await expect(duplicate).rejects.toBeInstanceOf(ConflictError);
    await expect(duplicate).rejects.toMatchObject({ fieldErrors: { name: "Already in use" } });
    expect(await testDb.supplier.count()).toBe(1);
  });

  it("tells the user when the duplicate is an archived supplier", async () => {
    const first = await createSupplier(ctx, newSupplier());
    await setSupplierStatus(ctx, { id: first.id, status: "ARCHIVED" });
    await expect(createSupplier(ctx, newSupplier())).rejects.toThrow(/archived/i);
  });

  it("rejects a duplicate supplier code", async () => {
    await createSupplier(ctx, newSupplier({ code: "SUP-001" }));
    await expect(createSupplier(ctx, newSupplier({ name: "TEST Other", code: "SUP-001" }))).rejects.toMatchObject({ fieldErrors: { code: "Already in use" } });
  });

  it("creates nothing (and no audit row) when a selected brand does not exist", async () => {
    const missing = "0198f000-0000-7000-8000-000000000000";
    await expect(createSupplier(ctx, newSupplier({ brandIds: [missing] }))).rejects.toBeInstanceOf(ValidationError);
    expect(await testDb.supplier.count()).toBe(0);
    expect(await testDb.auditLog.count()).toBe(0);
  });
});

describe("updateSupplier", () => {
  it("audits only the fields that changed, as from/to", async () => {
    const supplier = await createSupplier(ctx, newSupplier());
    await updateSupplier(ctx, supplierUpdateSchema.parse({ id: supplier.id, name: supplier.name, paymentTerms: "30 days", emirate: "Dubai" }));

    const audit = await testDb.auditLog.findFirstOrThrow({ where: { action: "supplier.updated" } });
    expect(audit.details).toEqual({ paymentTerms: { from: null, to: "30 days" }, emirate: { from: null, to: "Dubai" } });
  });

  it("writes no audit row when nothing changed", async () => {
    const supplier = await createSupplier(ctx, newSupplier());
    await updateSupplier(ctx, supplierUpdateSchema.parse({ id: supplier.id, name: supplier.name }));
    expect(await testDb.auditLog.count({ where: { action: "supplier.updated" } })).toBe(0);
  });

  it("re-normalises the name on rename and blocks a rename that collides", async () => {
    const a = await createSupplier(ctx, newSupplier({ name: "TEST Alpha" }));
    await createSupplier(ctx, newSupplier({ name: "TEST Beta" }));

    const renamed = await updateSupplier(ctx, supplierUpdateSchema.parse({ id: a.id, name: "TEST  Alpha Trading" }));
    expect(renamed.normalizedName).toBe("test alpha trading");

    await expect(updateSupplier(ctx, supplierUpdateSchema.parse({ id: a.id, name: "test beta" }))).rejects.toBeInstanceOf(ConflictError);
  });

  it("reports a missing supplier", async () => {
    await expect(updateSupplier(ctx, supplierUpdateSchema.parse({ id: "0198f000-0000-7000-8000-000000000000", name: "x" }))).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("setSupplierStatus", () => {
  it("archives a supplier and audits the change; the row is kept", async () => {
    const supplier = await createSupplier(ctx, newSupplier());
    await setSupplierStatus(ctx, { id: supplier.id, status: "ARCHIVED" });

    expect((await testDb.supplier.findUniqueOrThrow({ where: { id: supplier.id } })).status).toBe("ARCHIVED");
    const audit = await testDb.auditLog.findFirstOrThrow({ where: { action: "supplier.status_changed" } });
    expect(audit.details).toEqual({ status: { from: "ACTIVE", to: "ARCHIVED" } });
  });
});

describe("setSupplierAssociations", () => {
  it("adds and removes brands and records names in the audit details", async () => {
    const dell = await createBrand("TEST Dell");
    const hp = await createBrand("TEST HP");
    const supplier = await createSupplier(ctx, newSupplier({ brandIds: [dell.id] }));

    await setSupplierAssociations(ctx, supplierAssociationsSchema.parse({ id: supplier.id, brandIds: [hp.id] }));

    const brands = await testDb.supplierBrand.findMany({ where: { supplierId: supplier.id } });
    expect(brands.map((b) => b.brandId)).toEqual([hp.id]);
    const audit = await testDb.auditLog.findFirstOrThrow({ where: { action: "supplier.brands_changed" } });
    expect(audit.details).toEqual({ added: ["TEST HP"], removed: ["TEST Dell"] });
  });

  it("does not audit an unchanged selection", async () => {
    const dell = await createBrand("TEST Dell");
    const supplier = await createSupplier(ctx, newSupplier({ brandIds: [dell.id] }));
    await setSupplierAssociations(ctx, supplierAssociationsSchema.parse({ id: supplier.id, brandIds: [dell.id] }));
    expect(await testDb.auditLog.count({ where: { action: "supplier.brands_changed" } })).toBe(0);
  });

  it("blocks newly assigning an archived brand but keeps one that was already linked", async () => {
    const old = await createBrand("TEST Legacy");
    const supplier = await createSupplier(ctx, newSupplier({ brandIds: [old.id] }));
    await testDb.brand.update({ where: { id: old.id }, data: { status: "ARCHIVED" } });
    const other = await createSupplier(ctx, newSupplier({ name: "TEST Other" }));

    await expect(setSupplierAssociations(ctx, supplierAssociationsSchema.parse({ id: other.id, brandIds: [old.id] }))).rejects.toThrow(/archived/i);
    await expect(setSupplierAssociations(ctx, supplierAssociationsSchema.parse({ id: supplier.id, brandIds: [old.id] }))).resolves.toBeUndefined();
  });
});

describe("contacts", () => {
  it("adds a contact with brands and audits it under the supplier's scope", async () => {
    const dell = await createBrand("TEST Dell");
    const supplier = await createSupplier(ctx, newSupplier());
    const contact = await addContact(ctx, contactCreateSchema.parse({ supplierId: supplier.id, name: "TEST Ahmed", brandIds: [dell.id], preferredChannel: "WHATSAPP" }));

    expect(contact.preferredChannel).toBe("WHATSAPP");
    expect(contact.email).toBeNull();
    const audit = await testDb.auditLog.findFirstOrThrow({ where: { action: "supplier_contact.created" } });
    expect(audit).toMatchObject({ entityType: "SupplierContact", entityId: contact.id, scopeType: "Supplier", scopeId: supplier.id });
  });

  it("updates a contact, recording field and brand changes", async () => {
    const dell = await createBrand("TEST Dell");
    const hp = await createBrand("TEST HP");
    const supplier = await createSupplier(ctx, newSupplier());
    const contact = await addContact(ctx, contactCreateSchema.parse({ supplierId: supplier.id, name: "TEST Ahmed", brandIds: [dell.id] }));

    await updateContact(ctx, contactUpdateSchema.parse({ id: contact.id, name: "TEST Ahmed", jobTitle: "Sales", brandIds: [hp.id] }));

    const audit = await testDb.auditLog.findFirstOrThrow({ where: { action: "supplier_contact.updated" } });
    expect(audit.details).toEqual({ jobTitle: { from: null, to: "Sales" }, brands: { added: ["TEST HP"], removed: ["TEST Dell"] } });
  });

  it("archives a contact instead of deleting it, and hides it from the default list", async () => {
    const supplier = await createSupplier(ctx, newSupplier());
    const contact = await addContact(ctx, contactCreateSchema.parse({ supplierId: supplier.id, name: "TEST Ahmed" }));
    await setContactStatus(ctx, { id: contact.id, status: "ARCHIVED" });

    expect(await listContacts(supplier.id)).toHaveLength(0);
    expect(await listContacts(supplier.id, { includeArchived: true })).toHaveLength(1);
    expect(await testDb.auditLog.count({ where: { action: "supplier_contact.archived" } })).toBe(1);
  });

  it("refuses to add a contact to an archived supplier", async () => {
    const supplier = await createSupplier(ctx, newSupplier());
    await setSupplierStatus(ctx, { id: supplier.id, status: "ARCHIVED" });
    await expect(addContact(ctx, contactCreateSchema.parse({ supplierId: supplier.id, name: "TEST Ahmed" }))).rejects.toBeInstanceOf(InvariantError);
  });

  it("shows contact changes in the supplier's activity", async () => {
    const supplier = await createSupplier(ctx, newSupplier());
    await addContact(ctx, contactCreateSchema.parse({ supplierId: supplier.id, name: "TEST Ahmed" }));

    const activity = await listActivity({ type: "Supplier", id: supplier.id });
    expect(activity.map((a) => a.action).sort()).toEqual(["supplier.created", "supplier_contact.created"]);
    expect(activity[0]?.actorName).toBe("TEST Actor");
  });
});

describe("listSuppliers", () => {
  it("hides archived suppliers by default and shows them when asked", async () => {
    const keep = await createSupplier(ctx, newSupplier({ name: "TEST Keep" }));
    const gone = await createSupplier(ctx, newSupplier({ name: "TEST Gone" }));
    await setSupplierStatus(ctx, { id: gone.id, status: "ARCHIVED" });

    expect((await listSuppliers({ page: 1 })).rows.map((r) => r.id)).toEqual([keep.id]);
    expect((await listSuppliers({ page: 1, status: "ARCHIVED" })).rows.map((r) => r.id)).toEqual([gone.id]);
  });

  it("finds a supplier by its contact's email and by brand, and filters by brand id", async () => {
    const dell = await createBrand("TEST Dell");
    const a = await createSupplier(ctx, newSupplier({ name: "TEST Alpha", brandIds: [dell.id] }));
    await createSupplier(ctx, newSupplier({ name: "TEST Beta" }));
    await addContact(ctx, contactCreateSchema.parse({ supplierId: a.id, name: "TEST Ahmed", email: "ahmed@alpha.test" }));

    expect((await listSuppliers({ page: 1, q: "ahmed@alpha" })).rows.map((r) => r.id)).toEqual([a.id]);
    expect((await listSuppliers({ page: 1, q: "dell" })).rows.map((r) => r.id)).toEqual([a.id]);
    expect((await listSuppliers({ page: 1, brandId: dell.id })).rows.map((r) => r.id)).toEqual([a.id]);
    expect((await listSuppliers({ page: 1, q: "nothing-matches" })).total).toBe(0);
  });

  it("treats % and _ in a search as literal characters, not wildcards", async () => {
    await createSupplier(ctx, newSupplier({ name: "TEST Alpha" }));
    await createSupplier(ctx, newSupplier({ name: "TEST 100% Genuine" }));

    expect((await listSuppliers({ page: 1, q: "%" })).rows.map((r) => r.name)).toEqual(["TEST 100% Genuine"]);
    expect((await listSuppliers({ page: 1, q: "_" })).total).toBe(0);
    expect((await listSuppliers({ page: 1, q: "\\" })).total).toBe(0);
  });

  it("paginates on the server (25 per page) and reports the total", async () => {
    for (let i = 1; i <= 27; i++) await createSupplier(ctx, newSupplier({ name: `TEST Supplier ${String(i).padStart(2, "0")}` }));
    const first = await listSuppliers({ page: 1 });
    const second = await listSuppliers({ page: 2 });
    expect(first.total).toBe(27);
    expect(first.rows).toHaveLength(25);
    expect(second.rows).toHaveLength(2);
    expect(second.rows[1]?.name).toBe("TEST Supplier 27");
  });

  it("reports no last-evidence for a supplier without broadcasts (unknown, not a fake time)", async () => {
    await createSupplier(ctx, newSupplier());
    expect((await listSuppliers({ page: 1 })).rows[0]?.lastEvidenceAt).toBeNull();
  });
});
