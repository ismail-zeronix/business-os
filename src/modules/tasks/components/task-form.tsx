"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import type { SelectOption } from "@/components/forms/multi-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { useDrawerClose } from "@/components/forms/form-drawer";
import { fieldError, fieldValue, useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TaskLinkType, TaskPriority } from "@/generated/prisma/enums";
import { TASK_PRIORITY_LABEL, toOptions } from "@/lib/labels";
import { toZonedInputValue } from "@/lib/format";
import { createTaskAction, updateTaskAction } from "../actions";

export type TaskFormInitial = { id: string; title: string; description: string | null; priority: TaskPriority; dueAt: Date | null };

/**
 * Create or edit a manual task. Only the create form offers an assignee: who may already own a task is changed
 * through the Assign control instead (task-actions.tsx), which carries the admin-or-self gate.
 */
export function TaskForm({
  task,
  isAdmin,
  currentUserId,
  users,
  defaultLinkedType,
  defaultLinkedId,
  linkedLabel,
  onSaved,
}: {
  task?: TaskFormInitial;
  isAdmin: boolean;
  currentUserId: string;
  users: SelectOption[];
  defaultLinkedType?: TaskLinkType;
  defaultLinkedId?: string;
  linkedLabel?: string;
  onSaved?: () => void;
}) {
  const closeDrawer = useDrawerClose();
  const editing = Boolean(task);
  const [state, formAction] = useActionState(editing ? updateTaskAction : createTaskAction, null);
  useActionFeedback(state, () => {
    closeDrawer();
    onSaved?.();
  });

  const text = (name: "title" | "description") => fieldValue(state, name, task?.[name] ?? null);
  const err = (name: string) => fieldError(state, name);
  // A non-admin can only ever leave a new task unassigned or assigned to themselves (enforced again in the service).
  const assigneeOptions = isAdmin ? users : users.filter((u) => u.value === currentUserId);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {task ? <input type="hidden" name="id" value={task.id} /> : null}
      {!editing && defaultLinkedType && defaultLinkedId ? (
        <>
          <input type="hidden" name="linkedType" value={defaultLinkedType} />
          <input type="hidden" name="linkedId" value={defaultLinkedId} />
        </>
      ) : null}
      <FormMessage state={state} />
      {linkedLabel ? <p className="text-xs text-muted-foreground">Linked to {linkedLabel}</p> : null}

      <Field label="Title" htmlFor="tf-title" required error={err("title")}>
        <Input id="tf-title" name="title" defaultValue={text("title")} autoFocus aria-invalid={Boolean(err("title"))} />
      </Field>
      <Field label="Description" htmlFor="tf-description" error={err("description")}>
        <Textarea id="tf-description" name="description" rows={3} defaultValue={text("description")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Priority" htmlFor="tf-priority" error={err("priority")}>
          <SelectField id="tf-priority" name="priority" allowNone={false} defaultValue={fieldValue(state, "priority", task?.priority ?? "NORMAL")} options={toOptions(TASK_PRIORITY_LABEL)} />
        </Field>
        <Field label="Due" htmlFor="tf-dueAt" error={err("dueAt")} hint="Blank = no due date">
          <Input id="tf-dueAt" name="dueAt" type="datetime-local" defaultValue={fieldValue(state, "dueAt", task?.dueAt ? toZonedInputValue(task.dueAt) : null)} />
        </Field>
      </div>
      {!editing ? (
        <Field label="Assign to" htmlFor="tf-assignee" error={err("assignedToId")} hint={isAdmin ? "Defaults to unassigned." : "You can only assign tasks to yourself."}>
          <SelectField id="tf-assignee" name="assignedToId" noneLabel="Unassigned" options={assigneeOptions} />
        </Field>
      ) : null}

      <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-popover px-4 py-3">
        <Button type="button" variant="outline" onClick={() => (onSaved ? onSaved() : closeDrawer())}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Saving...">{editing ? "Save changes" : "Create task"}</SubmitButton>
      </div>
    </form>
  );
}
