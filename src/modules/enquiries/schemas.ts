import { z } from "zod";
import { EnquiryStatus, EvidenceChannel } from "../../generated/prisma/enums";
import { checkbox, optionalEmail, optionalText, optionalUuid, requiredEnum, requiredText } from "../../core/validation/fields";
import { productProfileSchema } from "../products/schemas";

const values = <T extends string>(obj: Record<string, T>) => Object.values(obj) as [T, ...T[]];
const blankToNull = (value: unknown): unknown => (typeof value === "string" && value.trim() === "" ? null : value);

export const MAX_RAW_TEXT = 50_000;

const ENQUIRY_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

/** Optional whole number of at least 1 (an enquiry quantity of 0 makes no sense). Blank means unknown. */
const optionalPositiveQuantity = () =>
  z
    .preprocess(blankToNull, z.coerce.number({ error: "Enter a whole number" }).int("Enter a whole number").min(1, "Must be at least 1").nullable().optional())
    .transform((value) => value ?? null);

/** Optional calendar date from <input type="date"> ("2026-10-05"), stored as a UTC date. Blank means not set. */
const optionalDate = () =>
  z
    .preprocess(
      blankToNull,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
        .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().startsWith(value), "Enter a valid date")
        .nullable()
        .optional(),
    )
    .transform((value) => (value ? new Date(`${value}T00:00:00.000Z`) : null));

/** A new enquiry. The raw text is kept EXACTLY as pasted (no trimming); it only has to contain something. */
export const enquiryCreateSchema = z.object({
  customerId: optionalUuid("Choose a valid customer"),
  contactId: optionalUuid("Choose a valid contact"),
  requesterName: optionalText(200),
  requesterEmail: optionalEmail(),
  channel: z.enum(values(EvidenceChannel), { error: "Choose how it was received" }).default("MANUAL_PASTE"),
  /** datetime-local text in the business timezone; converted to a UTC instant by the action. */
  receivedAt: z.string().min(1, "Enter when the request was received"),
  subject: optionalText(300),
  notes: optionalText(2000),
  rawText: z
    .string({ error: "Paste the customer request" })
    .refine((v) => v.trim().length > 0, "Paste the customer request")
    .refine((v) => v.length <= MAX_RAW_TEXT, `The request is too long (maximum ${MAX_RAW_TEXT.toLocaleString("en-US")} characters)`),
});

export const enquiryHeaderSchema = z.object({
  id: z.uuid(),
  customerId: optionalUuid("Choose a valid customer"),
  contactId: optionalUuid("Choose a valid contact"),
  requesterName: optionalText(200),
  requesterEmail: optionalEmail(),
  subject: optionalText(300),
  priority: requiredEnum(ENQUIRY_PRIORITIES, "priority"),
  requiredBy: optionalDate(),
  deliveryLocation: optionalText(200),
  blocker: optionalText(500),
  nextAction: optionalText(500),
  assignedToId: optionalUuid("Choose a valid owner"),
  notes: optionalText(2000),
});

export const enquiryStatusSchema = z.object({ id: z.uuid(), status: z.enum(EnquiryStatus), note: optionalText(500) });
export const enquiryNoteSchema = z.object({ id: z.uuid(), note: requiredText("Note", 2000) });
export const enquiryArchiveSchema = z.object({ id: z.uuid(), archived: checkbox() });
export const enquirySuggestionSchema = z.object({ id: z.uuid(), field: z.enum(["deliveryLocation", "priority"]) });
export const customerFromRequesterSchema = z.object({
  enquiryId: z.uuid(),
  name: requiredText("Customer name", 200),
  contactName: optionalText(200),
  contactEmail: optionalEmail(),
});

/** The reviewable fields of an enquiry item. Every one may be unknown. */
export const enquiryItemFieldsSchema = z.object({
  description: optionalText(300),
  brandText: optionalText(100),
  familyText: optionalText(100),
  modelText: optionalText(100),
  partNumber: optionalText(100),
  specText: optionalText(500),
  quantity: optionalPositiveQuantity(),
  notes: optionalText(1000),
});

export const enquiryItemUpdateSchema = enquiryItemFieldsSchema.extend({ id: z.uuid() });
export const enquiryItemManualCreateSchema = enquiryItemFieldsSchema.extend({ enquiryId: z.uuid(), sourceText: optionalText(2000) });
export const enquiryItemLinkSchema = z.object({ itemId: z.uuid(), productId: optionalUuid(), rememberAlias: checkbox() });
export const enquiryItemCreateProductSchema = productProfileSchema.extend({ itemId: z.uuid(), rememberAlias: checkbox() });
export const enquiryItemReasonSchema = z.object({ id: z.uuid(), reason: optionalText(300) });

export type EnquiryCreateInput = z.output<typeof enquiryCreateSchema>;
export type EnquiryHeaderInput = z.output<typeof enquiryHeaderSchema>;
export type EnquiryStatusInput = z.output<typeof enquiryStatusSchema>;
export type EnquiryNoteInput = z.output<typeof enquiryNoteSchema>;
export type EnquiryArchiveInput = z.output<typeof enquiryArchiveSchema>;
export type EnquirySuggestionInput = z.output<typeof enquirySuggestionSchema>;
export type CustomerFromRequesterInput = z.output<typeof customerFromRequesterSchema>;
export type EnquiryItemFields = z.output<typeof enquiryItemFieldsSchema>;
export type EnquiryItemUpdateInput = z.output<typeof enquiryItemUpdateSchema>;
export type EnquiryItemManualCreateInput = z.output<typeof enquiryItemManualCreateSchema>;
export type EnquiryItemLinkInput = z.output<typeof enquiryItemLinkSchema>;
export type EnquiryItemCreateProductInput = z.output<typeof enquiryItemCreateProductSchema>;
export type EnquiryItemReasonInput = z.output<typeof enquiryItemReasonSchema>;
