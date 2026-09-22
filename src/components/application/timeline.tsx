import { Panel } from "@/components/application/page-canvas";
import { EmptyState } from "@/components/application/states";
import { formatDateTime, formatRelativeAge } from "@/lib/format";
import { auditActionLabel, describeDetails } from "@/modules/audit/describe";
import type { AuditRow } from "@/modules/audit/queries";

/** Activity timeline built from audit rows (time, actor, what happened, a short line per change), on its own panel (`flat`: the list only, for use inside another card). */
export function Timeline({ rows, emptyTitle = "No activity yet", flat = false }: { rows: AuditRow[]; emptyTitle?: string; flat?: boolean }) {
  if (rows.length === 0) {
    return flat ? (
      <p className="text-sm text-muted-foreground">{emptyTitle}</p>
    ) : (
      <Panel>
        <EmptyState title={emptyTitle} />
      </Panel>
    );
  }
  const now = new Date();

  const list = (
      <ol className="relative ml-1 space-y-4 border-l pl-5">
        {rows.map((row) => {
          const lines = describeDetails(row.details);
          return (
            <li key={row.id} className="relative">
              <span aria-hidden className="absolute top-1.5 -left-[25px] size-2 rounded-full border border-background bg-muted-foreground/50 ring-2 ring-background" />
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium">{auditActionLabel(row.action)}</span>
                <span className="text-xs text-muted-foreground">by {row.actorName ?? "System"}</span>
                <time dateTime={row.createdAt.toISOString()} title={formatDateTime(row.createdAt)} className="num text-xs text-muted-foreground">
                  {formatRelativeAge(row.createdAt, now)}
                </time>
              </div>
              {lines.length ? (
                <ul className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                  {lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
  );
  return flat ? list : <Panel className="p-5">{list}</Panel>;
}
