"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Account } from "@/components/application/account-menu";
import { BrandMark } from "@/components/application/brand-mark";
import { InitialsAvatar } from "@/components/application/soft-pill";
import { NAVIGATION, isNavActive } from "@/config/navigation";
import { USER_ROLE_LABEL } from "@/lib/labels";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

/** Live counts per nav href, from the database (real data only). An entry above zero draws an amber badge: something is waiting for a person. */
export type NavCounts = Record<string, number>;

/**
 * The application sidebar, built from the shadcn <Sidebar> parts: white with a hairline right edge and a header row (the Business OS mark and wordmark)
 * on the deep green surface (design v3). It starts collapsed as an icon rail (logo mark, icons with tooltips, avatar) and opens with the
 * navbar toggle or Ctrl+B (there is no edge handle: it overlapped the page) (the wordmark then reveals with a short animation), and is a sheet on small screens. Groups come from config/navigation.ts; the active item is a solid green pill; counts show what needs attention (enquiries to review, broadcasts awaiting review). The footer names who is acting.
 */
export function AppSidebar({ account, signedIn, counts }: { account: Account | null; signedIn: boolean; counts: NavCounts }) {
  const pathname = usePathname();
  const { state, isMobile } = useSidebar();
  // The mobile sheet always shows the full sidebar, whatever the desktop rail is doing.
  const expanded = isMobile || state === "expanded";
  const actorName = account?.name ?? null;
  const isAdmin = account?.role === "ADMIN";
  const groups = NAVIGATION.map((group) => ({ ...group, items: group.items.filter((item) => !item.adminOnly || isAdmin) })).filter((group) => group.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 justify-center px-[18px] py-0">
        <Link href="/" aria-label="Business OS, go to Overview" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <MotionConfig reducedMotion="user">
            {/* The mark makes a turn as the rail opens or closes and the wordmark slides out behind it. Nothing animates on the first paint. */}
            <BrandMark expanded={expanded} className="size-8 shrink-0" />
            <AnimatePresence initial={false}>
              {expanded ? (
                <motion.span
                  key="wordmark"
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="text-xl font-bold tracking-tight whitespace-nowrap text-white"
                >
                  Business OS
                </motion.span>
              ) : null}
            </AnimatePresence>
          </MotionConfig>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-1 pt-2">
        {groups.map((group, index) => (
          <SidebarGroup key={group.label ?? index}>
            {group.label ? <SidebarGroupLabel className="text-[11px] transition-none font-medium tracking-wider text-sidebar-foreground/50 uppercase">{group.label}</SidebarGroupLabel> : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isNavActive(pathname, item.href);
                  const Icon = item.icon;
                  const count = counts[item.href] ?? 0;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label} className="h-11 gap-3 rounded-xl px-[11px] transition-none text-base text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-white data-active:bg-sidebar-primary data-active:font-semibold data-active:text-sidebar-primary-foreground group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-[11px]! [&_svg]:size-[22px]! [&_svg]:text-sidebar-foreground/85 data-active:[&_svg]:text-white">
                        <Link href={item.href} aria-current={active ? "page" : undefined}>
                          <Icon strokeWidth={1.75} aria-hidden />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {count > 0 ? (
                        <SidebarMenuBadge aria-label={`${count} waiting`} className="rounded-full bg-primary text-primary-foreground peer-data-[size=default]/menu-button:top-2.5">
                          {count}
                        </SidebarMenuBadge>
                      ) : null}
                      {count > 0 ? <span aria-hidden className="pointer-events-none absolute top-1.5 right-2 hidden size-2.5 rounded-full bg-primary ring-2 ring-sidebar group-data-[collapsible=icon]:block" /> : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 px-1.5 py-0.5">
          <InitialsAvatar name={actorName ?? "?"} size={32} muted={!actorName} />
          <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-medium text-white">{actorName ?? "Unavailable"}</div>
            <div className="truncate text-[11px] text-sidebar-foreground/60">{signedIn && account ? USER_ROLE_LABEL[account.role] : "Sign-in not set up"}</div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
