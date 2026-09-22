"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { AccountMenu, type Account } from "@/components/application/account-menu";
import { useShell } from "@/components/application/shell-context";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { crumbsFor } from "@/config/navigation";

/**
 * The top navbar (canvas colour, no border). Left: the sidebar toggle, then where you are as shadcn <Breadcrumb> (every ancestor a
 * link) and the current record's status chips. Right: the page's buttons, then the enquiries bell (a dot when something needs attention) and the account menu. Pages and tabs put their buttons here
 * through <TopbarActions> (see topbar-slot.tsx), so no page needs a title row above its content. It lives in the layout, so it never
 * disappears while a page loads.
 */
export function Topbar({ account, signedIn, attention = 0 }: { account: Account | null; signedIn: boolean; attention?: number }) {
  const pathname = usePathname();
  const { crumbs } = useShell();
  const trail = crumbsFor(pathname, crumbs);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 bg-canvas px-6">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1 text-muted-foreground" />
        <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            {trail.map((crumb, index) => {
              const last = index === trail.length - 1;
              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  {index > 0 ? <BreadcrumbSeparator /> : null}
                  <BreadcrumbItem className="min-w-0">
                    {crumb.href && !last ? (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="max-w-[22rem] truncate font-medium">{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
        <div id="topbar-meta" className="flex shrink-0 items-center gap-1.5 empty:hidden" />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div id="topbar-actions" className="flex items-center gap-2 empty:hidden" />
        <Link
          href="/enquiries"
          aria-label={attention > 0 ? `${attention} enquiries need attention` : "Enquiries"}
          title={attention > 0 ? `${attention} enquiries need attention` : "No enquiries need attention"}
          className="relative grid size-9 place-items-center rounded-full text-foreground/70 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <Bell className="size-[18px]" strokeWidth={1.5} aria-hidden />
          {attention > 0 ? <span aria-hidden className="absolute top-1.5 right-2 size-2 rounded-full bg-primary ring-2 ring-canvas" /> : null}
        </Link>
        <AccountMenu account={account} signedIn={signedIn} />
      </div>
    </header>
  );
}
