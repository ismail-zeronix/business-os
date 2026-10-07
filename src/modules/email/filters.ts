import { EmailTriageStatus } from "../../generated/prisma/enums";
import { firstParam, parsePage, type SearchParams } from "../../lib/search-params";
import type { EmailAssigneeFilter, EmailBandFilter, EmailListParams } from "./queries";

const BANDS: readonly EmailBandFilter[] = ["likely-review", "all", "low"];
const ASSIGNEES: readonly EmailAssigneeFilter[] = ["all", "mine", "unassigned"];

/** Turns untrusted URL params into safe query params. Anything invalid falls back to the default view (likely and review, still waiting, anyone's). */
export function parseEmailFilters(searchParams: SearchParams): EmailListParams {
  const band = firstParam(searchParams, "band");
  const status = firstParam(searchParams, "state");
  const assignee = firstParam(searchParams, "assignee");
  return {
    band: (BANDS as readonly string[]).includes(band ?? "") ? (band as EmailBandFilter) : "likely-review",
    status: (Object.values(EmailTriageStatus) as string[]).includes(status ?? "") ? (status as EmailTriageStatus) : "NEW",
    assignee: (ASSIGNEES as readonly string[]).includes(assignee ?? "") ? (assignee as EmailAssigneeFilter) : "all",
    page: parsePage(searchParams),
  };
}
