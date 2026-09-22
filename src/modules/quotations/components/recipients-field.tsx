"use client";

import { X } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

const EMAIL = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]+$/;

type Suggestion = { email: string; name: string };

/**
 * Email addresses as chips. Type or paste addresses and press Enter, comma, semicolon or space (or leave the field) to add them; a wrong
 * one stays in the box with a message instead of becoming a chip. Suggested people (the customer's contacts) are one click. Each chip is a
 * hidden field named `name`, so the form sends them as a list.
 */
export function RecipientsField({ name, label, initial, suggestions = [], error, autoFocus = false }: { name: string; label: string; initial: string[]; suggestions?: Suggestion[]; error?: string; autoFocus?: boolean }) {
  const id = useId();
  const [items, setItems] = useState<string[]>(initial);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  function add(raw: string) {
    const parts = raw.split(/[\s,;]+/).map((part) => part.trim().toLowerCase()).filter(Boolean);
    const bad = parts.find((part) => !EMAIL.test(part));
    if (bad) {
      setProblem(`"${bad}" is not a valid email address.`);
      return;
    }
    setProblem(null);
    setItems((current) => [...new Set([...current, ...parts])]);
    setText("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (["Enter", ",", ";", " "].includes(event.key) && text.trim()) {
      event.preventDefault();
      add(text);
    } else if (event.key === "Backspace" && !text && items.length) {
      setItems((current) => current.slice(0, -1));
    }
  }

  const unused = suggestions.filter((s) => !items.includes(s.email));

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <div className={cn("flex min-h-8 flex-wrap items-center gap-1 rounded-lg border bg-background px-1.5 py-1 focus-within:ring-2 focus-within:ring-ring/40", (error || problem) && "border-danger")}>
        {items.map((email) => (
          <span key={email} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs">
            {email}
            <button type="button" onClick={() => setItems((current) => current.filter((item) => item !== email))} aria-label={`Remove ${email}`} className="text-muted-foreground hover:text-foreground">
              <X className="size-3" aria-hidden />
            </button>
            <input type="hidden" name={name} value={email} />
          </span>
        ))}
        <input
          id={id}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => text.trim() && add(text)}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text");
            if (/[\s,;]/.test(pasted.trim())) {
              event.preventDefault();
              add(pasted);
            }
          }}
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder={items.length ? "" : "name@company.com"}
          aria-invalid={Boolean(error || problem)}
          className="min-w-32 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
        />
      </div>
      {unused.length ? (
        <div className="flex flex-wrap gap-1">
          {unused.map((s) => (
            <button key={s.email} type="button" onClick={() => add(s.email)} className="rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-surface hover:text-foreground" title={s.email}>
              + {s.name}
            </button>
          ))}
        </div>
      ) : null}
      {problem || error ? (
        <p role="alert" className="text-xs text-danger">
          {problem ?? error}
        </p>
      ) : null}
    </div>
  );
}
