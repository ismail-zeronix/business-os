"use client";

import { RefreshCw } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { getEmailSyncStatusAction, syncEmailAccountAction } from "../actions";

const POLL_MS = 2_000;
const POLL_TIMEOUT_MS = 5 * 60_000; // safety net only: a run this long means something is stuck, not that it is still healthy

type SyncActionState = Awaited<ReturnType<typeof syncEmailAccountAction>>;
type Shown = { text: string; tone: "ok" | "error" };

/**
 * "Sync now" for one mailbox. The action itself only claims the account's lease and returns immediately (see
 * `syncEmailAccountAction`); the actual IMAP read keeps running in the background, so this button polls
 * `getEmailSyncStatusAction` until the lease clears and then shows what the account last recorded. "Polling" is
 * derived (whether `shown` has been resolved for the current `state`, tracked by a ref), not a separate piece of
 * state set at the top of the effect: the effect's own body only starts a timer loop, and every `setShown` call
 * inside it happens after at least one `await`, so there is no direct, synchronous setState call in the effect.
 * Exact counts ("14 new messages") are not available for a backgrounded run — only OK/ERROR and the error text are
 * persisted — so new messages themselves are what tells the story (Enquiries > Email refreshes once sync finishes).
 */
export function SyncMailButton({ accountId, label, size = "sm" }: { accountId: string; label?: string; size?: "xs" | "sm" }) {
  const [state, formAction] = useActionState(syncEmailAccountAction, null);
  const [shown, setShown] = useState<Shown | null>(null);
  const resolvedForRef = useRef<SyncActionState | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (!state?.ok) return undefined;

    (async () => {
      const startedAt = Date.now();
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        if (cancelledRef.current) return;
        const status = await getEmailSyncStatusAction(accountId);
        if (cancelledRef.current) return;
        if (!status || !status.syncing) {
          resolvedForRef.current = state;
          if (!status) setShown({ text: "Account not found.", tone: "error" });
          else if (status.lastSyncStatus === "ERROR") setShown({ text: status.lastSyncError ?? "Sync failed.", tone: "error" });
          else setShown({ text: "Sync finished. New messages are in the Email list.", tone: "ok" });
          return;
        }
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          resolvedForRef.current = state;
          setShown({ text: "Still syncing after 5 minutes - check back later.", tone: "error" });
          return;
        }
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-poll only on a new submit (`state` identity)
  }, [state]);

  const polling = Boolean(state?.ok) && resolvedForRef.current !== state;
  const actionError = state && !state.ok ? state.message : null;
  const result = actionError ? { text: actionError, tone: "error" as const } : polling ? null : shown;

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={accountId} />
      <SubmitButton size={size} variant="outline" pendingLabel="Starting..." disabled={polling}>
        <RefreshCw aria-hidden /> {polling ? "Syncing..." : label ? `Sync ${label}` : "Sync now"}
      </SubmitButton>
      {result ? (
        <span role="status" className={result.tone === "error" ? "text-xs text-danger" : "text-xs text-muted-foreground"}>
          {result.text}
        </span>
      ) : null}
    </form>
  );
}
