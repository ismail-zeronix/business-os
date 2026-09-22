"use client";

import { useRef, useState, type ComponentProps, type KeyboardEvent } from "react";
import type { SelectOption } from "@/components/forms/multi-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CONTACT_LABELS, SUPPLIER_LABELS } from "../parsing/header-lines";

export type MentionContact = SelectOption & { supplierId: string; name: string };

type Mention = { start: number; query: string; kind: "supplier" | "contact" };
type Choice = { id: string; text: string; hint?: string };

const MAX_CHOICES = 8;
const POPUP_WIDTH = 320;

/**
 * Where an @ mention is being typed, if one is. Mentions only work where they cannot be mistaken for something else in a price list:
 * after "SUPPLIER :" / "COMPANY :" (pick a supplier), after "CONTACT :" / "ATTN :" (pick one of that supplier's contacts), or at the very start
 * of a line. An "@" in "Dell 5440 @ 2450", or in an email address, is left alone.
 */
function findMention(text: string, caret: number): Mention | null {
  const lineStart = text.lastIndexOf("\n", caret - 1) + 1;
  const line = text.slice(lineStart, caret);
  const at = line.lastIndexOf("@");
  if (at < 0) return null;
  const query = line.slice(at + 1);
  if (query.length > 40 || /^[\s\d]/.test(query)) return null;
  const label = line.slice(0, at);
  if (new RegExp(`^\\s*(?:${SUPPLIER_LABELS})\\b[^@]*$`, "i").test(label)) return { start: lineStart + at, query, kind: "supplier" };
  if (new RegExp(`^\\s*(?:${CONTACT_LABELS})\\b[^@]*$`, "i").test(label)) return { start: lineStart + at, query, kind: "contact" };
  if (label.trim() === "") return { start: lineStart + at, query, kind: "supplier" };
  return null;
}

const MIRROR_STYLES = [
  "box-sizing", "width", "height", "overflow-x", "overflow-y", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "padding-top", "padding-right", "padding-bottom", "padding-left", "font-style", "font-variant", "font-weight", "font-stretch", "font-size",
  "line-height", "font-family", "text-align", "text-transform", "text-indent", "letter-spacing", "word-spacing", "tab-size",
] as const;

/** Pixel position of a character inside a textarea (a hidden mirror element with the same text and styles is measured). */
function caretOffset(el: HTMLTextAreaElement, index: number): { top: number; left: number; lineHeight: number } {
  const style = getComputedStyle(el);
  const mirror = document.createElement("div");
  for (const property of MIRROR_STYLES) mirror.style.setProperty(property, style.getPropertyValue(property));
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.textContent = el.value.slice(0, index);
  const marker = document.createElement("span");
  marker.textContent = el.value.slice(index) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.3;
  const result = {
    top: marker.offsetTop + Number.parseFloat(style.borderTopWidth) - el.scrollTop,
    left: marker.offsetLeft + Number.parseFloat(style.borderLeftWidth) - el.scrollLeft,
    lineHeight,
  };
  document.body.removeChild(mirror);
  return result;
}

/**
 * The supplier message box with @ mentions. Type "@" after "SUPPLIER :" and the suppliers list narrows with every letter; after "CONTACT :" it
 * lists the chosen supplier's contacts. Picking one writes the name into the text and sets the Supplier / Contact field of the form (the
 * text stays exactly what is typed and pasted: it is the evidence). Arrow keys move, Enter or Tab picks, Escape closes.
 */
export function MentionTextarea({
  value,
  onChange,
  suppliers,
  contacts,
  supplierId,
  supplierName,
  onPickSupplier,
  onPickContact,
  className,
  ...props
}: Omit<ComponentProps<"textarea">, "value" | "onChange"> & {
  value: string;
  onChange: (text: string) => void;
  suppliers: SelectOption[];
  contacts: MentionContact[];
  supplierId: string | null;
  supplierName: string | null;
  onPickSupplier: (supplierId: string) => void;
  onPickContact: (contactId: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<Mention | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [active, setActive] = useState(0);

  const query = mention?.query.trim().toLowerCase() ?? "";
  const pool: Choice[] =
    mention?.kind === "supplier"
      ? suppliers.map((s) => ({ id: s.value, text: s.label }))
      : mention?.kind === "contact" && supplierId
        ? contacts.filter((c) => c.supplierId === supplierId).map((c) => ({ id: c.value, text: c.name, hint: c.label !== c.name ? c.label : undefined }))
        : [];
  const choices = pool
    .filter((choice) => choice.text.toLowerCase().includes(query))
    .sort((a, b) => Number(b.text.toLowerCase().startsWith(query)) - Number(a.text.toLowerCase().startsWith(query)) || a.text.localeCompare(b.text))
    .slice(0, MAX_CHOICES);

  function refresh(el: HTMLTextAreaElement) {
    const next = findMention(el.value, el.selectionStart);
    setMention(next);
    setActive(0);
    if (next) {
      const at = caretOffset(el, next.start);
      setPos({ top: at.top + at.lineHeight + 4, left: Math.max(0, Math.min(at.left, el.clientWidth - POPUP_WIDTH)) });
    }
  }

  function pick(choice: Choice) {
    const el = ref.current;
    if (!el || !mention) return;
    onChange(value.slice(0, mention.start) + choice.text + value.slice(el.selectionStart));
    if (mention.kind === "supplier") onPickSupplier(choice.id);
    else onPickContact(choice.id);
    setMention(null);
    const caret = mention.start + choice.text.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!mention) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setMention(null);
    } else if (choices.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setActive((current) => (current + (event.key === "ArrowDown" ? 1 : choices.length - 1)) % choices.length);
    } else if (choices.length > 0 && (event.key === "Enter" || event.key === "Tab")) {
      event.preventDefault();
      pick(choices[active] ?? (choices[0] as Choice));
    }
  }

  const listId = `${props.id ?? "mention"}-list`;
  const emptyMessage =
    mention?.kind === "contact" && !supplierId ? "Choose the supplier first (type @ after SUPPLIER :)." : mention?.kind === "contact" ? `No contact of ${supplierName ?? "this supplier"} matches.` : "No supplier matches.";

  return (
    <div className="relative">
      <Textarea
        {...props}
        ref={ref}
        value={value}
        className={className}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={Boolean(mention)}
        aria-controls={mention ? listId : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          refresh(event.target);
        }}
        onClick={(event) => refresh(event.currentTarget)}
        onKeyDown={onKeyDown}
        onKeyUp={(event) => {
          // These keys are handled on key down (move, pick, close). Re-reading the caret here would reopen a list that Escape just closed.
          if (["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"].includes(event.key)) return;
          refresh(event.currentTarget);
        }}
        onBlur={() => setMention(null)}
      />
      {mention ? (
        <div
          id={listId}
          role="listbox"
          aria-label={mention.kind === "supplier" ? "Suppliers" : "Contacts"}
          style={{ top: pos.top, left: pos.left, width: POPUP_WIDTH }}
          className="absolute z-30 max-h-64 overflow-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <p className="px-2 py-1 text-[11px] text-muted-foreground">
            {mention.kind === "supplier" ? "Supplier" : `Contact${supplierName ? ` of ${supplierName}` : ""}`}
            {mention.query ? ` · “${mention.query}”` : " · type to filter"}
          </p>
          {choices.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">{emptyMessage}</p>
          ) : (
            choices.map((choice, index) => (
              <div
                key={choice.id}
                role="option"
                aria-selected={index === active}
                // mouse down (not click) so the textarea keeps focus and the caret position
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(choice);
                }}
                onMouseEnter={() => setActive(index)}
                className={cn("cursor-pointer rounded-md px-2 py-1.5 text-xs", index === active && "bg-accent text-accent-foreground")}
              >
                <span className="font-medium">{choice.text}</span>
                {choice.hint ? <span className="ml-1.5 text-muted-foreground">{choice.hint.replace(`${choice.text} · `, "")}</span> : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
