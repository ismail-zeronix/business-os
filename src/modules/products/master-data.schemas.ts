import { z } from "zod";
import { RecordStatus } from "../../generated/prisma/enums";
import { requiredText } from "../../core/validation/fields";

export const masterDataCreateSchema = z.object({
  name: requiredText("Name", 100),
});

export const masterDataRenameSchema = z.object({
  id: z.uuid(),
  name: requiredText("Name", 100),
});

export const masterDataStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(RecordStatus),
});

export type MasterDataCreateInput = z.output<typeof masterDataCreateSchema>;
export type MasterDataRenameInput = z.output<typeof masterDataRenameSchema>;
export type MasterDataStatusInput = z.output<typeof masterDataStatusSchema>;
