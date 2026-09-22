import { LoaderCircle, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

/** One sentence and the next action. No artwork (docs/design/UI_SYSTEM.md section 8). */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="max-w-md text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** Plain message, optional retry. Never shows stack traces or SQL; details are logged server-side. */
export function ErrorState({ title = "Something went wrong", message, action }: { title?: string; message?: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-1 px-6 py-12 text-center">
      <TriangleAlert className="mb-1 size-4 text-danger" strokeWidth={1.5} aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      {message ? <p className="max-w-md text-xs text-muted-foreground">{message}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** Thin inline indicator. Layout stays stable; no shimmer walls. */
export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 px-1 py-6 text-xs text-muted-foreground">
      <LoaderCircle className="size-3.5 animate-spin" strokeWidth={1.5} aria-hidden />
      {label}...
    </div>
  );
}

/** Muted explicit "Unknown" (or an em dash). Unknown is a valid value and must always be visible, never blank. */
export function Unknown({ dash = false }: { dash?: boolean }) {
  return <span className="text-muted-foreground">{dash ? "—" : "Unknown"}</span>;
}
