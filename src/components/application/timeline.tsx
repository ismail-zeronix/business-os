import { Panel } from "@/components/application/page-canvas";
import { EmptyState } from "@/components/application/states";
import { formatDateTime, formatRelativeAge } from "@/lib/format";
import { auditActionLabel, describeDetails } from "@/modules/audit/describe";
import { AUDIT_TONE_CLASS, auditActionVisual } from "@/modules/audit/icons";
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
      <ol className="space-y-1">
        {rows.map((row, index) => {
          const lines = describeDetails(row.details);
          const { icon: Icon, tone } = auditActionVisual(row.action);
          return (
            <li key={row.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span aria-hidden className={`flex size-7 shrink-0 items-center justify-center rounded-full ${AUDIT_TONE_CLASS[tone]}`}>
                  <Icon className="size-3.5" strokeWidth={1.5} />
                </span>
                {index < rows.length - 1 ? <span aria-hidden className="my-0.5 w-px flex-1 bg-border" /> : null}
              </div>
              <div className="min-w-0 flex-1 pb-4">
                <div className="flex flex-wrap items-baseline gap-x-2 pt-1">
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
              </div>
            </li>
          );
        })}
      </ol>
  );
  return flat ? list : <Panel className="p-5">{list}</Panel>;
}
