"use client";

import { CheckCheck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { archiveBroadcastAction, confirmReadyItemsAction, ignoreItemAction, reopenItemAction } from "../actions";

/** Ignore an item that is not relevant (small popover with an optional reason; nothing is deleted). */
export function IgnoreControl({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(ignoreItemAction, null);
  useActionFeedback(state, () => setOpen(false));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          Ignore item
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <p className="text-xs text-muted-foreground">Mark this line as not relevant. It stays in the record and can be reopened.</p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="id" value={itemId} />
          <Input name="reason" placeholder="Reason (optional)" aria-label="Reason" />
          <FormMessage state={state} />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingLabel="Ignoring...">
              Ignore
            </SubmitButton>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Reopen a confirmed or ignored item. Reopening a CONFIRMED item retracts its observations (kept, struck-through in history). */
export function ReopenControl({ itemId, confirmed }: { itemId: string; confirmed: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(reopenItemAction, null);
  useActionFeedback(state, () => setOpen(false));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Reopen
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2">
        <p className="text-xs text-muted-foreground">
          {confirmed
            ? "This retracts the price and stock observations created from this item. They stay in the history, marked retracted, and are excluded from the latest values."
            : "This puts the item back into review."}
        </p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="id" value={itemId} />
          <Input name="reason" placeholder={confirmed ? "Why is it being corrected?" : "Reason (optional)"} aria-label="Reason" />
          <FormMessage state={state} />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingLabel="Reopening...">
              Reopen item
            </SubmitButton>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/**
 * "Confirm N ready items": confirms every pending item that already has a linked ACTIVE product in one click. A missing price
 * stays unknown; a price with no currency is recorded in AED; an item with no price or stock is recorded as Available. Items
 * that are not ready (no link, or an archived-product link) are never touched and stay in the one-by-one review flow.
 */
export function ConfirmReadyControl({ broadcastId, readyCount, keepQuery }: { broadcastId: string; readyCount: number; keepQuery: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [state, formAction] = useActionState(confirmReadyItemsAction, null);

  useActionFeedback(state, (summary) => {
    setOpen(false);
    if (summary.failed.length > 0) {
      toast.warning(`Confirmed ${summary.confirmedCount} of ${summary.readyCount} ready item${summary.readyCount === 1 ? "" : "s"}. ${summary.failed.length} left pending — see Activity.`);
    } else {
      toast.success(`Confirmed ${summary.confirmedCount} item${summary.confirmedCount === 1 ? "" : "s"}`);
    }
    // Every remaining PENDING item is, by definition, one that was not ready: drop ?item= so the page falls back to it.
    router.replace(`${pathname}${keepQuery ? `?${keepQuery}` : ""}`);
  });

  if (readyCount === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <CheckCheck aria-hidden /> Confirm {readyCount} ready {readyCount === 1 ? "item" : "items"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2">
        <p className="text-xs text-muted-foreground">
          Confirms every pending item already linked to an active product. A missing price stays unknown; a price with no
          currency is recorded in AED; an item with no price or stock is recorded as Available (listed, count unknown). Items
          that are not ready are left for individual review.
        </p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="id" value={broadcastId} />
          <FormMessage state={state} />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingLabel="Confirming...">
              Confirm {readyCount} {readyCount === 1 ? "item" : "items"}
            </SubmitButton>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Archive or restore a whole broadcast. Its evidence and observations stay; it is only hidden from the working lists. */
export function ArchiveBroadcastControl({ broadcastId, archived }: { broadcastId: string; archived: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(archiveBroadcastAction, null);
  useActionFeedback(state, () => setOpen(false));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {archived ? "Restore" : "Archive"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <p className="text-xs text-muted-foreground">
          {archived ? "Bring this broadcast back into the working lists." : "Hide this broadcast from the working lists. The original message and any observations are kept."}
        </p>
        <FormMessage state={state} />
        <form action={formAction} className="flex justify-end">
          <input type="hidden" name="id" value={broadcastId} />
          {archived ? null : <input type="hidden" name="archived" value="on" />}
          <SubmitButton size="sm" pendingLabel="Saving...">
            {archived ? "Restore broadcast" : "Archive broadcast"}
          </SubmitButton>
        </form>
      </PopoverContent>
    </Popover>
  );
}
