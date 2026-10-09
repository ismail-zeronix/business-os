import Link from "next/link";
import { EmptyState } from "@/components/application/states";
import { InitialsAvatar } from "@/components/application/soft-pill";
import { TaskPriorityPill, TaskStatusPill, TaskUrgencyBadge } from "@/components/application/status-badges";
import { TableShell } from "@/components/data-table/table-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TaskLinkType } from "@/generated/prisma/enums";
import type { UnifiedTaskRow } from "../queries";

const LINK_TYPE_LABEL: Record<TaskLinkType, string> = { ENQUIRY: "Enquiry", CUSTOMER: "Customer", EMAIL: "Email" };

/**
 * One row per unit of work, manual and system-derived mixed together (queries.ts already sorted them by urgency).
 * A derived row's title is the link straight to the real record; its Status cell says "System" (nothing to complete
 * here - it clears on its own once the underlying record changes).
 */
export function TasksTable({ rows, bare = false, taskHref }: { rows: UnifiedTaskRow[]; bare?: boolean; taskHref?: (taskId: string) => string }) {
  const now = new Date();
  const table = (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-10 w-[40%] bg-transparent px-4">Task</TableHead>
          <TableHead className="h-10 w-[17%] bg-transparent px-4">Assignee</TableHead>
          <TableHead className="h-10 w-[13%] bg-transparent px-4">Priority</TableHead>
          <TableHead className="h-10 w-[15%] bg-transparent px-4">Due / age</TableHead>
          <TableHead className="h-10 w-[15%] bg-transparent px-4">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} className="relative border-border/70 hover:bg-zinc-50/80">
            <TableCell className="px-4 py-2">
              <Link
                href={row.origin === "manual" && taskHref ? taskHref(row.id) : row.href}
                scroll={false}
                className="block truncate font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/60 focus-visible:after:ring-inset"
              >
                {row.title}
              </Link>
              <span className="block truncate text-xs text-muted-foreground">{row.linkedType ? LINK_TYPE_LABEL[row.linkedType] : "Manual task"}</span>
            </TableCell>
            <TableCell className="px-4 py-2">
              {row.assignedTo ? (
                <div className="flex items-center gap-2">
                  <InitialsAvatar name={row.assignedTo.name} size={24} />
                  <span className="truncate text-xs">{row.assignedTo.name}</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Unassigned</span>
              )}
            </TableCell>
            <TableCell className="px-4 py-2">
              <TaskPriorityPill priority={row.priority} />
            </TableCell>
            <TableCell className="px-4 py-2">
              <TaskUrgencyBadge urgency={row.urgency} dueAt={row.dueAt} anchorAt={row.anchorAt} now={now} />
            </TableCell>
            <TableCell className="px-4 py-2">{row.status ? <TaskStatusPill status={row.status} /> : <span className="text-xs text-muted-foreground">System</span>}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
  return bare ? table : <TableShell className="rounded-lg">{table}</TableShell>;
}

export function NoTasks({ title = "Nothing here", description, action, bare = false }: { title?: string; description?: string; action?: React.ReactNode; bare?: boolean }) {
  const empty = <EmptyState title={title} description={description} action={action} />;
  return bare ? <div className="py-10">{empty}</div> : <TableShell>{empty}</TableShell>;
}
