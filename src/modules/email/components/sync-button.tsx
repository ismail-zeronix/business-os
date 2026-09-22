"use client";

import { RefreshCw } from "lucide-react";
import { useActionState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import type { ActionResult } from "@/core/validation/action-result";
import { syncEmailAccountAction } from "../actions";
import type { SyncResult } from "../sync.service";

function describe(state: ActionResult<SyncResult> | null): { text: string; tone: "ok" | "error" } | null {
  if (!state) return null;
  if (!state.ok) return { text: state.message, tone: "error" };
  const { ingested, remaining, error } = state.data;
  const stored = ingested === 0 ? "No new messages" : `${ingested} new ${ingested === 1 ? "message" : "messages"}`;
  if (error) return { text: `${ingested > 0 ? `${stored}, then stopped: ` : ""}${error}`, tone: "error" };
  return { text: remaining ? `${stored}. More are waiting: sync again.` : stored, tone: "ok" };
}

/**
 * "Sync now" for one mailbox. Reads new mail read-only and stores it for triage; it never creates an enquiry. The result (or a short,
 * sanitised error) is shown next to the button. The sync can take a while for a first run, so the button shows it is working.
 */
export function SyncMailButton({ accountId, label, size = "sm" }: { accountId: string; label?: string; size?: "xs" | "sm" }) {
  const [state, formAction] = useActionState(syncEmailAccountAction, null);
  const result = describe(state);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={accountId} />
      <SubmitButton size={size} variant="outline" pendingLabel="Syncing...">
        <RefreshCw aria-hidden /> {label ? `Sync ${label}` : "Sync now"}
      </SubmitButton>
      {result ? (
        <span role="status" className={result.tone === "error" ? "text-xs text-danger" : "text-xs text-muted-foreground"}>
          {result.text}
        </span>
      ) : null}
    </form>
  );
}
