import { db } from "../../core/database/client";

export type ContactNoteRow = {
  id: string;
  body: string;
  contactName: string | null;
  company: string | null;
  phones: string[];
  emails: string[];
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

/** The dock shows the newest notes; a search narrows them. Plain strings for dates so the list can cross the server-action boundary. */
const LIST_LIMIT = 100;

export async function listContactNotes(q: string): Promise<ContactNoteRow[]> {
  const contains = { contains: q, mode: "insensitive" as const };
  const rows = await db.contactNote.findMany({
    where: {
      status: "ACTIVE",
      ...(q ? { OR: [{ body: contains }, { contactName: contains }, { company: contains }, { description: contains }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    select: { id: true, body: true, contactName: true, company: true, phones: true, emails: true, description: true, createdAt: true, updatedAt: true },
  });
  return rows.map(({ createdAt, updatedAt, ...rest }) => ({ ...rest, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() }));
}
