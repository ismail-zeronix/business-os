"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Building2, Copy, Mail, Pencil, Phone, Plus, Search, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { archiveContactNoteAction, createContactNoteAction, listContactNotesAction, updateContactNoteAction } from "../actions";
import type { ContactNoteRow } from "../queries";
import { ContactNoteForm } from "./contact-note-form";

const THIN_SCROLL = "[scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]";

/**
 * The dock's supplier-contact notes: paste a supplier's message, check the contact details the rules read from it, save, search later.
 * The pasted text is always kept and shown as saved; the details beside it are what a person confirmed.
 */
export function ContactNotesPanel() {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [notes, setNotes] = useState<ContactNoteRow[] | null>(null); // null = loading
  const [loadError, setLoadError] = useState<string | null>(null);
  const latest = useRef(0);

  /** Loads the list for a search. Only the newest request may update the screen, so a slow older one cannot overwrite it. */
  const load = useCallback(async (search: string) => {
    const ticket = ++latest.current;
    const result = await listContactNotesAction(search);
    if (ticket !== latest.current) return;
    if (result.ok) {
      setNotes(result.data);
      setLoadError(null);
    } else {
      setLoadError(result.message);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(q), q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [q, load]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, number" aria-label="Search notes" maxLength={200} className="h-8 pl-8 text-sm" />
        </div>
        <Button type="button" size="sm" variant={adding ? "outline" : "default"} onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
          <Plus /> {adding ? "Hide" : "New"}
        </Button>
      </div>

      {/* Kept mounted while hidden so a half-pasted note is not lost. */}
      <div hidden={!adding} className={`min-h-0 flex-1 overflow-y-auto border-b p-3 ${THIN_SCROLL}`}>
        <ContactNoteForm
          action={createContactNoteAction}
          saveLabel="Save note"
          onDone={() => {
            setAdding(false);
            void load(q);
          }}
        />
      </div>

      <div hidden={adding} className={`min-h-0 flex-1 overflow-y-auto ${THIN_SCROLL}`}>
        {loadError ? (
          <p role="alert" className="px-3 py-4 text-sm text-danger">
            {loadError}
          </p>
        ) : notes === null ? (
          <p role="status" className="px-3 py-4 text-sm text-muted-foreground">
            Loading notes...
          </p>
        ) : notes.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">{q ? "No notes match that search." : "No notes yet. Choose New, paste a supplier's message and save it."}</p>
        ) : (
          <ul className="divide-y">
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} onChanged={() => load(q)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

async function copyText(value: string, onFail: (message: string) => void) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Copied");
  } catch {
    onFail("Could not copy. Select the text and copy it by hand.");
  }
}

function NoteCard({ note, onChanged }: { note: ContactNoteRow; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [removing, startRemoving] = useTransition();
  const [problem, setProblem] = useState<string | null>(null); // errors stay inline, never a toast

  function remove() {
    startRemoving(async () => {
      const result = await archiveContactNoteAction(note.id);
      if (result.ok) {
        toast.success(result.message ?? "Note removed");
        onChanged();
      } else {
        setProblem(result.message);
      }
    });
  }

  if (editing) {
    return (
      <li className="p-3">
        <ContactNoteForm
          id={note.id}
          action={updateContactNoteAction}
          saveLabel="Save"
          initial={{
            body: note.body,
            contactName: note.contactName ?? "",
            company: note.company ?? "",
            phones: note.phones.join(", "),
            emails: note.emails.join(", "),
            description: note.description ?? "",
          }}
          onDone={() => {
            setEditing(false);
            onChanged();
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  const hasDetails = Boolean(note.contactName || note.company || note.phones.length || note.emails.length);
  return (
    <li className="p-3">
      {note.contactName || note.company ? (
        <div className="flex flex-col gap-0.5">
          {note.contactName ? (
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <User aria-hidden className="size-3.5 shrink-0 text-info" strokeWidth={1.75} />
              <span className="min-w-0 break-words">{note.contactName}</span>
            </p>
          ) : null}
          {note.company ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 aria-hidden className="size-3.5 shrink-0 text-warning" strokeWidth={1.75} />
              <span className="min-w-0 break-words">{note.company}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {note.phones.length || note.emails.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {note.phones.map((phone) => (
            <Chip key={phone} icon={<Phone className="text-success" />} value={phone} onFail={setProblem} />
          ))}
          {note.emails.map((email) => (
            <Chip key={email} icon={<Mail className="text-brand" />} value={email} onFail={setProblem} />
          ))}
        </div>
      ) : null}

      {note.description ? <p className="mt-1.5 text-sm break-words">{note.description}</p> : null}

      <details className="group mt-1.5" open={!hasDetails && !note.description}>
        <summary className="cursor-pointer text-xs text-muted-foreground select-none hover:text-foreground">Original text</summary>
        <p className="mt-1 rounded-lg bg-muted/60 px-2.5 py-2 text-sm break-words whitespace-pre-wrap">{note.body}</p>
      </details>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {formatDateTime(new Date(note.createdAt))}
          {note.updatedAt !== note.createdAt ? " (edited)" : ""}
        </span>
        <div className="flex items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon-xs" onClick={() => copyText(note.body, setProblem)} aria-label="Copy original text" title="Copy original text">
            <Copy strokeWidth={1.5} />
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" onClick={() => setEditing(true)} aria-label="Edit note" title="Edit">
            <Pencil strokeWidth={1.5} />
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" onClick={remove} disabled={removing} aria-label="Remove note" title="Remove">
            <Trash2 strokeWidth={1.5} />
          </Button>
        </div>
      </div>
      {problem ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {problem}
        </p>
      ) : null}
    </li>
  );
}

/** A phone number or email as a small pill; a click copies it. */
function Chip({ icon, value, onFail }: { icon: React.ReactNode; value: string; onFail: (message: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => copyText(value, onFail)}
      title="Click to copy"
      className="inline-flex max-w-full items-center gap-1 rounded-full border bg-surface px-2 py-0.5 text-xs transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-3 [&_svg]:shrink-0"
    >
      {icon}
      <span className="truncate">{value}</span>
    </button>
  );
}
