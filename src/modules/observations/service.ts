import { ValidationError } from "../../core/errors";
import type { ServiceContext } from "../../core/database/tx";
import type { StockStatus, VatState, WarrantyType } from "../../generated/prisma/enums";
import { writeAudit } from "../audit/service";
import type { AuditScope } from "../audit/types";

/**
 * Price and stock are OBSERVATIONS: product + supplier + value + observed time + evidence. They are only ever appended.
 * A database trigger makes them immutable except for one-way retraction, which is how a wrong confirmation is corrected.
 */
type Provenance = {
  productId: string;
  supplierId: string;
  contactId: string | null;
  /** When the supplier stated it (from the evidence), not when it was entered. */
  observedAt: Date;
  evidenceSourceId: string;
  broadcastItemId: string | null;
  scope?: AuditScope;
};

export async function createPriceObservation(ctx: ServiceContext, input: Provenance & { amount: string; currencyCode: string; vatState: VatState; warrantyMonths?: number | null; warrantyType?: WarrantyType | null }) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(input.amount)) throw new ValidationError("The price must be a non-negative amount.");
  if (!/^[A-Z]{3}$/.test(input.currencyCode)) throw new ValidationError("A price needs a currency (for example AED).");

  const observation = await ctx.db.priceObservation.create({
    data: {
      productId: input.productId,
      supplierId: input.supplierId,
      contactId: input.contactId,
      amount: input.amount,
      currencyCode: input.currencyCode,
      vatState: input.vatState,
      warrantyMonths: input.warrantyMonths ?? null,
      warrantyType: input.warrantyType ?? null,
      observedAt: input.observedAt,
      evidenceSourceId: input.evidenceSourceId,
      broadcastItemId: input.broadcastItemId,
      createdById: ctx.actor.id,
    },
  });
  await writeAudit(ctx, {
    action: "observation.created",
    entityType: "PriceObservation",
    entityId: observation.id,
    scope: input.scope,
    details: { price: `${input.currencyCode} ${input.amount}`, vat: input.vatState },
  });
  return observation;
}

export async function createStockObservation(ctx: ServiceContext, input: Provenance & { quantity: number | null; status: StockStatus }) {
  if (input.quantity !== null && (!Number.isInteger(input.quantity) || input.quantity < 0)) throw new ValidationError("The quantity must be a non-negative whole number.");
  if (input.quantity === null && input.status === "UNKNOWN") throw new ValidationError("A stock observation needs a quantity or a stock status.");

  const observation = await ctx.db.stockObservation.create({
    data: {
      productId: input.productId,
      supplierId: input.supplierId,
      contactId: input.contactId,
      quantity: input.quantity,
      status: input.status,
      observedAt: input.observedAt,
      evidenceSourceId: input.evidenceSourceId,
      broadcastItemId: input.broadcastItemId,
      createdById: ctx.actor.id,
    },
  });
  await writeAudit(ctx, {
    action: "observation.created",
    entityType: "StockObservation",
    entityId: observation.id,
    scope: input.scope,
    details: { quantity: input.quantity, status: input.status },
  });
  return observation;
}

/**
 * Retracts every active observation created from a broadcast item. They are KEPT (visible, struck-through in history, excluded from
 * "latest"); nothing is deleted or edited. Returns how many were retracted.
 */
export async function retractObservationsForItem(ctx: ServiceContext, broadcastItemId: string, reason: string, scope?: AuditScope): Promise<number> {
  const retraction = { retractedAt: new Date(), retractedById: ctx.actor.id, retractionReason: reason };
  const [prices, stocks] = await Promise.all([
    ctx.db.priceObservation.findMany({ where: { broadcastItemId, retractedAt: null }, select: { id: true } }),
    ctx.db.stockObservation.findMany({ where: { broadcastItemId, retractedAt: null }, select: { id: true } }),
  ]);

  for (const { id } of prices) {
    await ctx.db.priceObservation.update({ where: { id }, data: retraction });
    await writeAudit(ctx, { action: "observation.retracted", entityType: "PriceObservation", entityId: id, scope, details: { reason } });
  }
  for (const { id } of stocks) {
    await ctx.db.stockObservation.update({ where: { id }, data: retraction });
    await writeAudit(ctx, { action: "observation.retracted", entityType: "StockObservation", entityId: id, scope, details: { reason } });
  }
  return prices.length + stocks.length;
}
