"use client";

import { useState } from "react";
import { Bot, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AssistantPanel } from "./assistant-panel";
import { useEnquiryChat } from "./use-enquiry-chat";

/**
 * The floating assistant (docs/ai-intelligence/floating-chat-ui.md): a thin-bordered button bottom-right and a right-hand panel. For now it does
 * one thing, record a customer request as an enquiry draft, so it offers only that. The dot shows THINKING (slow pulse, none with reduced
 * motion) or ERROR; otherwise the button is static.
 */
export function AssistantLauncher() {
  const [open, setOpen] = useState(false);
  const chat = useEnquiryChat();
  const dot = chat.phase === "THINKING" ? "bg-brand motion-safe:animate-pulse" : chat.phase === "ERROR" ? "bg-danger" : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open the assistant"
        title="Assistant"
        className="fixed right-6 bottom-6 z-40 flex size-11 items-center justify-center rounded-full border bg-surface text-foreground shadow-md transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Bot className="size-5" strokeWidth={1.5} aria-hidden />
        {dot ? <span aria-hidden className={cn("absolute top-0.5 right-0.5 size-2.5 rounded-full ring-2 ring-surface", dot)} /> : null}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>New enquiry</SheetTitle>
            <SheetDescription>Describe a customer request. You review it before anything is confirmed.</SheetDescription>
          </SheetHeader>
          <div className="flex items-center justify-end px-3 pt-2">
            <Button variant="ghost" size="xs" onClick={chat.reset} disabled={chat.phase === "THINKING" || (!chat.started && !chat.created)}>
              <Plus /> New conversation
            </Button>
          </div>
          <AssistantPanel chat={chat} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
