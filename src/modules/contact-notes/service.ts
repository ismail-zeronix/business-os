import { NotFoundError } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { writeAudit } from "../audit/service";
import type { ContactNoteArchiveInput, ContactNoteCreateInput, ContactNoteUpdateInput } from "./schemas";

const DETAIL_FIELDS = ["body", "contactName", "company", "phones", "emails", "description"] as const;

/** The audit trail records that a note changed (and which fields), not the text: the text is a rough contact detail and is already in the row. */
export async function createContactNote(ctx: ServiceContext, input: ContactNoteCreateInput) {
  return inTransaction(ctx, async (c) => {
    const note = await c.db.contactNote.create({ data: { ...input, createdById: c.actor.id } });
    await writeAudit(c, { action: "contact_note.created", entityType: "ContactNote", entityId: note.id });
    return note;
  });
}

export async function updateContactNote(ctx: ServiceContext, input: ContactNoteUpdateInput) {
  return inTransaction(ctx, async (c) => {
    const { id, ...data } = input;
    const existing = await c.db.contactNote.findUnique({ where: { id } });
    if (!existing || existing.status !== "ACTIVE") throw new NotFoundError("Note");
    const changed = DETAIL_FIELDS.filter((field) => JSON.stringify(existing[field]) !== JSON.stringify(data[field]));
    if (changed.length === 0) return existing;
    const updated = await c.db.contactNote.update({ where: { id }, data });
    await writeAudit(c, { action: "contact_note.updated", entityType: "ContactNote", entityId: id, details: { changed } });
    return updated;
  });
}

/** Removing a note archives it; the row stays. */
export async function archiveContactNote(ctx: ServiceContext, input: ContactNoteArchiveInput) {
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.contactNote.findUnique({ where: { id: input.id }, select: { id: true, status: true } });
    if (!existing) throw new NotFoundError("Note");
    if (existing.status === "ARCHIVED") return existing;
    const archived = await c.db.contactNote.update({ where: { id: input.id }, data: { status: "ARCHIVED" } });
    await writeAudit(c, { action: "contact_note.archived", entityType: "ContactNote", entityId: input.id });
    return archived;
  });
}
