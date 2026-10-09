import { z } from "zod";
import { EmptyState } from "@/components/application/states";
import { UrlSheet } from "@/components/application/url-sheet";
import { getCurrentActor } from "@/core/permissions/actor";
import { listUserOptions } from "@/modules/enquiries/queries";
import { getTaskDetail } from "../queries";
import { TaskDetailPanel } from "./task-detail-panel";

/** Server-rendered task drawer for `?task=<id>`. Renders nothing when there is no (valid) id. */
export async function TaskSheet({ taskId, closeHref }: { taskId: string | undefined; closeHref: string }) {
  if (!taskId || !z.uuid().safeParse(taskId).success) return null;
  const [task, actor, users] = await Promise.all([getTaskDetail(taskId), getCurrentActor(), listUserOptions()]);
  return (
    <UrlSheet key={taskId} closeHref={closeHref} label="Task" title="Task" description="Manual task details and actions.">
      {task ? (
        <TaskDetailPanel task={task} currentUserId={actor.id} isAdmin={actor.role === "ADMIN"} users={users} />
      ) : (
        <EmptyState title="Task not found" description="This task does not exist or the link is out of date." />
      )}
    </UrlSheet>
  );
}
