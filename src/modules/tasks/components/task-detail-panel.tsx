"use client";

import Link from "next/link";
import { useState } from "react";
import { KeyValue } from "@/components/application/key-value";
import { PanelCaption } from "@/components/application/page-header";
import { TaskPriorityPill, TaskStatusPill } from "@/components/application/status-badges";
import type { SelectOption } from "@/components/forms/multi-select";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type { TaskDetail } from "../queries";
import { AssignTaskControl, CancelTaskControl, CompleteTaskButton, ReopenTaskButton } from "./task-actions";
import { TaskForm } from "./task-form";

export function TaskDetailPanel({ task, currentUserId, isAdmin, users }: { task: TaskDetail; currentUserId: string; isAdmin: boolean; users: SelectOption[] }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <TaskForm
        task={{ id: task.id, title: task.title, description: task.description, priority: task.priority, dueAt: task.dueAt }}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
        users={users}
        onSaved={() => setEditing(false)}
      />
    );
  }

  return (
    <>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <TaskStatusPill status={task.status} />
          <TaskPriorityPill priority={task.priority} />
        </div>
        <h3 className="text-sm font-semibold break-words">{task.title}</h3>
        {task.description ? <p className="text-sm whitespace-pre-wrap text-muted-foreground">{task.description}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <AssignTaskControl taskId={task.id} assignedToId={task.assignedTo?.id ?? null} assignedToName={task.assignedTo?.name ?? null} currentUserId={currentUserId} isAdmin={isAdmin} users={users} />
          {task.status === "OPEN" ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <CompleteTaskButton taskId={task.id} />
              <CancelTaskControl taskId={task.id} />
            </>
          ) : (
            <ReopenTaskButton taskId={task.id} />
          )}
        </div>

        {task.status === "CANCELLED" ? (
          <p className="text-xs text-muted-foreground">
            Cancelled{task.cancelledBy ? ` by ${task.cancelledBy.name}` : ""}
            {task.cancelledAt ? ` on ${formatDateTime(task.cancelledAt)}` : ""}: {task.cancelledReason}
          </p>
        ) : null}
        {task.status === "DONE" ? (
          <p className="text-xs text-muted-foreground">
            Completed{task.completedBy ? ` by ${task.completedBy.name}` : ""}
            {task.completedAt ? ` on ${formatDateTime(task.completedAt)}` : ""}.
          </p>
        ) : null}
      </section>

      <section>
        <PanelCaption>Details</PanelCaption>
        <KeyValue
          columns={1}
          items={[
            { label: "Due", value: task.dueAt ? formatDateTime(task.dueAt) : null },
            {
              label: "Linked to",
              value: task.linked ? (
                <Link href={task.linked.href} className="text-brand hover:underline">
                  {task.linked.label}
                </Link>
              ) : null,
            },
            { label: "Created by", value: task.createdBy.name },
            { label: "Created", value: formatDateTime(task.createdAt) },
          ]}
        />
      </section>
    </>
  );
}
