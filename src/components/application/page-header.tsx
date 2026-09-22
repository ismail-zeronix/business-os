import type { ReactNode } from "react";
import { SetCrumbs } from "@/components/application/shell-context";
import { TopbarActions, TopbarMeta } from "@/components/application/topbar-slot";
import type { Crumb } from "@/config/navigation";

export type Breadcrumb = Crumb;

/**
 * A page's header, with nothing drawn on the canvas (design v2): the top navbar already says where you are, so there is no title row.
 *  - `title` (and `subtitle`) stay in the document as screen-reader text, so every page still has a proper heading.
 *  - `breadcrumbs` name the record for the navbar (`Suppliers > ABC Computers`); pages that pass none get the route's own trail.
 *  - `meta` (status chips) is shown next to the breadcrumbs; `actions` (the page's buttons) in the navbar's right side.
 */
export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  meta,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumbs?: Breadcrumb[];
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <>
      {breadcrumbs?.length ? <SetCrumbs items={breadcrumbs} /> : null}
      {meta ? <TopbarMeta>{meta}</TopbarMeta> : null}
      {actions ? <TopbarActions>{actions}</TopbarActions> : null}
      <h1 className="sr-only">{title}</h1>
      {subtitle ? <p className="sr-only">{subtitle}</p> : null}
    </>
  );
}

/** Small uppercase caption for a block INSIDE a panel, e.g. "PROFILE". Never used to head a panel from outside on the canvas. */
export function PanelCaption({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{children}</h2>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
