import type { ReactNode } from "react";
import { BrandMark } from "@/components/application/brand-mark";

/** The two public screens (sign in, first-time setup): a small centred card, no sidebar, no data. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-svh place-items-center bg-canvas p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2.5">
          <BrandMark expanded={false} className="size-9" />
          <span className="text-xl font-bold tracking-tight">Business OS</span>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-panel">{children}</div>
        <p className="text-center text-xs text-muted-foreground">Zeronix Intelligence · internal use only</p>
      </div>
    </main>
  );
}
