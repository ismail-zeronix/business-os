import Link from "next/link";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * The toolbar row at the top of a list <Panel> (design v2): the search box and filter pills on the left, extras on the right. Shows
 * "Clear" only when some filter is active. All state lives in the URL.
 */
export function FilterBar({ children, clearHref, hasActiveFilters }: { children: ReactNode; clearHref: string; hasActiveFilters: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3">
      {children}
      {hasActiveFilters ? (
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href={clearHref}>
            <X aria-hidden /> Clear
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
