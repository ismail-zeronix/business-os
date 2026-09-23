import { z } from "zod";
import { PreferredChannel, RecordStatus } from "../../generated/prisma/enums";
import { optionalEmail, optionalEnum, optionalText, optionalUrl, requiredEnum, requiredText } from "../../core/validation/fields";

const values = <T extends string>(obj: Record<string, T>) => Object.values(obj) as [T, ...T[]];

/** A call is logged, not typed by hand into a note-only field: same idea as a broadcast confirmation channel, kept local to this module (no DB column). */
export const CALL_DIRECTIONS = ["OUTBOUND", "INBOUND"] as const;
export type CallDirection = (typeof CALL_DIRECTIONS)[number];

export const CALL_OUTCOMES = ["REACHED", "NO_ANSWER", "LEFT_VOICEMAIL", "CALLBACK_REQUESTED"] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

/** Customer profile. Only the name is required; everything else may stay unknown. */
export const customerProfileSchema = z.object({
  name: requiredText("Customer name", 200),
  legalName: optionalText(200),
  trn: optionalText(30),
  country: optionalText(100),
  emirate: optionalText(100),
  website: optionalUrl(),
  phone: optionalText(50),
  email: optionalEmail(),
  notes: optionalText(4000),
});

export const customerCreateSchema = customerProfileSchema;
export const customerUpdateSchema = customerProfileSchema.extend({ id: z.uuid() });
export const customerStatusSchema = z.object({ id: z.uuid(), status: z.enum(RecordStatus) });

export const customerContactBaseSchema = z.object({
  name: requiredText("Contact name", 200),
  jobTitle: optionalText(120),
  department: optionalText(120),
  phone: optionalText(50),
  whatsapp: optionalText(50),
  email: optionalEmail(),
  preferredChannel: optionalEnum(values(PreferredChannel), "channel"),
  notes: optionalText(2000),
});
export const customerContactCreateSchema = customerContactBaseSchema.extend({ customerId: z.uuid() });
export const customerContactUpdateSchema = customerContactBaseSchema.extend({ id: z.uuid() });
export const customerContactStatusSchema = z.object({ id: z.uuid(), status: z.enum(RecordStatus) });

export const customerNoteSchema = z.object({ id: z.uuid(), note: requiredText("Note", 2000) });
export const customerCallSchema = z.object({
  id: z.uuid(),
  direction: requiredEnum(CALL_DIRECTIONS, "direction"),
  outcome: requiredEnum(CALL_OUTCOMES, "outcome"),
  note: optionalText(2000),
});

export type CustomerCreateInput = z.output<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.output<typeof customerUpdateSchema>;
export type CustomerStatusInput = z.output<typeof customerStatusSchema>;
export type CustomerContactCreateInput = z.output<typeof customerContactCreateSchema>;
export type CustomerContactUpdateInput = z.output<typeof customerContactUpdateSchema>;
export type CustomerContactStatusInput = z.output<typeof customerContactStatusSchema>;
export type CustomerNoteInput = z.output<typeof customerNoteSchema>;
export type CustomerCallInput = z.output<typeof customerCallSchema>;
