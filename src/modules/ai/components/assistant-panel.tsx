"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/application/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { EnquiryChat } from "./use-enquiry-chat";

const GREETING = "Tell me about the customer's request: what they need, how many, and by when. I will ask about anything missing.";

/** A suggestion or quick reply. Same 24px pill shape as the rest of the app, but a button. */
function Pill({ children, onClick, disabled }: { children: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-6 items-center rounded-full bg-muted px-3 text-xs text-foreground/80 transition-colors outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: string }) {
  return (
    <div className={cn("flex", role === "user" && "justify-end")}>
      <p className={cn("max-w-[88%] rounded-lg px-3 py-2 text-[13px] whitespace-pre-wrap", role === "user" ? "bg-primary/15 text-foreground" : "border bg-surface")}>{children}</p>
    </div>
  );
}

export function AssistantPanel({ chat, onNavigate }: { chat: EnquiryChat; onNavigate: () => void }) {
  const { messages, turn, created, phase, error, started, send, create, reset, start } = chat;
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = phase === "THINKING";

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, turn, created, phase, error]);

  const submit = () => {
    const text = draft;
    if (!text.trim() || busy) return;
    setDraft("");
    void send(text);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-2">
        {!started && !created ? (
          <div className="flex flex-col items-start gap-3 py-2">
            <p className="text-[13px] text-muted-foreground">Record a customer request by chatting. Nothing is saved until you press Create enquiry draft, and you review every requirement afterwards.</p>
            <Pill
              onClick={() => {
                start();
                inputRef.current?.focus();
              }}
            >
              Start a new enquiry
            </Pill>
          </div>
        ) : null}

        {started ? <Bubble role="assistant">{GREETING}</Bubble> : null}
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role}>
            {m.content}
          </Bubble>
        ))}
        {busy ? <LoadingState label={turn?.summary ? "Saving" : "Thinking"} /> : null}
        {error ? <ErrorState title="That did not work" message={error} /> : null}

        {turn?.status === "READY" && turn.summary && !busy ? (
          <div className="flex flex-col gap-2 rounded-lg border bg-canvas p-3">
            <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Request to save</p>
            <p className="text-[13px] whitespace-pre-wrap">{turn.summary}</p>
            {turn.requesterName || turn.requesterEmail ? (
              <p className="text-xs text-muted-foreground">From {[turn.requesterName, turn.requesterEmail].filter(Boolean).join(" · ")}</p>
            ) : null}
            {turn.missing.length > 0 ? <p className="text-xs text-warning">Not given yet: {turn.missing.join(", ")}</p> : null}
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={() => void create()}>
                Create enquiry draft
              </Button>
              <span className="text-xs text-muted-foreground">Requirements stay pending until you confirm them.</span>
            </div>
          </div>
        ) : null}

        {created ? (
          <div className="flex flex-col gap-2 rounded-lg border bg-canvas p-3">
            <p className="text-[13px]">
              <span className="font-mono">{created.reference}</span> saved with {created.itemCount} {created.itemCount === 1 ? "requirement" : "requirements"} to review.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" asChild>
                <Link href={`/enquiries/${created.enquiryId}`} onClick={onNavigate}>
                  Open enquiry
                </Link>
              </Button>
              <Button size="sm" variant="outline" onClick={reset}>
                <RotateCcw /> Start another
              </Button>
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {!created ? (
        <div className="flex flex-col gap-2 border-t p-3">
          {turn && turn.quickReplies.length > 0 && !busy ? (
            <div className="flex flex-wrap gap-1.5">
              {turn.quickReplies.map((reply) => (
                <Pill key={reply} onClick={() => void send(reply)}>
                  {reply}
                </Pill>
              ))}
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={2}
              maxLength={2000}
              placeholder="Describe the request"
              aria-label="Message to the assistant"
              className="min-h-0 resize-none text-[13px]"
            />
            <Button size="icon" onClick={submit} disabled={busy || !draft.trim()} aria-label="Send">
              <ArrowUp />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
