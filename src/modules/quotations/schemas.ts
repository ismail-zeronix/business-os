import { z } from "zod";
import { optionalMoney, optionalText, optionalUuid, requiredText, SUPPORTED_CURRENCIES } from "../../core/validation/fields";
import { directConfirmationFields, requireProductOrName } from "../broadcasts/confirmation.schemas";

/** Zod inputs for the quotation service. Blank optional fields become null: unknown stays unknown. */

const blankToNull = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

/** A percentage such as "12", "12.5" or "-5" (a discount), at most 2 decimals. Blank => null. The service checks the range it needs. */
const optionalPercent = () =>
  z
    .preprocess((value) => {
      const cleaned = blankToNull(value);
      return typeof cleaned === "string" ? cleaned.replace(/[,%\s]/g, "") : cleaned;
    }, z.string().regex(/^-?\d{1,5}(?:\.\d{1,2})?$/, "Enter a percentage such as 12 or 12.5").nullable().optional())
    .transform((value) => value ?? null);

/** VAT is required on a quotation: 0 to 100. */
const vatPercent = () =>
  z
    .preprocess((value) => (typeof value === "string" ? value.replace(/[,%\s]/g, "") : value), z.string({ error: "Enter the VAT percentage" }).regex(/^\d{1,3}(?:\.\d{1,2})?$/, "Enter a percentage such as 5"))
    .refine((value) => Number(value) <= 100, "VAT cannot be more than 100%");

/** A calendar date "2026-10-05" from an <input type="date">. Blank => null. */
const optionalDate = () =>
  z
    .preprocess(
      blankToNull,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
        .refine((value) => {
          const date = new Date(`${value}T00:00:00Z`);
          return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
        }, "Enter a valid date")
        .nullable()
        .optional(),
    )
    .transform((value) => value ?? null);

/** A whole number of units above zero. Blank => null (not entered yet). */
const optionalPositiveQuantity = () =>
  z
    .preprocess(blankToNull, z.coerce.number({ error: "Enter a whole number" }).int("Enter a whole number").min(1, "Must be at least 1").max(1_000_000, "Too large").nullable().optional())
    .transform((value) => value ?? null);

const requiredPositiveQuantity = () => z.coerce.number({ error: "Enter the quantity" }).int("Enter a whole number").min(1, "Must be at least 1").max(1_000_000, "Too large");

export const quotationCreateSchema = z.object({ enquiryId: z.uuid() });
export const quotationIdSchema = z.object({ id: z.uuid() });

/** The header of a draft. The currency and VAT are always sent (the form pre-selects the current values). */
export const quotationDetailsSchema = z.object({
  id: z.uuid(),
  customerName: optionalText(200),
  contactName: optionalText(200),
  currencyCode: z.enum(SUPPORTED_CURRENCIES, { error: "Choose a currency" }),
  vatPercent: vatPercent(),
  validUntil: optionalDate(),
  paymentTerms: optionalText(500),
  deliveryTerms: optionalText(500),
  notes: optionalText(2000),
});

/** A line typed by hand (delivery, installation...). Lines from requirements are made by Create. */
export const lineAddSchema = z.object({
  quotationId: z.uuid(),
  description: requiredText("Description", 300),
  quantity: requiredPositiveQuantity(),
  unitPrice: optionalMoney(),
});

/**
 * Editing a line. `basis` says which of markup and price the person changed; the service works out the other one
 * (the form previews the same result, but only the service decides what is saved).
 */
export const lineUpdateSchema = z.object({
  id: z.uuid(),
  description: requiredText("Description", 300),
  partNumber: optionalText(100),
  quantity: optionalPositiveQuantity(),
  basis: z.enum(["MARKUP", "PRICE"]),
  markupPercent: optionalPercent(),
  unitPrice: optionalMoney(),
});

/**
 * A quotation made without an enquiry. The customer is a saved one or just a typed name (a name is enough to start; issuing needs one).
 */
export const manualQuotationSchema = z
  .object({
    customerId: optionalUuid("Choose a valid customer"),
    customerName: optionalText(200),
    contactName: optionalText(200),
  })
  .refine((value) => value.customerId || value.customerName, { message: "Choose a customer or type a name", path: ["customerName"] });

/**
 * A line from a supplier who has just confirmed a price (a call, a message). Everything about the confirmation is recorded as supplier
 * evidence first (see broadcasts/confirmation.service.ts); the line then costs from that price. `quantity` is what the customer wants;
 * the supplier's own stock is part of the confirmation. An optional markup prices the line at once.
 */
export const lineFromConfirmationSchema = directConfirmationFields
  .extend({
    quotationId: z.uuid(),
    quantity: requiredPositiveQuantity(),
    markupPercent: optionalPercent(),
  })
  .superRefine(requireProductOrName);

export const lineIdSchema = z.object({ id: z.uuid() });

export type QuotationCreateInput = z.output<typeof quotationCreateSchema>;
export type QuotationIdInput = z.output<typeof quotationIdSchema>;
export type QuotationDetailsInput = z.output<typeof quotationDetailsSchema>;
export type LineAddInput = z.output<typeof lineAddSchema>;
export type LineUpdateInput = z.output<typeof lineUpdateSchema>;
export type ManualQuotationInput = z.output<typeof manualQuotationSchema>;
export type LineFromConfirmationInput = z.output<typeof lineFromConfirmationSchema>;
export type LineIdInput = z.output<typeof lineIdSchema>;
