import { z } from "zod";
import { optionalText, requiredText } from "../../core/validation/fields";

/** The pasted text, kept as typed (only trimmed at the ends). Long enough for a pasted WhatsApp thread. */
const NOTE_MAX = 5000;

/** A list typed into one box, separated by commas, semicolons or new lines. Blank entries and repeats are dropped. */
const listText = <T extends z.ZodType<string>>(item: T, max: number) =>
  z
    .preprocess(
      (value) => (typeof value === "string" ? value.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean) : (value ?? [])),
      z.array(item).max(max, `At most ${max} entries`),
    )
    .transform((items) => [...new Set(items)]);

/** The confirmed details beside the pasted text. Every one is optional: unknown stays unknown. */
const detailsShape = {
  contactName: optionalText(100),
  company: optionalText(150),
  phones: listText(z.string().max(30, "Phone number is too long"), 10),
  emails: listText(z.email("Enter valid email addresses").max(254).transform((e) => e.toLowerCase()), 10),
  description: optionalText(200),
};

export const contactNoteCreateSchema = z.object({ body: requiredText("Note", NOTE_MAX), ...detailsShape });
export const contactNoteUpdateSchema = contactNoteCreateSchema.extend({ id: z.uuid() });
export const contactNoteArchiveSchema = z.object({ id: z.uuid() });
export const contactNoteSearchSchema = z.object({ q: z.string().trim().max(200).default("") });

export type ContactNoteCreateInput = z.output<typeof contactNoteCreateSchema>;
export type ContactNoteUpdateInput = z.output<typeof contactNoteUpdateSchema>;
export type ContactNoteArchiveInput = z.output<typeof contactNoteArchiveSchema>;
