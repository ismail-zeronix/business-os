import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A section that folds away, built on the native <details> element (keyboard and screen-reader friendly, no script, no dependency).
 * The header shows the title, a one-line `summary` of what is inside (so a closed section still says something useful) and an optional count.
 *  - default: its own card on the canvas.
 *  - `flat`: no card of its own, only a top hairline, for use inside another card.
 */
export function CollapsibleSection({
  title,
  summary,
  count,
  defaultOpen = false,
  flat = false,
  className,
  children,
}: {
  title: string;
  summary?: ReactNode;
  count?: number;
  defaultOpen?: boolean;
  flat?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className={cn("group", flat ? "border-t" : "overflow-clip rounded-lg bg-card shadow-panel ring-1 ring-foreground/10", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 select-none hover:bg-surface [&::-webkit-details-marker]:hidden">
        <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{title}</span>
        {count !== undefined ? <span className="num rounded-md bg-muted px-1.5 text-[11px] text-muted-foreground">{count}</span> : null}
        {summary ? <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground group-open:invisible">{summary}</span> : <span className="flex-1" />}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t p-4">{children}</div>
    </details>
  );
}
