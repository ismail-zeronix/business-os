import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type PanelTab = {
  key: string;
  label: string;
  icon?: LucideIcon;
  /** Shown as a small count chip. */
  count?: number;
  /** A count above zero is tinted amber: something is waiting for a person. */
  attention?: boolean;
  href: string;
};

/** The small count after a tab label (shadcn Badge). Amber when `attention` and above zero: something is waiting for a person. */
export function TabCount({ count, attention = false, selected = false }: { count: number; attention?: boolean; selected?: boolean }) {
  return (
    <Badge variant={attention && count > 0 ? "warning" : "neutral"} className={cn("num h-5 min-w-5 justify-center px-1.5 text-[11px]", !(attention && count > 0) && !selected && "text-muted-foreground")}>
      {count}
    </Badge>
  );
}

/** Tab styling on top of the shadcn line variant: full-height triggers with the active underline on the strip's bottom edge. */
export const TAB_TRIGGER_CLASS = "flex-none gap-2 rounded-md px-3 group-data-horizontal/tabs:after:inset-x-3 group-data-horizontal/tabs:after:bottom-0 after:rounded-full";

/**
 * Tabs for the top of a <Panel>, each with an optional icon and count chip: shadcn <Tabs> (line variant) whose triggers are plain links.
 * The tab lives in the URL, so views are shareable and the back button works; the links carry the current filters (the caller builds them).
 */
export function PanelTabs({ tabs, active, label = "Views" }: { tabs: PanelTab[]; active: string; label?: string }) {
  return (
    <Tabs value={active} className="gap-0">
      <TabsList variant="line" aria-label={label} className="w-full justify-start gap-1 overflow-x-auto rounded-none border-b p-0 px-3 group-data-horizontal/tabs:h-11">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger key={tab.key} value={tab.key} asChild className={cn(TAB_TRIGGER_CLASS, "h-11")}>
              <Link href={tab.href} scroll={false}>
                {Icon ? <Icon strokeWidth={1.5} aria-hidden /> : null}
                {tab.label}
                {tab.count !== undefined ? <TabCount count={tab.count} attention={tab.attention} selected={tab.key === active} /> : null}
              </Link>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
