"use server";

import { revalidatePath } from "next/cache";
import { getServiceContext } from "@/core/permissions/actor";
import { ValidationError } from "@/core/errors";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { formDataToObject } from "@/core/validation/form-data";
import { zonedInputToUtc } from "@/lib/format";
import type { TaskLinkType } from "@/generated/prisma/enums";
import { assignTask, cancelTask, completeTask, createTask, reopenTask, updateTask } from "./service";
import { taskAssignSchema, taskCancelSchema, taskCreateSchema, taskIdSchema, taskUpdateSchema } from "./schemas";

/** Thin server actions: FormData -> zod -> service -> revalidate -> ActionResult. All business rules live in service.ts. */
type IdResult = ActionResult<{ id: string }>;

/** The sidebar/topbar badge (per-actor) lives in the layout, so every mutation revalidates it alongside /tasks. */
function revalidateTasks(linkedType?: TaskLinkType | null, linkedId?: string | null) {
  revalidatePath("/tasks");
  revalidatePath("/", "layout");
  if (linkedType === "ENQUIRY" && linkedId) revalidatePath(`/enquiries/${linkedId}`);
  if (linkedType === "EMAIL" && linkedId) revalidatePath("/enquiries");
  if (linkedType === "CUSTOMER" && linkedId) revalidatePath(`/customers/${linkedId}`);
}

/** Blank => no due date; a non-blank value must be a real date and time, read in the business timezone. */
function parseDueAt(value: string | null): Date | null {
  if (!value) return null;
  const parsed = zonedInputToUtc(value);
  if (!parsed) throw new ValidationError("Enter a valid date and time.", { dueAt: "Not a valid date and time" });
  return parsed;
}

export async function createTaskAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = taskCreateSchema.parse(formDataToObject(formData));
      const task = await createTask(await getServiceContext(), { ...input, dueAt: parseDueAt(input.dueAt) });
      revalidateTasks(task.linkedType, task.linkedId);
      return { id: task.id };
    },
    { successMessage: "Task created", formData },
  );
}

export async function updateTaskAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = taskUpdateSchema.parse(formDataToObject(formData));
      const task = await updateTask(await getServiceContext(), { ...input, dueAt: parseDueAt(input.dueAt) });
      revalidateTasks(task.linkedType, task.linkedId);
      return { id: task.id };
    },
    { successMessage: "Task saved", formData },
  );
}

/** Admin can assign anyone; a non-admin can only claim it for themselves or release it (enforced again in the service). */
export async function assignTaskAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = taskAssignSchema.parse(formDataToObject(formData));
      const task = await assignTask(await getServiceContext(), input);
      revalidateTasks(task.linkedType, task.linkedId);
      return { id: task.id };
    },
    { successMessage: "Assignment updated", formData },
  );
}

export async function completeTaskAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = taskIdSchema.parse(formDataToObject(formData));
      const task = await completeTask(await getServiceContext(), input);
      revalidateTasks(task.linkedType, task.linkedId);
      return { id: task.id };
    },
    { successMessage: "Task completed", formData },
  );
}

export async function reopenTaskAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = taskIdSchema.parse(formDataToObject(formData));
      const task = await reopenTask(await getServiceContext(), input);
      revalidateTasks(task.linkedType, task.linkedId);
      return { id: task.id };
    },
    { successMessage: "Task reopened", formData },
  );
}

export async function cancelTaskAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = taskCancelSchema.parse(formDataToObject(formData));
      const task = await cancelTask(await getServiceContext(), input);
      revalidateTasks(task.linkedType, task.linkedId);
      return { id: task.id };
    },
    { successMessage: "Task cancelled", formData },
  );
}
