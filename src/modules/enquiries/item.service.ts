import { ConflictError, InvariantError, NotFoundError, ValidationError } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { diffFields, hasChanges } from "../../lib/diff";
import { writeAudit } from "../audit/service";
import { findMatchCandidates, pickAutoLink } from "../products/matching";
import { productCreateSchema } from "../products/schemas";
import { addAlias, createProduct } from "../products/service";
import type { EnquiryItemCreateProductInput, EnquiryItemLinkInput, EnquiryItemManualCreateInput, EnquiryItemReasonInput, EnquiryItemUpdateInput } from "./schemas";
import { enquiryScope, requireNotArchived, touchEnquiry } from "./shared";

/**
 * Enquiry item review. Items are proposals (PENDING); a person edits them, optionally links a product, and CONFIRMS that the requirement
 * is right. Confirming records no prices or stock: an enquiry is what the customer needs, not what a supplier offered. Reopening simply
 * returns the item to review. Nothing is ever deleted or overwritten: every change is audited with a before/after.
 */

const ITEM_FIELDS = ["description", "brandText", "familyText", "modelText", "partNumber", "specText", "quantity", "notes"] as const;

async function loadItem(c: ServiceContext, id: string) {
  const item = await c.db.enquiryItem.findUnique({ where: { id }, include: { enquiry: { select: { id: true, archivedAt: true } } } });
  if (!item) throw new NotFoundError("Requirement");
  return item;
}

function requirePending(item: { reviewStatus: string; enquiry: { archivedAt: Date | null } }) {
  requireNotArchived(item.enquiry);
  if (item.reviewStatus !== "PENDING") throw new InvariantError("This requirement is already reviewed. Reopen it to make changes.");
}

export async function updateEnquiryItem(ctx: ServiceContext, input: EnquiryItemUpdateInput) {
  return inTransaction(ctx, async (c) => {
    const { id, ...fields } = input;
    const item = await loadItem(c, id);
    requirePending(item);
    const changes = diffFields(item, fields, ITEM_FIELDS);
    if (!hasChanges(changes)) return item;
    const updated = await c.db.enquiryItem.update({ where: { id }, data: fields });
    await writeAudit(c, { action: "enquiry_item.updated", entityType: "EnquiryItem", entityId: id, scope: enquiryScope(item.enquiryId), details: changes });
    await touchEnquiry(c, item.enquiryId);
    return updated;
  });
}

/** Adds a requirement by hand (for a line the parser missed). It is proposed and pre-linked like a parsed item, and stays PENDING. */
export async function addManualEnquiryItem(ctx: ServiceContext, input: EnquiryItemManualCreateInput) {
  return inTransaction(ctx, async (c) => {
    const { enquiryId, sourceText, ...fields } = input;
    const enquiry = await c.db.enquiry.findUnique({ where: { id: enquiryId }, select: { id: true, archivedAt: true } });
    if (!enquiry) throw new NotFoundError("Enquiry");
    requireNotArchived(enquiry);
    const last = await c.db.enquiryItem.aggregate({ where: { enquiryId }, _max: { position: true } });

    const candidates = await findMatchCandidates(c.db, { partNumber: fields.partNumber, model: fields.modelText, brandText: fields.brandText, description: fields.description });
    const link = pickAutoLink(candidates);
    const item = await c.db.enquiryItem.create({
      data: {
        ...fields,
        enquiryId,
        position: (last._max.position ?? 0) + 1,
        sourceText: sourceText ?? "(added by hand)",
        origin: "MANUAL",
        productId: link?.productId ?? null,
        matchBasis: link?.basis ?? null,
      },
    });
    await writeAudit(c, { action: "enquiry_item.created", entityType: "EnquiryItem", entityId: item.id, scope: enquiryScope(enquiryId), details: { description: item.description } });
    await touchEnquiry(c, enquiryId);
    return item;
  });
}

/** Optionally teaches product matching a new wording. Never fails the link if the alias is redundant or already known. Returns whether it was added. */
async function rememberAliasIfUseful(c: ServiceContext, item: { description: string | null; brandText: string | null; modelText: string | null }, productId: string): Promise<boolean> {
  const wording = item.description ?? [item.brandText, item.modelText].filter(Boolean).join(" ");
  if (!wording.trim()) return false;
  try {
    await addAlias(c, { productId, alias: wording }, { source: "REVIEW" });
    return true;
  } catch (error) {
    if (!(error instanceof ConflictError) && !(error instanceof ValidationError)) throw error; // already known or adds nothing: fine
    return false;
  }
}

/** Links (or, with no product, unlinks) the requirement's product by a person's choice. */
export async function setEnquiryItemProduct(ctx: ServiceContext, input: EnquiryItemLinkInput) {
  return inTransaction(ctx, async (c) => {
    const item = await loadItem(c, input.itemId);
    requirePending(item);
    const before = item.productId ? await c.db.product.findUnique({ where: { id: item.productId }, select: { name: true } }) : null;

    let product: { id: string; name: string } | null = null;
    if (input.productId) {
      const found = await c.db.product.findUnique({ where: { id: input.productId }, select: { id: true, name: true, status: true } });
      if (!found) throw new NotFoundError("Product");
      if (found.status === "ARCHIVED") throw new InvariantError("That product is archived and cannot be linked.");
      product = { id: found.id, name: found.name };
    }
    if ((item.productId ?? null) === (product?.id ?? null)) return item;

    const updated = await c.db.enquiryItem.update({ where: { id: item.id }, data: { productId: product?.id ?? null, matchBasis: product ? "MANUAL" : null } });
    const aliasAdded = product && input.rememberAlias ? await rememberAliasIfUseful(c, item, product.id) : false;
    await writeAudit(c, {
      action: "enquiry_item.linked",
      entityType: "EnquiryItem",
      entityId: item.id,
      scope: enquiryScope(item.enquiryId),
      details: { product: { from: before?.name ?? null, to: product?.name ?? null }, ...(aliasAdded ? { aliasAdded: true } : {}) },
    });
    await touchEnquiry(c, item.enquiryId);
    return updated;
  });
}

/** Creates a TEMPORARY product from the requirement without leaving the review, and links it. Incomplete master data must not block entry. */
export async function createProductForEnquiryItem(ctx: ServiceContext, input: EnquiryItemCreateProductInput) {
  return inTransaction(ctx, async (c) => {
    const { itemId, rememberAlias, ...profile } = input;
    const item = await loadItem(c, itemId);
    requirePending(item);

    const product = await createProduct(c, productCreateSchema.parse(profile), { isTemporary: true });
    const updated = await c.db.enquiryItem.update({ where: { id: item.id }, data: { productId: product.id, matchBasis: "NEW_PRODUCT" } });
    const aliasAdded = rememberAlias ? await rememberAliasIfUseful(c, item, product.id) : false;
    await writeAudit(c, {
      action: "enquiry_item.linked",
      entityType: "EnquiryItem",
      entityId: item.id,
      scope: enquiryScope(item.enquiryId),
      details: { product: { from: null, to: product.name }, created: true, ...(aliasAdded ? { aliasAdded: true } : {}) },
    });
    await touchEnquiry(c, item.enquiryId);
    return { item: updated, product };
  });
}

/**
 * A person confirms that this requirement is right. It needs something to identify it (a description, model or part number). A linked
 * product is optional (master data may be incomplete) but must not be archived. Records no prices or stock.
 */
export async function confirmEnquiryItem(ctx: ServiceContext, itemId: string) {
  return inTransaction(ctx, async (c) => {
    const item = await c.db.enquiryItem.findUnique({ where: { id: itemId }, include: { enquiry: { select: { id: true, archivedAt: true } }, product: { select: { name: true, status: true } } } });
    if (!item) throw new NotFoundError("Requirement");
    requirePending(item);
    if (!item.description && !item.modelText && !item.partNumber) throw new InvariantError("Add a description, model or part number before confirming.");
    if (item.product?.status === "ARCHIVED") throw new InvariantError("The linked product is archived. Choose another product or unlink it.");

    const confirmed = await c.db.enquiryItem.update({ where: { id: item.id }, data: { reviewStatus: "CONFIRMED", confirmedAt: new Date(), confirmedById: ctx.actor.id, ignoredReason: null } });
    await writeAudit(c, {
      action: "enquiry_item.confirmed",
      entityType: "EnquiryItem",
      entityId: item.id,
      scope: enquiryScope(item.enquiryId),
      details: { requirement: item.description ?? item.modelText ?? item.partNumber, product: item.product?.name ?? null, quantity: item.quantity },
    });
    await touchEnquiry(c, item.enquiryId);
    return confirmed;
  });
}

/** Saves the reviewer's edits and confirms in one transaction (the "Confirm" button on the item editor). */
export async function saveAndConfirmEnquiryItem(ctx: ServiceContext, input: EnquiryItemUpdateInput) {
  return inTransaction(ctx, async (c) => {
    await updateEnquiryItem(c, input);
    return confirmEnquiryItem(c, input.id);
  });
}

export async function ignoreEnquiryItem(ctx: ServiceContext, input: EnquiryItemReasonInput) {
  return inTransaction(ctx, async (c) => {
    const item = await loadItem(c, input.id);
    requirePending(item);
    const updated = await c.db.enquiryItem.update({ where: { id: item.id }, data: { reviewStatus: "IGNORED", ignoredReason: input.reason } });
    await writeAudit(c, { action: "enquiry_item.ignored", entityType: "EnquiryItem", entityId: item.id, scope: enquiryScope(item.enquiryId), details: { reason: input.reason } });
    await touchEnquiry(c, item.enquiryId);
    return updated;
  });
}

/** Returns a reviewed requirement to PENDING. There are no observations to retract: nothing else changes. */
export async function reopenEnquiryItem(ctx: ServiceContext, input: EnquiryItemReasonInput) {
  return inTransaction(ctx, async (c) => {
    const item = await loadItem(c, input.id);
    requireNotArchived(item.enquiry);
    if (item.reviewStatus === "PENDING") throw new InvariantError("This requirement is already open for review.");
    const updated = await c.db.enquiryItem.update({ where: { id: item.id }, data: { reviewStatus: "PENDING", confirmedAt: null, confirmedById: null, ignoredReason: null } });
    await writeAudit(c, { action: "enquiry_item.reopened", entityType: "EnquiryItem", entityId: item.id, scope: enquiryScope(item.enquiryId), details: { was: item.reviewStatus, reason: input.reason } });
    await touchEnquiry(c, item.enquiryId);
    return updated;
  });
}
