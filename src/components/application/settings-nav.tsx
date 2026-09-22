"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Card } from "@/components/ui/card";
import { SETTINGS_NAVIGATION } from "@/config/settings-navigation";
import { cn } from "@/lib/utils";

/** Secondary navigation for /settings (a shadcn Card on the canvas). The items live in `config/settings-navigation.ts`. */
export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings" className="w-52 shrink-0">
      <Card className="gap-5 p-3 shadow-panel">
        {SETTINGS_NAVIGATION.map((group) => (
          <div key={group.label}>
            <div className="px-2 pb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{group.label}</div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                        active ? "bg-zinc-100 font-medium text-foreground" : "text-foreground/70 hover:bg-zinc-50 hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active && "text-brand")} strokeWidth={1.5} aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </Card>
    </nav>
  );
}
