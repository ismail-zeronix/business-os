import { z } from "zod";
import { RecordStatus } from "../../generated/prisma/enums";
import { checkbox, optionalText, optionalUuid, requiredText } from "../../core/validation/fields";

/** Product identity. Only the display name is required; brand, category, model, part number and so on may stay unknown. */
export const productProfileSchema = z.object({
  name: requiredText("Product name", 250),
  brandId: optionalUuid("Choose a valid brand"),
  categoryId: optionalUuid("Choose a valid category"),
  family: optionalText(100),
  model: optionalText(100),
  partNumber: optionalText(100),
  manufacturerSku: optionalText(100),
  description: optionalText(2000),
});

export const productCreateSchema = productProfileSchema;
/** `needsCuration` = the "temporary product" flag. Editing a temporary product lets a person clear it once they have checked the details. */
export const productUpdateSchema = productProfileSchema.extend({ id: z.uuid(), needsCuration: checkbox() });
export const productStatusSchema = z.object({ id: z.uuid(), status: z.enum(RecordStatus) });

export const aliasAddSchema = z.object({
  productId: z.uuid(),
  alias: requiredText("Alias", 200),
});
export const aliasRemoveSchema = z.object({ id: z.uuid() });

export type ProductProfileInput = z.output<typeof productProfileSchema>;
export type ProductCreateInput = z.output<typeof productCreateSchema>;
export type ProductUpdateInput = z.output<typeof productUpdateSchema>;
export type ProductStatusInput = z.output<typeof productStatusSchema>;
export type AliasAddInput = z.output<typeof aliasAddSchema>;
export type AliasRemoveInput = z.output<typeof aliasRemoveSchema>;
