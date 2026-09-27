"use server";

import { getServiceContext } from "@/core/permissions/actor";
import { runAction, type ActionResult } from "@/core/validation/action-result";
import { formDataToObject } from "@/core/validation/form-data";
import { listContactNotes, type ContactNoteRow } from "./queries";
import { contactNoteArchiveSchema, contactNoteCreateSchema, contactNoteSearchSchema, contactNoteUpdateSchema } from "./schemas";
import { archiveContactNote, createContactNote, updateContactNote } from "./service";

/**
 * Thin server actions for the dock's contact notes. The panel refreshes its own list after each write, so nothing is revalidated:
 * notes are not shown on any page.
 */
type IdResult = ActionResult<{ id: string }>;

/** Called by the panel when it opens and when the search changes. Checks who is asking before reading. */
export async function listContactNotesAction(q: string): Promise<ActionResult<ContactNoteRow[]>> {
  return runAction(async () => {
    await getServiceContext();
    const input = contactNoteSearchSchema.parse({ q });
    return listContactNotes(input.q);
  });
}

export async function createContactNoteAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = contactNoteCreateSchema.parse(formDataToObject(formData));
      const note = await createContactNote(await getServiceContext(), input);
      return { id: note.id };
    },
    { successMessage: "Note saved", formData },
  );
}

export async function updateContactNoteAction(_prev: IdResult | null, formData: FormData): Promise<IdResult> {
  return runAction(
    async () => {
      const input = contactNoteUpdateSchema.parse(formDataToObject(formData));
      const note = await updateContactNote(await getServiceContext(), input);
      return { id: note.id };
    },
    { successMessage: "Note saved", formData },
  );
}

export async function archiveContactNoteAction(id: string): Promise<IdResult> {
  return runAction(
    async () => {
      const input = contactNoteArchiveSchema.parse({ id });
      await archiveContactNote(await getServiceContext(), input);
      return { id: input.id };
    },
    { successMessage: "Note removed" },
  );
}
