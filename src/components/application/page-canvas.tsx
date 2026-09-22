import type { ReactNode } from "react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The white surface that holds tabs, filters and a table, or any block of content: a shadcn <Card> with its padding removed (a table or a
 * tab strip runs edge to edge) and the app's soft shadow. A <TableShell> placed inside a Panel drops its own ring, radius and shadow, so a
 * table never draws a card inside a card.
 *  - Default: a card on the canvas (inside a <PageBody>), for forms, timelines and tables on record pages.
 *  - `flush`: the page's primary surface. It has no margin, radius, ring or shadow and fills the whole area under the top navbar and
 *    beside the sidebar, so the sidebar, navbar and content read as one frame separated by hairlines. List pages use it.
 */
export function Panel({ children, className, flush = false }: { children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <Card
      className={cn(
        "gap-0 overflow-clip py-0 shadow-panel [&_[data-slot=table-shell]]:rounded-none [&_[data-slot=table-shell]]:shadow-none [&_[data-slot=table-shell]]:ring-0",
        flush && "shrink-0 flex-1 rounded-none shadow-none ring-0",
        className,
      )}
    >
      {children}
    </Card>
  );
}

/**
 * The padded canvas (the light grey app background) for record pages: cards, forms and tables sit on it with a gutter. The workspace
 * layout adds no padding of its own, so a page either fills the frame with a <Panel flush> or wraps its content in a PageBody.
 */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-6 pt-5 pb-10", className)}>{children}</div>;
}

/** A padded shadcn <Card> with a small uppercase title: the standard block for a profile, a set of facts or a small form on a detail page. */
export function PanelSection({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("shadow-panel", className)}>
      {title ? (
        <CardHeader>
          <CardTitle className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{title}</CardTitle>
          {actions ? <CardAction>{actions}</CardAction> : null}
        </CardHeader>
      ) : null}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
