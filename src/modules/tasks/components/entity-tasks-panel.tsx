import { Plus } from "lucide-react";
import Link from "next/link";
import { PanelSection } from "@/components/application/page-canvas";
import { TaskPriorityPill, TaskStatusPill, TaskUrgencyBadge } from "@/components/application/status-badges";
import { FormDrawer } from "@/components/forms/form-drawer";
import { Button } from "@/components/ui/button";
import { getCurrentActor } from "@/core/permissions/actor";
import type { TaskLinkType } from "@/generated/prisma/enums";
import { listUserOptions } from "@/modules/enquiries/queries";
import { listTasksForEntity } from "../queries";
import { TaskForm } from "./task-form";

/**
 * Manually-linked tasks for one Enquiry/Customer/EmailMessage, shown on that record's own page. Derived tasks are
 * never repeated here - the record's own page already shows the state they are computed from (status, blocker,
 * required-by, whether a quotation exists).
 */
export async function EntityTasksPanel({
  linkedType,
  linkedId,
  linkedLabel,
  taskHref = (taskId) => `/tasks?task=${taskId}`,
}: {
  linkedType: TaskLinkType;
  linkedId: string;
  linkedLabel: string;
  /** Defaults to opening the task on the main /tasks page (no nested sheet) - pass one built from the current page's
   *  own searchParams (buildHref) when that page already mounts its own <TaskSheet>, so the link stays on-page. */
  taskHref?: (taskId: string) => string;
}) {
  const [tasks, actor, users] = await Promise.all([listTasksForEntity(linkedType, linkedId), getCurrentActor(), listUserOptions()]);
  const isAdmin = actor.role === "ADMIN";
  const now = new Date();

  return (
    <PanelSection
      title="Tasks"
      actions={
        <FormDrawer
          trigger={
            <Button variant="outline" size="sm">
              <Plus aria-hidden /> Add task
            </Button>
          }
          title="New task"
          description={`Linked to ${linkedLabel}.`}
        >
          <TaskForm isAdmin={isAdmin} currentUserId={actor.id} users={users} defaultLinkedType={linkedType} defaultLinkedId={linkedId} linkedLabel={linkedLabel} />
        </FormDrawer>
      }
    >
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">No tasks yet.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-surface px-3 py-2">
              <Link href={taskHref(task.id)} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                {task.title}
              </Link>
              <span className="text-xs text-muted-foreground">{task.assignedTo?.name ?? "Unassigned"}</span>
              <TaskPriorityPill priority={task.priority} />
              {task.status === "OPEN" ? <TaskUrgencyBadge urgency={task.urgency} dueAt={task.dueAt} anchorAt={task.anchorAt} now={now} /> : null}
              {task.status ? <TaskStatusPill status={task.status} /> : null}
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  );
}
