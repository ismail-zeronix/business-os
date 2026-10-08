import type { ReactNode } from "react";

/**
 * The one deliberate exception to "no headings on canvas" (see UI_SYSTEM.md section 2): a record page's own visible
 * title, rendered in the page body under the navbar — not inside `PageHeader`, which stays screen-reader only for
 * list pages. Plain block, no `Card` chrome: it sits directly on the canvas.
 *  - `eyebrow`: a short mono reference above the title (e.g. `ENQ-00142`).
 *  - `title`: the record's own identity — name, number or reference.
 *  - `subline`: secondary facts under the title. The caller joins pieces with `" · "` before passing it in; this
 *    component only renders whatever node it is given.
 *  - `actions`: an optional right-aligned slot, used rarely — most page actions belong in `TopbarActions`, not here.
 */
export function RecordHeader({
  eyebrow,
  title,
  subline,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subline?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{eyebrow}</div> : null}
        <div className="text-[1.5rem] font-semibold leading-tight">{title}</div>
        {subline ? <div className="mt-0.5 text-sm text-muted-foreground">{subline}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
