"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Crumb } from "@/config/navigation";

type ShellState = { crumbs: Crumb[] | null; setCrumbs: (crumbs: Crumb[] | null) => void };

const ShellContext = createContext<ShellState | null>(null);

/**
 * Lets a page tell the top navbar which record it is showing. The navbar lives in the layout (so it never disappears while a page loads),
 * the record name lives in the page: this carries one to the other. Plain data only (labels and hrefs).
 */
export function ShellProvider({ children }: { children: ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[] | null>(null);
  const value = useMemo(() => ({ crumbs, setCrumbs }), [crumbs]);
  return <ShellContext value={value}>{children}</ShellContext>;
}

export function useShell(): ShellState {
  const context = useContext(ShellContext);
  if (!context) throw new Error("useShell must be used inside <ShellProvider>");
  return context;
}

/** Rendered by a page (through <PageHeader breadcrumbs>) to register its breadcrumb trail; clears it again when the page goes away. Renders nothing. */
export function SetCrumbs({ items }: { items: Crumb[] }) {
  const { setCrumbs } = useShell();
  const key = JSON.stringify(items);
  useEffect(() => {
    setCrumbs(JSON.parse(key) as Crumb[]);
    return () => setCrumbs(null);
  }, [key, setCrumbs]);
  return null;
}
