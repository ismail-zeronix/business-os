# Module: Contact notes (right dock)

**Status:** Built (2026-09-27), outside the stabilization steps. Table: `contact_notes` (`prisma/schema.prisma`, migrations `20260927150000_contact_notes`, `20260927160000_contact_note_details`).

A place to paste rough supplier-contact text (a WhatsApp message, a typed business card) without leaving the screen. It is the first tool in the right dock (`src/components/application/right-dock/`).

## Owns
`ContactNote`: `id`, `body` (text exactly as pasted), confirmed details (`contactName`, `company`, `phones[]`, `emails[]`), `description` (typed by a person), `status` (ACTIVE / ARCHIVED), `createdById`, timestamps.

## Rules
- Notes are **free-floating**: no supplier link, and a note never becomes a `SupplierContact` automatically. Turning one into a real contact is a person's job, done by hand on the supplier page.
- **Rules propose, a person confirms.** `extract.ts` (pure rules, no AI) reads phones, emails, name and company from the pasted text and fills the form; the person corrects them before saving, and a field they have touched is never overwritten. Anything the text does not state stays empty. Wrong guesses are cheap to fix; nothing is invented. The description is typed by a person, never generated.
- Text is kept verbatim (only trimmed at the ends; line breaks preserved). Required, at most 5000 characters (zod and a `CHECK` that the text is not blank).
- Notes can be edited; **removing a note archives it** (no hard delete). Archived notes are not listed.
- Notes are shared by everyone who can sign in, not private to the author. `createdById` records who wrote it.
- Search is a case-insensitive "contains" on the text, name, company and description; the panel shows the newest 100 notes. A trigram index is a later change if it gets slow.

## Service functions (`modules/contact-notes/service.ts`, `queries.ts`)
`createContactNote`, `updateContactNote`, `archiveContactNote`; query `listContactNotes(q)`.

## Audit actions
`contact_note.created|updated|archived` (entity `ContactNote`). The audit row records that the change happened, not the text.

## Adding another dock tool
Add an entry to `DOCK_TOOLS` in `right-dock/dock-registry.ts` (`id`, `label`, Lucide `icon`, `Panel` component). The rail, open/close and panel frame need no change. Ideas for tools (quick reference, scratch notes) go to `docs/ideas/BACKLOG.md` until scheduled.
