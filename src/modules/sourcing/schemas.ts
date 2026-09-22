import { z } from "zod";
import { optionalText, optionalUuid } from "../../core/validation/fields";
import { PreferredChannel } from "../../generated/prisma/enums";

const values = <T extends string>(obj: Record<string, T>) => Object.values(obj) as [T, ...T[]];

export const MAX_REQUEST_TEXT = 10_000;

export const requestAddSchema = z.object({
  enquiryId: z.uuid(),
  supplierId: z.uuid("Choose a supplier"),
  contactId: optionalUuid("Choose a valid contact"),
});

export const requestIdSchema = z.object({ id: z.uuid() });

/** The subject and body are kept separate in the form and stored together (see `composeSentText`). */
export const requestSentSchema = z.object({
  id: z.uuid(),
  subject: optionalText(300),
  body: z
    .string({ error: "Enter the message" })
    .refine((v) => v.trim().length > 0, "Enter the message")
    .refine((v) => v.length <= MAX_REQUEST_TEXT, `The message is too long (maximum ${MAX_REQUEST_TEXT.toLocaleString("en-US")} characters)`),
  channel: z.enum(values(PreferredChannel), { error: "Choose how it was sent" }),
  /** datetime-local text in the business timezone; converted to a UTC instant by the action. */
  sentAt: z.string().min(1, "Enter when it was sent"),
});

export const requestOutcomeSchema = z.object({
  id: z.uuid(),
  status: z.enum(["NO_STOCK", "DECLINED"], { error: "Choose No stock or Declined" }),
  note: optionalText(500),
});

/** Choosing a supplier for a requirement. The observation ids are what the buyer saw in the comparison cell (either may be absent). */
export const decisionChooseSchema = z.object({
  enquiryItemId: z.uuid(),
  supplierId: z.uuid("Choose a supplier"),
  priceObservationId: optionalUuid("Invalid price"),
  stockObservationId: optionalUuid("Invalid stock"),
  note: optionalText(500),
});

export const decisionClearSchema = z.object({ id: z.uuid(), reason: optionalText(300) });

export type DecisionChooseInput = z.output<typeof decisionChooseSchema>;
export type DecisionClearInput = z.output<typeof decisionClearSchema>;
export type RequestAddInput = z.output<typeof requestAddSchema>;
export type RequestIdInput = z.output<typeof requestIdSchema>;
export type RequestSentInput = z.output<typeof requestSentSchema>;
export type RequestOutcomeInput = z.output<typeof requestOutcomeSchema>;
