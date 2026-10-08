"use client";

import { FileText, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { displayName } from "../display";
import { useOpenTabs } from "../use-open-tabs";

const hrefFor = (docPath: string) => `/knowledge/${docPath.split("/").map(encodeURIComponent).join("/")}`;
const labelFor = (docPath: string) => displayName(docPath.split("/").pop() ?? docPath);

function activePathFrom(pathname: string): string | null {
  return pathname.startsWith("/knowledge/") ? decodeURIComponent(pathname.slice("/knowledge/".length)) : null;
}

/**
 * The open-tabs strip above the file pane, like a code editor: every page visited this session, until closed. Lives in the layout (not
 * the page) so it stays mounted, and its state survives, across client navigation between pages.
 */
export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const active = activePathFrom(pathname);
  const { tabs, openTab, closeTab } = useOpenTabs();

  useEffect(() => {
    if (active) openTab(active);
  }, [active, openTab]);

  function handleClose(path: string, event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const index = tabs.indexOf(path);
    closeTab(path);
    if (path !== active) return;
    const remaining = tabs.filter((t) => t !== path);
    const fallback = remaining[index] ?? remaining[index - 1];
    router.push(fallback ? hrefFor(fallback) : "/knowledge");
  }

  if (tabs.length === 0) return null;

  return (
    <div role="tablist" aria-label="Open pages" className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b bg-surface">
      {tabs.map((tabPath) => {
        const isActive = tabPath === active;
        const label = labelFor(tabPath);
        return (
          <div
            key={tabPath}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "group flex shrink-0 items-stretch border-r border-t-2 text-[13px] transition-colors",
              isActive ? "border-t-brand bg-background text-foreground" : "border-t-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Link href={hrefFor(tabPath)} title={tabPath} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
              <FileText className={cn("size-3.5 shrink-0", isActive && "text-brand")} strokeWidth={1.5} aria-hidden />
              <span className="max-w-40 truncate">{label}</span>
            </Link>
            <button type="button" onClick={(event) => handleClose(tabPath, event)} aria-label={`Close ${label}`} className="flex items-center rounded p-0.5 pr-2 text-muted-foreground/70 hover:text-foreground">
              <span className="rounded p-0.5 hover:bg-border">
                <X className="size-3.5" strokeWidth={1.5} aria-hidden />
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
