import { z } from "zod";
import { PreferredChannel, RecordStatus, SupplierType } from "../../generated/prisma/enums";
import { idList, optionalEmail, optionalEnum, optionalText, optionalUrl, requiredText } from "../../core/validation/fields";

const values = <T extends string>(obj: Record<string, T>) => Object.values(obj) as [T, ...T[]];

/** Supplier profile. Only the name is required; everything else may stay unknown. */
export const supplierProfileSchema = z.object({
  name: requiredText("Supplier name", 200),
  legalName: optionalText(200),
  code: optionalText(50),
  type: optionalEnum(values(SupplierType), "type"),
  country: optionalText(100),
  emirate: optionalText(100),
  area: optionalText(100),
  address: optionalText(300),
  website: optionalUrl(),
  phone: optionalText(50),
  whatsapp: optionalText(50),
  email: optionalEmail(),
  trn: optionalText(30),
  paymentTerms: optionalText(300),
  creditTerms: optionalText(300),
  warrantyNotes: optionalText(1000),
  deliveryNotes: optionalText(1000),
  notes: optionalText(4000),
});

export const supplierCreateSchema = supplierProfileSchema.extend({ brandIds: idList(), categoryIds: idList() });
export const supplierUpdateSchema = supplierProfileSchema.extend({ id: z.uuid() });
export const supplierStatusSchema = z.object({ id: z.uuid(), status: z.enum(RecordStatus) });
/** Brands and categories are replaced as a whole; an absent list means "none selected". */
export const supplierAssociationsSchema = z.object({ id: z.uuid(), brandIds: idList(), categoryIds: idList() });

export const contactBaseSchema = z.object({
  name: requiredText("Contact name", 200),
  jobTitle: optionalText(120),
  department: optionalText(120),
  phone: optionalText(50),
  whatsapp: optionalText(50),
  email: optionalEmail(),
  preferredChannel: optionalEnum(values(PreferredChannel), "channel"),
  notes: optionalText(2000),
  brandIds: idList(),
  categoryIds: idList(),
});
export const contactCreateSchema = contactBaseSchema.extend({ supplierId: z.uuid() });
export const contactUpdateSchema = contactBaseSchema.extend({ id: z.uuid() });
export const contactStatusSchema = z.object({ id: z.uuid(), status: z.enum(RecordStatus) });

export type SupplierProfileInput = z.output<typeof supplierProfileSchema>;
export type SupplierCreateInput = z.output<typeof supplierCreateSchema>;
export type SupplierUpdateInput = z.output<typeof supplierUpdateSchema>;
export type SupplierStatusInput = z.output<typeof supplierStatusSchema>;
export type SupplierAssociationsInput = z.output<typeof supplierAssociationsSchema>;
export type ContactCreateInput = z.output<typeof contactCreateSchema>;
export type ContactUpdateInput = z.output<typeof contactUpdateSchema>;
export type ContactStatusInput = z.output<typeof contactStatusSchema>;
