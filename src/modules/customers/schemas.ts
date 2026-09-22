import { z } from "zod";
import { PreferredChannel, RecordStatus } from "../../generated/prisma/enums";
import { optionalEmail, optionalEnum, optionalText, optionalUrl, requiredText } from "../../core/validation/fields";

const values = <T extends string>(obj: Record<string, T>) => Object.values(obj) as [T, ...T[]];

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

export type CustomerCreateInput = z.output<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.output<typeof customerUpdateSchema>;
export type CustomerStatusInput = z.output<typeof customerStatusSchema>;
export type CustomerContactCreateInput = z.output<typeof customerContactCreateSchema>;
export type CustomerContactUpdateInput = z.output<typeof customerContactUpdateSchema>;
export type CustomerContactStatusInput = z.output<typeof customerContactStatusSchema>;
