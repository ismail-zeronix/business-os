import { InvariantError, NotFoundError, ValidationError } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { formatDateTime, formatMoney } from "../../lib/format";
import { EVIDENCE_CHANNEL_LABEL, STOCK_STATUS_LABEL, VAT_STATE_LABEL } from "../../lib/labels";
import { writeAudit } from "../audit/service";
import { createEvidence } from "../evidence/service";
import { createProduct } from "../products/service";
import { confirmItem } from "./service";
import { newProductProfile, type DirectConfirmationInput } from "./confirmation.schemas";

/**
 * "The supplier just confirmed this by phone." Records it as ordinary supplier evidence in one transaction, so the price and stock show up
 * everywhere (product page, Search, supplier intelligence, evidence drawer) and a mistake is retracted, never edited:
 *   immutable evidence (a written record of what was typed, of kind SUPPLIER_CONFIRMATION) -> a broadcast for the supplier -> one item
 *   linked to the product (an existing one, or a new TEMPORARY one) -> confirmed by the person, which creates the observations.
 * Nothing is parsed or guessed: every value was typed by the person, who is the one confirming it.
 */

/** The written record kept as the evidence text. Built from what the person entered, so the proof reads on its own. */
function composeRecord(input: {
  channel: DirectConfirmationInput["channel"];
  supplierName: string;
  contactName: string | null;
  confirmedAt: Date;
  productName: string;
  partNumber: string | null;
  priceAmount: string;
  currencyCode: string;
  vatLabel: string;
  stockLine: string | null;
  note: string;
}): string {
  return [
    `Direct confirmation (${EVIDENCE_CHANNEL_LABEL[input.channel].toLowerCase()}) from ${input.supplierName}${input.contactName ? `, ${input.contactName}` : ""}`,
    `Confirmed: ${formatDateTime(input.confirmedAt)}`,
    `Product: ${input.productName}${input.partNumber ? ` (P/N ${input.partNumber})` : ""}`,
    `Price: ${formatMoney(input.priceAmount, input.currencyCode)} (${input.vatLabel})`,
    ...(input.stockLine ? [`Stock: ${input.stockLine}`] : []),
    `Note: ${input.note}`,
  ].join("\n");
}

export async function recordDirectConfirmation(ctx: ServiceContext, input: DirectConfirmationInput & { confirmedAtDate: Date }) {
  return inTransaction(ctx, async (c) => {
    const supplier = await c.db.supplier.findUnique({ where: { id: input.supplierId }, select: { id: true, name: true, status: true } });
    if (!supplier) throw new NotFoundError("Supplier");
    if (supplier.status === "ARCHIVED") throw new InvariantError("This supplier is archived. Restore it before recording a confirmation.");

    let contactName: string | null = null;
    if (input.contactId) {
      const contact = await c.db.supplierContact.findUnique({ where: { id: input.contactId }, select: { supplierId: true, status: true, name: true } });
      if (!contact || contact.supplierId !== supplier.id) throw new ValidationError("That contact does not belong to this supplier.", { contactId: "Choose a contact of this supplier" });
      if (contact.status === "ARCHIVED") throw new ValidationError("That contact is archived.", { contactId: "Archived" });
      contactName = contact.name;
    }
    if (input.confirmedAtDate.getTime() > Date.now() + 5 * 60_000) throw new ValidationError("The confirmation time is in the future.", { confirmedAt: "Cannot be in the future" });

    // The product: an existing active one, or a new TEMPORARY one (a person can curate it later; incomplete master data must not block a quote).
    let product: { id: string; name: string; partNumber: string | null };
    let matchBasis: "MANUAL" | "NEW_PRODUCT";
    if (input.productId) {
      const found = await c.db.product.findUnique({ where: { id: input.productId }, select: { id: true, name: true, partNumber: true, status: true } });
      if (!found) throw new NotFoundError("Product");
      if (found.status === "ARCHIVED") throw new InvariantError("That product is archived and cannot be used.");
      product = found;
      matchBasis = "MANUAL";
    } else {
      const created = await createProduct(c, newProductProfile(input), { isTemporary: true });
      product = { id: created.id, name: created.name, partNumber: created.partNumber };
      matchBasis = "NEW_PRODUCT";
    }
    const priceAmount = input.priceAmount as string; // required by the schema

    const stockLine =
      input.stockQuantity !== null || input.stockStatus !== "UNKNOWN"
        ? [input.stockQuantity !== null ? `${input.stockQuantity} pcs` : null, input.stockStatus !== "UNKNOWN" ? STOCK_STATUS_LABEL[input.stockStatus] : null].filter(Boolean).join(", ")
        : null;
    const record = composeRecord({
      channel: input.channel,
      supplierName: supplier.name,
      contactName,
      confirmedAt: input.confirmedAtDate,
      productName: product.name,
      partNumber: product.partNumber,
      priceAmount,
      currencyCode: input.currencyCode,
      vatLabel: VAT_STATE_LABEL[input.vatState],
      stockLine,
      note: input.note,
    });

    const evidence = await createEvidence(c, { kind: "SUPPLIER_CONFIRMATION", channel: input.channel, rawText: record, observedAt: input.confirmedAtDate });
    const broadcast = await c.db.broadcast.create({
      data: { evidenceSourceId: evidence.id, supplierId: supplier.id, contactId: input.contactId, notes: null, createdById: ctx.actor.id },
    });
    await writeAudit(c, {
      action: "broadcast.created",
      entityType: "Broadcast",
      entityId: broadcast.id,
      details: { supplier: supplier.name, channel: input.channel, kind: "direct confirmation", product: product.name },
    });

    const item = await c.db.broadcastItem.create({
      data: {
        broadcastId: broadcast.id,
        position: 1,
        sourceText: record,
        origin: "MANUAL",
        description: product.name,
        partNumber: product.partNumber,
        quantity: input.stockQuantity,
        priceAmount,
        currencyCode: input.currencyCode,
        vatState: input.vatState,
        stockStatus: input.stockStatus,
        notes: input.note,
        productId: product.id,
        matchBasis,
      },
      select: { id: true },
    });
    await confirmItem(c, item.id);

    const price = await c.db.priceObservation.findFirstOrThrow({ where: { broadcastItemId: item.id }, select: { id: true } });
    return { broadcastId: broadcast.id, productId: product.id, productName: product.name, partNumber: product.partNumber, supplierName: supplier.name, priceObservationId: price.id, currencyCode: input.currencyCode, priceAmount };
  });
}
