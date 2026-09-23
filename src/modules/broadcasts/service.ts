import { ConflictError, DomainError, InvariantError, NotFoundError, ValidationError } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import type { Prisma } from "../../generated/prisma/client";
import type { EvidenceChannel, MatchBasis } from "../../generated/prisma/enums";
import { diffFields, hasChanges } from "../../lib/diff";
import { formatMoney } from "../../lib/format";
import { normalizeName } from "../../lib/normalize";
import { writeAudit } from "../audit/service";
import { createEvidence, contentHashOf } from "../evidence/service";
import { createPriceObservation, createStockObservation, retractObservationsForItem } from "../observations/service";
import { findMatchCandidates, pickAutoLink } from "../products/matching";
import { productCreateSchema } from "../products/schemas";
import { addAlias, createProduct } from "../products/service";
import { assertRequestAcceptsReply, markRequestReplied } from "../sourcing/service";
import { rulesParser } from "./parsing/rules-parser";
import { isItemReady } from "./readiness";
import { itemUpdateSchema, type BroadcastArchiveInput, type ItemCreateProductInput, type ItemLinkInput, type ItemManualCreateInput, type ItemReasonInput, type ItemUpdateInput } from "./schemas";

/**
 * Broadcast review workflow. The original message is stored as immutable evidence; parsed lines become PENDING items (proposals);
 * a person edits, links a product and CONFIRMS, which is the only thing that creates price/stock observations. Every step is audited
 * in the same transaction. Reopening a confirmed item retracts its observations; nothing is ever overwritten or deleted.
 */

/** The same supplier already has a broadcast with this exact wording. Not a hard error: the user may save it anyway. */
export class DuplicateBroadcastError extends ConflictError {
  readonly existingBroadcastId: string;
  constructor(existingBroadcastId: string) {
    super("This exact message was already saved for this supplier. Tick \"Save anyway\" if you really want a second copy.", { _duplicate: existingBroadcastId });
    this.existingBroadcastId = existingBroadcastId;
  }
}

const ITEM_FIELDS = ["description", "brandText", "modelText", "partNumber", "categoryText", "specText", "quantity", "priceAmount", "currencyCode", "vatState", "stockStatus", "warrantyMonths", "warrantyType", "notes"] as const;
const broadcastScope = (broadcastId: string) => ({ type: "Broadcast" as const, id: broadcastId });

const PRODUCT_NAME_MAX = 250; // productCreateSchema's `name` cap (products/schemas.ts); an item's description allows up to 300.

/** The product name to auto-create from an item with no match: uses the item's description, or falls back to "brand model". */
function productNameFromItem(fields: { description: string | null; brandText: string | null; modelText: string | null }): string {
  const name = fields.description?.trim() || [fields.brandText, fields.modelText].filter(Boolean).join(" ");
  return name.trim().slice(0, PRODUCT_NAME_MAX);
}

/**
 * "Whatever a supplier pastes is a product": when an item has NO match candidates at all (not even an ambiguous one), it is
 * auto-created as a TEMPORARY product and linked, instead of leaving a person to click "Create product" for the obvious case.
 * Only for the genuinely unmatched case — an item with real (even if ambiguous) candidates is left for a person, because
 * guessing wrong among existing candidates corrupts an EXISTING product's history, which is worse than a redundant new one.
 * Returns null (item stays unlinked, same as today) on a part-number collision or similar, so one bad line never fails the
 * whole save.
 */
async function autoCreateProduct(c: ServiceContext, fields: { description: string | null; specText: string | null; brandText: string | null; modelText: string | null; partNumber: string | null }) {
  const name = productNameFromItem(fields);
  if (!name) return null;
  const brandKey = fields.brandText?.trim() ? normalizeName(fields.brandText) : null;
  const brand = brandKey ? await c.db.brand.findFirst({ where: { normalizedName: brandKey, status: { not: "ARCHIVED" } }, select: { id: true } }) : null;
  try {
    return await createProduct(c, productCreateSchema.parse({ name, description: fields.specText?.trim() || null, brandId: brand?.id ?? null, model: fields.modelText, partNumber: fields.partNumber }), { isTemporary: true });
  } catch (error) {
    if (error instanceof DomainError) return null; // part-number collision (or a rare validation edge case): a person resolves it via the picker
    throw error;
  }
}

// ───────────────────────────────────────── create ─────────────────────────────────────────

export async function createBroadcast(
  ctx: ServiceContext,
  input: {
    supplierId: string;
    contactId: string | null;
    channel: EvidenceChannel;
    observedAt: Date;
    rawText: string;
    notes: string | null;
    allowDuplicate: boolean;
    /** Set when this message is the supplier's reply to a sourcing request (the request becomes REPLIED in the same transaction). */
    supplierRequestId: string | null;
    /** Optional fallback category: applied only to items the parser could not classify from the text itself. */
    categoryHintId: string | null;
  },
) {
  return inTransaction(ctx, async (c) => {
    const supplier = await c.db.supplier.findUnique({ where: { id: input.supplierId }, select: { id: true, name: true, status: true } });
    if (!supplier) throw new NotFoundError("Supplier");
    if (supplier.status === "ARCHIVED") throw new InvariantError("This supplier is archived. Restore it before recording a broadcast.");

    if (input.contactId) {
      const contact = await c.db.supplierContact.findUnique({ where: { id: input.contactId }, select: { supplierId: true, status: true } });
      if (!contact || contact.supplierId !== supplier.id) throw new ValidationError("That contact does not belong to this supplier.", { contactId: "Choose a contact of this supplier" });
      if (contact.status === "ARCHIVED") throw new ValidationError("That contact is archived.", { contactId: "Archived" });
    }

    if (input.supplierRequestId) await assertRequestAcceptsReply(c, input.supplierRequestId, supplier.id);

    if (!input.allowDuplicate) {
      const duplicate = await c.db.broadcast.findFirst({
        where: { supplierId: supplier.id, archivedAt: null, evidenceSource: { contentHash: contentHashOf(input.rawText) } },
        select: { id: true },
      });
      if (duplicate) throw new DuplicateBroadcastError(duplicate.id);
    }

    const evidence = await createEvidence(c, { kind: "SUPPLIER_BROADCAST", channel: input.channel, rawText: input.rawText, observedAt: input.observedAt });
    const broadcast = await c.db.broadcast.create({
      data: { evidenceSourceId: evidence.id, supplierId: supplier.id, contactId: input.contactId, supplierRequestId: input.supplierRequestId, notes: input.notes, createdById: ctx.actor.id },
    });

    // Propose items deterministically, then pre-link a product only when exactly one strong match exists. Everything stays PENDING.
    const brandNames = (await c.db.brand.findMany({ where: { status: { not: "ARCHIVED" } }, select: { name: true } })).map((b) => b.name);
    const categoryRows = await c.db.category.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, name: true } });
    const categoryNames = categoryRows.map((cat) => cat.name);
    const hintCategoryName = input.categoryHintId ? (categoryRows.find((cat) => cat.id === input.categoryHintId)?.name ?? null) : null;
    const parsed = rulesParser.parse(input.rawText, { brands: brandNames, categories: categoryNames }).map((item) => ({
      ...item,
      categoryText: item.categoryText ?? hintCategoryName, // the hint only fills what the parser could not read itself
    }));
    let autoCreatedProducts = 0;
    for (const item of parsed) {
      const candidates = await findMatchCandidates(c.db, { partNumber: item.partNumber, model: item.modelText, brandText: item.brandText, description: item.description });
      const link = pickAutoLink(candidates);
      let matchBasis: MatchBasis | null = link?.basis ?? null;
      let productId: string | null = link?.productId ?? null;
      if (candidates.length === 0) {
        const created = await autoCreateProduct(c, item);
        if (created) {
          productId = created.id;
          matchBasis = "NEW_PRODUCT";
          autoCreatedProducts++;
        }
      }
      const { extractedData, confidence, ...fields } = item;
      // The parser's original values are kept write-once in extracted_data, so the evidence view can always show "original vs corrected".
      const original = {
        description: fields.description,
        brandText: fields.brandText,
        modelText: fields.modelText,
        partNumber: fields.partNumber,
        categoryText: fields.categoryText,
        specText: fields.specText,
        quantity: fields.quantity,
        priceAmount: fields.priceAmount,
        currencyCode: fields.currencyCode,
        vatState: fields.vatState,
        stockStatus: fields.stockStatus,
        warrantyMonths: fields.warrantyMonths,
        warrantyType: fields.warrantyType,
      };
      await c.db.broadcastItem.create({
        data: {
          ...fields,
          broadcastId: broadcast.id,
          origin: "PARSER",
          extractionConfidence: confidence,
          extractedData: { ...extractedData, fields: original } as Prisma.InputJsonValue,
          productId,
          matchBasis,
        },
      });
    }

    await writeAudit(c, {
      action: "broadcast.created",
      entityType: "Broadcast",
      entityId: broadcast.id,
      details: {
        supplier: supplier.name,
        channel: input.channel,
        items: parsed.length,
        parser: `${rulesParser.name} v${rulesParser.version}`,
        ...(autoCreatedProducts ? { autoCreatedProducts } : {}),
        ...(input.supplierRequestId ? { replyToRequest: input.supplierRequestId } : {}),
      },
    });
    if (input.supplierRequestId) await markRequestReplied(c, input.supplierRequestId, broadcast.id);
    return { broadcast, itemCount: parsed.length };
  });
}

// ───────────────────────────────────────── items ─────────────────────────────────────────

async function loadItem(c: ServiceContext, id: string) {
  const item = await c.db.broadcastItem.findUnique({ where: { id } });
  if (!item) throw new NotFoundError("Broadcast item");
  return item;
}

function requirePending(item: { reviewStatus: string }) {
  if (item.reviewStatus !== "PENDING") throw new InvariantError("This item is already reviewed. Reopen it to make changes.");
}

export async function updateItem(ctx: ServiceContext, input: ItemUpdateInput) {
  return inTransaction(ctx, async (c) => {
    const { id, ...fields } = input;
    const item = await loadItem(c, id);
    requirePending(item);
    // Money is compared canonically ("2450.50" and Decimal 2450.5 are the same amount), so no phantom change is reported.
    const canonicalPrice = fields.priceAmount === null ? null : String(Number(fields.priceAmount));
    const changes = diffFields(item, { ...fields, priceAmount: canonicalPrice }, ITEM_FIELDS);
    if (!hasChanges(changes)) return item;
    const updated = await c.db.broadcastItem.update({ where: { id }, data: fields });
    await writeAudit(c, { action: "broadcast_item.updated", entityType: "BroadcastItem", entityId: id, scope: broadcastScope(item.broadcastId), details: changes });
    return updated;
  });
}

type BulkRowKey = "id" | "description" | "brandText" | "modelText" | "categoryText" | "partNumber" | "specText" | "quantity" | "priceAmount" | "currencyCode" | "vatState" | "stockStatus" | "warrantyMonths" | "warrantyType" | "notes";

/**
 * The bulk review table's "Apply all": saves corrected values onto every changed PENDING item in one transaction, reusing
 * updateItem's own validation, diffing and audit row per item (one broadcast_item.updated row per changed item — no new
 * audit vocabulary). It never confirms, links a product, or changes review_status; that still happens afterward in the
 * existing per-item flow. An item no longer PENDING when this runs (someone else confirmed it in the meantime) is skipped,
 * not failed, so one stale row never blocks the rest.
 */
export async function bulkUpdateItems(ctx: ServiceContext, input: { broadcastId: string; rows: Record<BulkRowKey, string>[] }) {
  return inTransaction(ctx, async (c) => {
    const broadcast = await c.db.broadcast.findUnique({ where: { id: input.broadcastId }, select: { id: true } });
    if (!broadcast) throw new NotFoundError("Broadcast");

    let updated = 0;
    for (const row of input.rows) {
      const before = await c.db.broadcastItem.findUnique({ where: { id: row.id } });
      if (!before || before.reviewStatus !== "PENDING") continue; // reviewed elsewhere in the meantime: leave it, don't fail the batch
      const after = await updateItem(c, itemUpdateSchema.parse(row));
      if (after.updatedAt.getTime() !== before.updatedAt.getTime()) updated++;
    }
    return { updated };
  });
}

/** Adds an item by hand (for a line the parser missed). It is proposed and pre-linked like a parsed item, and stays PENDING. */
export async function addManualItem(ctx: ServiceContext, input: ItemManualCreateInput) {
  return inTransaction(ctx, async (c) => {
    const { broadcastId, sourceText, ...fields } = input;
    const broadcast = await c.db.broadcast.findUnique({ where: { id: broadcastId }, select: { id: true, archivedAt: true } });
    if (!broadcast) throw new NotFoundError("Broadcast");
    if (broadcast.archivedAt) throw new InvariantError("This broadcast is archived.");
    const last = await c.db.broadcastItem.aggregate({ where: { broadcastId }, _max: { position: true } });

    const candidates = await findMatchCandidates(c.db, { partNumber: fields.partNumber, model: fields.modelText, brandText: fields.brandText, description: fields.description });
    const link = pickAutoLink(candidates);
    let matchBasis: MatchBasis | null = link?.basis ?? null;
    let productId: string | null = link?.productId ?? null;
    let autoCreated = false;
    if (candidates.length === 0) {
      const created = await autoCreateProduct(c, fields);
      if (created) {
        productId = created.id;
        matchBasis = "NEW_PRODUCT";
        autoCreated = true;
      }
    }
    const item = await c.db.broadcastItem.create({
      data: {
        ...fields,
        broadcastId,
        position: (last._max.position ?? 0) + 1,
        sourceText: sourceText ?? "(added by hand)",
        origin: "MANUAL",
        productId,
        matchBasis,
      },
    });
    await writeAudit(c, {
      action: "broadcast_item.created",
      entityType: "BroadcastItem",
      entityId: item.id,
      scope: broadcastScope(broadcastId),
      details: { description: item.description, ...(autoCreated ? { autoCreatedProduct: true } : {}) },
    });
    return item;
  });
}

/** Optionally teaches product matching a new wording, with provenance. Never fails the link if the alias is redundant or already known. */
async function rememberAliasIfUseful(c: ServiceContext, item: { id: string; description: string | null; brandText: string | null; modelText: string | null }, productId: string) {
  const wording = item.description ?? [item.brandText, item.modelText].filter(Boolean).join(" ");
  if (!wording.trim()) return;
  try {
    await addAlias(c, { productId, alias: wording }, { source: "REVIEW", sourceBroadcastItemId: item.id });
  } catch (error) {
    if (!(error instanceof ConflictError) && !(error instanceof ValidationError)) throw error; // already known or adds nothing: fine
  }
}

/** Links (or, with no product, unlinks) the item's product by a person's choice. */
export async function setItemProduct(ctx: ServiceContext, input: ItemLinkInput) {
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

    const updated = await c.db.broadcastItem.update({ where: { id: item.id }, data: { productId: product?.id ?? null, matchBasis: product ? "MANUAL" : null } });
    await writeAudit(c, {
      action: "broadcast_item.linked",
      entityType: "BroadcastItem",
      entityId: item.id,
      scope: broadcastScope(item.broadcastId),
      details: { product: { from: before?.name ?? null, to: product?.name ?? null } },
    });
    if (product && input.rememberAlias) await rememberAliasIfUseful(c, item, product.id);
    return updated;
  });
}

/** Creates a TEMPORARY product from the item without leaving the review, and links it. Master data may be incomplete; that must not block entry. */
export async function createProductForItem(ctx: ServiceContext, input: ItemCreateProductInput) {
  return inTransaction(ctx, async (c) => {
    const { itemId, rememberAlias, ...profile } = input;
    const item = await loadItem(c, itemId);
    requirePending(item);

    const product = await createProduct(c, productCreateSchema.parse(profile), { isTemporary: true });
    const updated = await c.db.broadcastItem.update({ where: { id: item.id }, data: { productId: product.id, matchBasis: "NEW_PRODUCT" } });
    await writeAudit(c, {
      action: "broadcast_item.linked",
      entityType: "BroadcastItem",
      entityId: item.id,
      scope: broadcastScope(item.broadcastId),
      details: { product: { from: null, to: product.name }, created: true },
    });
    if (rememberAlias) await rememberAliasIfUseful(c, item, product.id);
    return { item: updated, product };
  });
}

export type BackfillSummary = { checked: number; linked: number; itemIds: string[] };

/**
 * One-time catch-up for items saved before auto-create existed (see autoCreateProduct): re-checks every PENDING item with
 * no product link, across every broadcast, under the exact same two rules used at parse/add time — an unambiguous match
 * (pickAutoLink) links it; failing that, zero candidates auto-creates; anything genuinely ambiguous is left untouched for
 * a person, same as always. Each item is its own transaction, so items sharing a model still converge onto one
 * auto-created product (the next item's candidate search sees the previous item's already-committed product, and links to
 * it via the ordinary pickAutoLink path) without one bad item blocking the rest. Meant to be run once, from a script; new
 * items don't need it, since createBroadcast/addManualItem already do this at save time.
 */
export async function backfillAutoCreateProducts(ctx: ServiceContext): Promise<BackfillSummary> {
  const items = await ctx.db.broadcastItem.findMany({
    where: { reviewStatus: "PENDING", productId: null },
    orderBy: [{ broadcastId: "asc" }, { position: "asc" }],
    select: { id: true, broadcastId: true, description: true, specText: true, brandText: true, modelText: true, partNumber: true },
  });

  const linkedIds: string[] = [];
  for (const item of items) {
    await inTransaction(ctx, async (c) => {
      const candidates = await findMatchCandidates(c.db, { partNumber: item.partNumber, model: item.modelText, brandText: item.brandText, description: item.description });
      const link = pickAutoLink(candidates);
      let productId: string | null = link?.productId ?? null;
      let matchBasis: MatchBasis | null = link?.basis ?? null;
      let productName: string | null = link?.name ?? null;
      if (!link && candidates.length === 0) {
        const created = await autoCreateProduct(c, item);
        if (created) {
          productId = created.id;
          matchBasis = "NEW_PRODUCT";
          productName = created.name;
        }
      }
      if (!productId) return; // still ambiguous, or a collision: leave for a person, unchanged
      await c.db.broadcastItem.update({ where: { id: item.id }, data: { productId, matchBasis } });
      await writeAudit(c, {
        action: "broadcast_item.linked",
        entityType: "BroadcastItem",
        entityId: item.id,
        scope: broadcastScope(item.broadcastId),
        details: { product: { from: null, to: productName }, backfill: true },
      });
      linkedIds.push(item.id);
    });
  }
  return { checked: items.length, linked: linkedIds.length, itemIds: linkedIds };
}

// ───────────────────────────────────── confirm / ignore / reopen ─────────────────────────────────────

/**
 * The one step that turns a reviewed item into business data. Requires an ACTIVE linked product. There is always something to
 * record: a price with no currency is recorded in AED (this business runs on a single currency), and an item with neither a
 * price nor an explicit stock signal is recorded with a stock status of AVAILABLE (a supplier listing a product is itself
 * evidence they carry it). Neither default is written back onto the item itself (its own currencyCode/stockStatus stay as
 * they were, so a person can still fill them in later via Reopen) — only the created observation records the resolved value,
 * and the audit row flags which defaults were applied. Creates the observations with the evidence's own timestamp.
 */
export async function confirmItem(ctx: ServiceContext, itemId: string) {
  return inTransaction(ctx, async (c) => {
    const item = await c.db.broadcastItem.findUnique({
      where: { id: itemId },
      include: { broadcast: { select: { id: true, supplierId: true, contactId: true, evidenceSource: { select: { id: true, observedAt: true } } } }, product: { select: { id: true, name: true, status: true } } },
    });
    if (!item) throw new NotFoundError("Broadcast item");
    requirePending(item);
    if (!item.product) throw new InvariantError("Link or create a product before confirming.");
    if (item.product.status === "ARCHIVED") throw new InvariantError("The linked product is archived. Choose another product.");

    const hasPrice = item.priceAmount !== null;
    const hasStock = item.quantity !== null || item.stockStatus !== "UNKNOWN";
    const currencyCode = item.currencyCode ?? (hasPrice ? "AED" : null);
    const inferred: string[] = [];
    if (hasPrice && !item.currencyCode) inferred.push("currency set to AED (no currency stated)");
    if (!hasStock) inferred.push("stock status set to AVAILABLE (no price or stock stated)");

    const { supplierId, contactId, evidenceSource } = item.broadcast;
    const scope = broadcastScope(item.broadcast.id);
    const base = { productId: item.product.id, supplierId, contactId, observedAt: evidenceSource.observedAt, evidenceSourceId: evidenceSource.id, broadcastItemId: item.id, scope };

    const recorded: string[] = [];
    if (hasPrice && item.priceAmount && currencyCode) {
      await createPriceObservation(c, { ...base, amount: item.priceAmount.toString(), currencyCode, vatState: item.vatState, warrantyMonths: item.warrantyMonths, warrantyType: item.warrantyType });
      recorded.push(formatMoney(item.priceAmount, currencyCode));
    }
    if (hasStock) {
      await createStockObservation(c, { ...base, quantity: item.quantity, status: item.stockStatus });
      recorded.push(item.quantity !== null ? `${item.quantity} pcs` : item.stockStatus);
    } else {
      await createStockObservation(c, { ...base, quantity: null, status: "AVAILABLE" });
      recorded.push("available (inferred)");
    }

    const confirmed = await c.db.broadcastItem.update({ where: { id: item.id }, data: { reviewStatus: "CONFIRMED", confirmedAt: new Date(), confirmedById: ctx.actor.id, ignoredReason: null } });
    await writeAudit(c, {
      action: "broadcast_item.confirmed",
      entityType: "BroadcastItem",
      entityId: item.id,
      scope,
      details: { product: item.product.name, recorded, ...(inferred.length ? { inferredDefaults: inferred } : {}) },
    });
    return confirmed;
  });
}

/** Saves the reviewer's edits and confirms in one transaction (the "Confirm" button on the item editor). */
export async function saveAndConfirmItem(ctx: ServiceContext, input: ItemUpdateInput) {
  return inTransaction(ctx, async (c) => {
    await updateItem(c, input);
    return confirmItem(c, input.id);
  });
}

export type ConfirmReadyFailure = { itemId: string; description: string | null; reason: string };
export type ConfirmReadySummary = { readyCount: number; confirmedCount: number; failed: ConfirmReadyFailure[] };

/**
 * "Confirm N ready items": confirms every PENDING item that is already linked to an ACTIVE product (see readiness.ts) without
 * opening each one. Reuses `confirmItem` one item at a time, each in its own transaction — not one all-or-nothing transaction —
 * so an item that fails (e.g. someone else reopened or unlinked it in the meantime) does not block the rest. This function
 * itself never links or creates a product — that already happened earlier, by a person or, for a zero-candidate item,
 * automatically at parse/add time (see autoCreateProduct); items still unlinked (a genuinely ambiguous candidate nobody
 * resolved, or an explicit Unlink) or pointing at an archived product are left untouched for individual review.
 */
export async function confirmReadyItems(ctx: ServiceContext, broadcastId: string): Promise<ConfirmReadySummary> {
  const broadcast = await ctx.db.broadcast.findUnique({ where: { id: broadcastId }, select: { id: true } });
  if (!broadcast) throw new NotFoundError("Broadcast");

  const items = await ctx.db.broadcastItem.findMany({
    where: { broadcastId, reviewStatus: "PENDING" },
    orderBy: { position: "asc" },
    select: { id: true, description: true, productId: true, product: { select: { status: true } } },
  });
  const ready = items.filter(isItemReady);

  const failed: ConfirmReadyFailure[] = [];
  let confirmedCount = 0;
  for (const item of ready) {
    try {
      await confirmItem(ctx, item.id);
      confirmedCount++;
    } catch (error) {
      if (!(error instanceof DomainError)) throw error; // a real bug still surfaces; only expected domain failures are collected
      failed.push({ itemId: item.id, description: item.description, reason: error.message });
    }
  }

  await writeAudit(ctx, {
    action: "broadcast.bulk_confirmed",
    entityType: "Broadcast",
    entityId: broadcastId,
    details: { readyCount: ready.length, confirmed: confirmedCount, failed: failed.map((f) => ({ item: f.itemId, reason: f.reason })) },
  });
  return { readyCount: ready.length, confirmedCount, failed };
}

export async function ignoreItem(ctx: ServiceContext, input: ItemReasonInput) {
  return inTransaction(ctx, async (c) => {
    const item = await loadItem(c, input.id);
    requirePending(item);
    const updated = await c.db.broadcastItem.update({ where: { id: item.id }, data: { reviewStatus: "IGNORED", ignoredReason: input.reason } });
    await writeAudit(c, { action: "broadcast_item.ignored", entityType: "BroadcastItem", entityId: item.id, scope: broadcastScope(item.broadcastId), details: { reason: input.reason } });
    return updated;
  });
}

/** Returns a reviewed item to PENDING. If it was confirmed, its observations are RETRACTED (kept for history, excluded from "latest"). */
export async function reopenItem(ctx: ServiceContext, input: ItemReasonInput) {
  return inTransaction(ctx, async (c) => {
    const item = await loadItem(c, input.id);
    if (item.reviewStatus === "PENDING") throw new InvariantError("This item is already open for review.");
    const scope = broadcastScope(item.broadcastId);

    let retracted = 0;
    if (item.reviewStatus === "CONFIRMED") retracted = await retractObservationsForItem(c, item.id, input.reason ?? "Item reopened for correction", scope);

    const updated = await c.db.broadcastItem.update({ where: { id: item.id }, data: { reviewStatus: "PENDING", confirmedAt: null, confirmedById: null, ignoredReason: null } });
    await writeAudit(c, { action: "broadcast_item.reopened", entityType: "BroadcastItem", entityId: item.id, scope, details: { was: item.reviewStatus, retractedObservations: retracted, reason: input.reason } });
    return updated;
  });
}

// ───────────────────────────────────────── broadcast ─────────────────────────────────────────

/** Soft-archive (or restore) a broadcast. Its evidence and any observations remain; it is only hidden from the working lists. */
export async function setBroadcastArchived(ctx: ServiceContext, input: BroadcastArchiveInput) {
  return inTransaction(ctx, async (c) => {
    const broadcast = await c.db.broadcast.findUnique({ where: { id: input.id }, select: { id: true, archivedAt: true } });
    if (!broadcast) throw new NotFoundError("Broadcast");
    if (Boolean(broadcast.archivedAt) === input.archived) return broadcast;
    const updated = await c.db.broadcast.update({ where: { id: input.id }, data: { archivedAt: input.archived ? new Date() : null } });
    await writeAudit(c, { action: "broadcast.archived", entityType: "Broadcast", entityId: input.id, details: { archived: input.archived } });
    return updated;
  });
}
