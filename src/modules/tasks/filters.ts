import { firstParam, parsePage, type SearchParams } from "../../lib/search-params";
import type { TaskAssigneeFilter, TaskListParams, TaskStatusFilter } from "./queries";

const STATUSES: readonly TaskStatusFilter[] = ["open", "done", "cancelled"];
const ASSIGNEES: readonly TaskAssigneeFilter[] = ["all", "mine", "unassigned"];

/** Turns untrusted URL params into safe query params. Anything invalid falls back to the default view (open, anyone's). */
export function parseTaskFilters(searchParams: SearchParams): TaskListParams {
  const status = firstParam(searchParams, "state");
  const assignee = firstParam(searchParams, "assignee");
  return {
    status: (STATUSES as readonly string[]).includes(status ?? "") ? (status as TaskStatusFilter) : "open",
    assignee: (ASSIGNEES as readonly string[]).includes(assignee ?? "") ? (assignee as TaskAssigneeFilter) : "all",
    page: parsePage(searchParams),
  };
}
