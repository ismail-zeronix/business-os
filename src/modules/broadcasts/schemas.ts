import { z } from "zod";
import { StockStatus, VatState, WarrantyType } from "../../generated/prisma/enums";
import {
  SUPPORTED_CURRENCIES,
  checkbox,
  enumOrUnknown,
  optionalEnum,
  optionalMoney,
  optionalPositiveInt,
  optionalQuantity,
  optionalText,
  optionalUuid,
  stringArray,
} from "../../core/validation/fields";
import { productProfileSchema } from "../products/schemas";

const values = <T extends string>(obj: Record<string, T>) => Object.values(obj) as [T, ...T[]];

export const MAX_RAW_TEXT = 50_000;

/** Channels a person can pick when entering a broadcast by hand. ASSISTANT does not apply here: the AI chat only drafts enquiries. */
export const BROADCAST_ENTRY_CHANNELS = ["MANUAL_PASTE", "WHATSAPP", "EMAIL", "PHONE", "OTHER"] as const;

/** A new broadcast. The raw text is kept EXACTLY as pasted (no trimming); it only has to contain something. */
export const broadcastCreateSchema = z.object({
  supplierId: z.uuid("Choose a supplier"),
  contactId: optionalUuid("Choose a valid contact"),
  channel: z.enum(BROADCAST_ENTRY_CHANNELS, { error: "Choose how it was received" }).default("MANUAL_PASTE"),
  /** datetime-local text in the business timezone; converted to a UTC instant by the action. */
  receivedAt: z.string().min(1, "Enter when the message was received"),
  rawText: z
    .string({ error: "Paste the supplier message" })
    .refine((v) => v.trim().length > 0, "Paste the supplier message")
    .refine((v) => v.length <= MAX_RAW_TEXT, `The message is too long (maximum ${MAX_RAW_TEXT.toLocaleString("en-US")} characters)`),
  notes: optionalText(1000),
  allowDuplicate: checkbox(),
  /** Set when this message is a supplier's reply to a sourcing request. */
  supplierRequestId: optionalUuid("Invalid request"),
  /** Optional fallback: applied only to items the parser could not classify from the text itself. */
  categoryId: optionalUuid("Choose a valid category"),
});

/** The reviewable fields of a broadcast item. Every one may be unknown; currency is required only when a price is confirmed. */
export const itemFieldsSchema = z.object({
  description: optionalText(300),
  brandText: optionalText(100),
  modelText: optionalText(100),
  partNumber: optionalText(100),
  categoryText: optionalText(100),
  specText: optionalText(500),
  quantity: optionalQuantity(),
  priceAmount: optionalMoney(),
  currencyCode: optionalEnum(SUPPORTED_CURRENCIES, "currency"),
  vatState: enumOrUnknown(values(VatState), "UNKNOWN", "VAT state"),
  stockStatus: enumOrUnknown(values(StockStatus), "UNKNOWN", "stock status"),
  warrantyMonths: optionalPositiveInt("Warranty duration"),
  warrantyType: optionalEnum(values(WarrantyType), "warranty type"),
  notes: optionalText(1000),
});

export const itemUpdateSchema = itemFieldsSchema.extend({ id: z.uuid() });

/**
 * The bulk review table: one repeated form field per column, one entry per row, all arrays the same length as `id`. The
 * action zips them back into one `ItemUpdateInput` per row and validates each with `itemUpdateSchema`, so a row-level error
 * behaves exactly like a single-item save's validation error.
 */
export const bulkApplyItemsSchema = z.object({
  broadcastId: z.uuid(),
  id: stringArray(),
  description: stringArray(),
  brandText: stringArray(),
  modelText: stringArray(),
  categoryText: stringArray(),
  partNumber: stringArray(),
  specText: stringArray(),
  quantity: stringArray(),
  priceAmount: stringArray(),
  currencyCode: stringArray(),
  vatState: stringArray(),
  stockStatus: stringArray(),
  warrantyMonths: stringArray(),
  warrantyType: stringArray(),
  notes: stringArray(),
});
export type BulkApplyItemsInput = z.output<typeof bulkApplyItemsSchema>;

export const itemManualCreateSchema = itemFieldsSchema.extend({ broadcastId: z.uuid(), sourceText: optionalText(2000) });
export const itemLinkSchema = z.object({ itemId: z.uuid(), productId: optionalUuid(), rememberAlias: checkbox() });
export const itemCreateProductSchema = productProfileSchema.extend({ itemId: z.uuid(), rememberAlias: checkbox() });
export const itemIdSchema = z.object({ id: z.uuid() });
export const itemReasonSchema = z.object({ id: z.uuid(), reason: optionalText(300) });
export const broadcastArchiveSchema = z.object({ id: z.uuid(), archived: checkbox() });
export const broadcastIdSchema = z.object({ id: z.uuid() });

export type BroadcastCreateInput = z.output<typeof broadcastCreateSchema>;
export type ItemFields = z.output<typeof itemFieldsSchema>;
export type ItemUpdateInput = z.output<typeof itemUpdateSchema>;
export type ItemManualCreateInput = z.output<typeof itemManualCreateSchema>;
export type ItemLinkInput = z.output<typeof itemLinkSchema>;
export type ItemCreateProductInput = z.output<typeof itemCreateProductSchema>;
export type ItemReasonInput = z.output<typeof itemReasonSchema>;
export type BroadcastArchiveInput = z.output<typeof broadcastArchiveSchema>;
export type BroadcastIdInput = z.output<typeof broadcastIdSchema>;
