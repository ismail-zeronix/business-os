import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A data table on its own shadcn <Card> (no padding, so the table runs edge to edge). `overflow-clip` (not `overflow-auto`) so the table's
 * sticky header keeps working. Tables that also carry tabs or filters sit inside a <Panel> instead and use the table directly.
 */
export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card data-slot="table-shell" className={cn("gap-0 overflow-clip py-0 shadow-panel", className)}>
      {children}
    </Card>
  );
}
