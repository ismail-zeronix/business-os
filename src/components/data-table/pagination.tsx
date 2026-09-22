import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildHref, PAGE_SIZE, type SearchParams } from "@/lib/search-params";

/** Server-side pagination driven by the `page` URL param. Server component: plain links, no client state. */
export function Pagination({
  pathname,
  searchParams,
  page,
  total,
  pageSize = PAGE_SIZE,
}: {
  pathname: string;
  searchParams: SearchParams;
  page: number;
  total: number;
  pageSize?: number;
}) {
  if (total === 0) return null;

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(total, current * pageSize);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
      <span className="num">
        {from}-{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        {current > 1 ? (
          <Button asChild variant="outline" size="xs">
            <Link href={buildHref(pathname, searchParams, { page: current - 1 === 1 ? undefined : current - 1 })}>
              <ChevronLeft aria-hidden /> Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="xs" disabled>
            <ChevronLeft aria-hidden /> Previous
          </Button>
        )}
        <span className="num px-1">
          Page {current} of {pages}
        </span>
        {current < pages ? (
          <Button asChild variant="outline" size="xs">
            <Link href={buildHref(pathname, searchParams, { page: current + 1 })}>
              Next <ChevronRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="xs" disabled>
            Next <ChevronRight aria-hidden />
          </Button>
        )}
      </div>
    </nav>
  );
}
