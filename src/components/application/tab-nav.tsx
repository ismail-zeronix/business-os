import Link from "next/link";
import { TAB_TRIGGER_CLASS, TabCount } from "@/components/application/panel-tabs";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type TabItem = { key: string; label: string; count?: number };

/**
 * URL-driven tabs (`?tab=`) for a page: shadcn <Tabs> (line variant) with plain links as triggers, so the active tab is shareable and
 * back-button safe. Only pass tabs whose content really exists. (Tabs that live at the top of a <Panel> use <PanelTabs>, which also
 * carries icons and the current filters.)
 *  - `flush`: a full-width white strip directly under the top navbar (record pages: place it before the <PageBody>).
 *  - default: on the canvas, inside a <PageBody>, for tabs that sit below other content.
 */
export function TabNav({ tabs, active, basePath, param = "tab", flush = false }: { tabs: TabItem[]; active: string; basePath: string; param?: string; flush?: boolean }) {
  return (
    <Tabs value={active} className={cn("gap-0", !flush && "mb-4")}>
      <TabsList
        variant="line"
        aria-label="Sections"
        className={cn("w-full justify-start gap-1 overflow-x-auto rounded-none border-b p-0", flush ? "bg-background px-3 group-data-horizontal/tabs:h-11" : "group-data-horizontal/tabs:h-10")}
      >
        {tabs.map((tab, index) => (
          <TabsTrigger key={tab.key} value={tab.key} asChild className={cn(TAB_TRIGGER_CLASS, flush ? "h-11" : "h-10")}>
            <Link href={index === 0 ? basePath : `${basePath}?${param}=${tab.key}`}>
              {tab.label}
              {tab.count !== undefined ? <TabCount count={tab.count} selected={tab.key === active} /> : null}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
