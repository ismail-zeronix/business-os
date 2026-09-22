import { z } from "zod";
import { StockStatus, VatState } from "../../generated/prisma/enums";
import { SUPPORTED_CURRENCIES, enumOrUnknown, optionalMoney, optionalQuantity, optionalText, optionalUuid, requiredText } from "../../core/validation/fields";
import { productProfileSchema } from "../products/schemas";

const values = <T extends string>(obj: Record<string, T>) => Object.values(obj) as [T, ...T[]];

/** How the supplier confirmed. These are all values of the evidence channel. */
export const CONFIRMATION_CHANNELS = ["PHONE", "WHATSAPP", "EMAIL", "MANUAL_PASTE", "OTHER"] as const;

/**
 * A supplier's price (and maybe stock) confirmed directly and typed in by a person: a call, a message, a visit. The note is required because it
 * is the record of how it was confirmed. The product is either an existing one (`productId`) or a new one described by the profile fields.
 * A price is required: this is for when a price is needed now.
 */
export const directConfirmationFields = z.object({
  supplierId: z.uuid("Choose a supplier"),
  contactId: optionalUuid("Choose a valid contact"),
  channel: z.enum(CONFIRMATION_CHANNELS, { error: "Choose how it was confirmed" }),
  /** datetime-local text in the business timezone; converted to a UTC instant by the action. */
  confirmedAt: z.string().min(1, "Enter when it was confirmed"),
  note: requiredText("Note", 2000),

  productId: optionalUuid("Choose a valid product"),
  // New product profile, used only when no productId is given.
  name: optionalText(250),
  brandId: optionalUuid("Choose a valid brand"),
  categoryId: optionalUuid("Choose a valid category"),
  model: optionalText(100),
  partNumber: optionalText(100),

  priceAmount: optionalMoney().refine((v) => v !== null, "Enter the price"),
  currencyCode: z.enum(SUPPORTED_CURRENCIES, { error: "Choose a currency" }),
  vatState: enumOrUnknown(values(VatState), "UNKNOWN", "VAT state"),
  stockQuantity: optionalQuantity(),
  stockStatus: enumOrUnknown(values(StockStatus), "UNKNOWN", "stock status"),
});

/** A product is needed: an existing one, or the name of a new one. Shared so other schemas that extend the fields above apply the same rule. */
export function requireProductOrName(value: { productId: string | null; name: string | null }, ctx: z.RefinementCtx): void {
  if (!value.productId && !value.name) ctx.addIssue({ code: "custom", path: ["name"], message: "Choose a product, or enter the name of a new one" });
}

export const directConfirmationSchema = directConfirmationFields.superRefine(requireProductOrName);

export type DirectConfirmationInput = z.output<typeof directConfirmationSchema>;

/** The profile part, checked with the same rules as any new product. */
export const newProductProfile = (input: Pick<DirectConfirmationInput, "name" | "brandId" | "categoryId" | "model" | "partNumber">) =>
  productProfileSchema.parse({ name: input.name, brandId: input.brandId, categoryId: input.categoryId, model: input.model, partNumber: input.partNumber });
