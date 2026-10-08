import { z } from "zod";
import { TaskPriority } from "../../generated/prisma/enums";
import { optionalText, optionalUuid, requiredEnum, requiredText } from "../../core/validation/fields";

const values = <T extends string>(obj: Record<string, T>) => Object.values(obj) as [T, ...T[]];
const priorityValues = values(TaskPriority);
export const TASK_LINK_TYPES = ["ENQUIRY", "CUSTOMER", "EMAIL"] as const;

const blankToNull = (value: unknown): unknown => (typeof value === "string" && value.trim() === "" ? null : value);

/** Blank or missing means "not linked". Both linkedType and linkedId are required together (checked below). */
const optionalLinkType = () => z.preprocess(blankToNull, z.enum(TASK_LINK_TYPES).nullable().optional()).transform((value) => value ?? null);

const taskFieldsSchema = z.object({
  title: requiredText("Title", 200),
  description: optionalText(4000),
  priority: requiredEnum(priorityValues, "priority"),
  /** datetime-local text in the business timezone, or null for no due date; converted to a UTC instant by the action. */
  dueAt: z.preprocess(blankToNull, z.string().nullable().optional()).transform((value) => value ?? null),
});

export const taskCreateSchema = taskFieldsSchema
  .extend({ assignedToId: optionalUuid(), linkedType: optionalLinkType(), linkedId: optionalUuid() })
  .refine((v) => (v.linkedType === null) === (v.linkedId === null), { message: "Choose what to link this task to", path: ["linkedId"] });

export const taskUpdateSchema = taskFieldsSchema.extend({ id: z.uuid() });
export const taskIdSchema = z.object({ id: z.uuid() });
export const taskAssignSchema = z.object({ id: z.uuid(), assignedToId: optionalUuid() });
export const taskCancelSchema = z.object({ id: z.uuid(), reason: requiredText("Reason", 500) });

export type TaskCreateFields = z.output<typeof taskCreateSchema>;
export type TaskUpdateFields = z.output<typeof taskUpdateSchema>;
export type TaskIdInput = z.output<typeof taskIdSchema>;
export type TaskAssignInput = z.output<typeof taskAssignSchema>;
export type TaskCancelInput = z.output<typeof taskCancelSchema>;
