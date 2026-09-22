import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type SideTab = { key: string; label: string; href: string; count?: number };

/**
 * The right-hand card: one card, several lists, chosen with pill tabs that live in the URL (`?tab=`). A future list is one more entry in
 * the page's tab array plus one list component; nothing else changes. `viewAll` links to where the active list is worked.
 */
export function SideTabs({ tabs, active, viewAll, children }: { tabs: SideTab[]; active: string; viewAll: { href: string; label: string }; children: ReactNode }) {
  return (
    <Card className="min-w-0 gap-0 py-0 shadow-panel">
      <div className="p-4 pb-3">
        <Tabs value={active} className="gap-0">
          <TabsList aria-label="Lists" className="w-full flex-wrap justify-start gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key} asChild className="h-8 flex-none rounded-full bg-muted px-3.5 text-xs data-active:bg-brand/15 data-active:font-semibold data-active:text-brand data-active:shadow-none">
                <Link href={tab.href} scroll={false}>
                  {tab.label}
                  {tab.count !== undefined ? <span className="num"> ({tab.count})</span> : null}
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="flex-1 border-t">{children}</div>
      <div className="border-t px-4 py-3 text-xs">
        <Link href={viewAll.href} className="font-medium text-brand hover:underline">
          {viewAll.label} →
        </Link>
      </div>
    </Card>
  );
}
