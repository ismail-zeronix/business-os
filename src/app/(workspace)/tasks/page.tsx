import { CheckCircle2, ListTodo, Plus, X, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/application/page-canvas";
import { PageHeader } from "@/components/application/page-header";
import { PanelTabs, type PanelTab } from "@/components/application/panel-tabs";
import { FilterPill } from "@/components/data-table/filter-pill";
import { Pagination } from "@/components/data-table/pagination";
import { FormDrawer } from "@/components/forms/form-drawer";
import { Button } from "@/components/ui/button";
import { getCurrentActor, requireActor } from "@/core/permissions/actor";
import { buildHref, firstParam, type SearchParams } from "@/lib/search-params";
import { listUserOptions } from "@/modules/enquiries/queries";
import { TaskForm } from "@/modules/tasks/components/task-form";
import { TaskSheet } from "@/modules/tasks/components/task-sheet";
import { NoTasks, TasksTable } from "@/modules/tasks/components/tasks-table";
import { parseTaskFilters } from "@/modules/tasks/filters";
import { countTasksByStatus, listTasks, type TaskStatusFilter } from "@/modules/tasks/queries";

export const metadata: Metadata = { title: "Tasks" };

const TABS: { key: TaskStatusFilter; label: string; icon: PanelTab["icon"]; attention?: boolean }[] = [
  { key: "open", label: "Open", icon: ListTodo, attention: true },
  { key: "done", label: "Done", icon: CheckCircle2 },
  { key: "cancelled", label: "Cancelled", icon: XCircle },
];

const EMPTY: Record<TaskStatusFilter, { title: string; description: string }> = {
  open: { title: "Nothing open", description: "Enquiries needing attention, emails waiting for triage, and manual tasks will show up here." },
  done: { title: "Nothing done yet", description: "Completed manual tasks appear here." },
  cancelled: { title: "Nothing cancelled", description: "Cancelled manual tasks appear here, with their reason." },
};

export default async function TasksPage(props: PageProps<"/tasks">) {
  await requireActor();
  const actor = await getCurrentActor();
  const searchParams = await props.searchParams;
  const params = parseTaskFilters(searchParams);

  const [counts, { rows, total }, users] = await Promise.all([countTasksByStatus(params.assignee, actor.id), listTasks(params, actor.id), listUserOptions()]);
  const carried: SearchParams = { assignee: searchParams.assignee };
  const tabs: PanelTab[] = TABS.map((tab) => ({ key: tab.key, label: tab.label, icon: tab.icon, attention: tab.attention, count: counts[tab.key], href: buildHref("/tasks", carried, { state: tab.key === "open" ? undefined : tab.key }) }));
  const filtered = params.assignee !== "all";
  const clearHref = buildHref("/tasks", searchParams, { assignee: undefined, page: undefined });
  const taskHref = (taskId: string) => buildHref("/tasks", searchParams, { task: taskId });

  const newTask = (
    <FormDrawer trigger={<Button size="sm"><Plus aria-hidden /> New task</Button>} title="New task" description="Admins can assign anyone; you can only assign tasks to yourself.">
      <TaskForm isAdmin={actor.role === "ADMIN"} currentUserId={actor.id} users={users} />
    </FormDrawer>
  );

  return (
    <>
      <PageHeader title="Tasks" subtitle="What is pending, who it is assigned to, and how urgent it is." actions={newTask} />
      <Panel flush>
        <PanelTabs tabs={tabs} active={params.status} label="Task views" />
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <FilterPill
            param="assignee"
            label="Assigned"
            mode="single"
            defaultValue="all"
            options={[
              { value: "all", label: "Anyone" },
              { value: "mine", label: "Assigned to me" },
              { value: "unassigned", label: "Unassigned" },
            ]}
          />
          {filtered ? (
            <Button asChild variant="ghost" size="sm" className="rounded-lg text-muted-foreground">
              <Link href={clearHref}>
                <X aria-hidden /> Clear
              </Link>
            </Button>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <NoTasks bare title={EMPTY[params.status].title} description={EMPTY[params.status].description} action={params.status === "open" ? newTask : undefined} />
        ) : (
          <>
            <TasksTable rows={rows} bare taskHref={taskHref} />
            <Pagination pathname="/tasks" searchParams={searchParams} page={params.page} total={total} />
          </>
        )}
      </Panel>
      <TaskSheet taskId={firstParam(searchParams, "task")} closeHref={buildHref("/tasks", searchParams, { task: undefined })} />
    </>
  );
}
