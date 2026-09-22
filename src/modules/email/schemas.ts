import { z } from "zod";
import { EmailSecurity, RecordStatus } from "../../generated/prisma/enums";
import { requiredText } from "../../core/validation/fields";
import { toZonedInputValue } from "../../lib/format";

const values = <T extends string>(obj: Record<string, T>) => Object.values(obj) as [T, ...T[]];

/** Hostinger's incoming mail server. Pre-filled in the account form; every value stays editable. */
export const HOSTINGER_IMAP_DEFAULTS = { host: "imap.hostinger.com", port: 993, security: "SSL_TLS", folder: "INBOX" } as const;

/** The default "sync messages from" date (a week ago, Dubai calendar date, yyyy-mm-dd), so a first sync never pulls the whole mailbox. */
export function defaultSyncFromInput(now: Date = new Date()): string {
  return toZonedInputValue(new Date(now.getTime() - 7 * 86_400_000)).slice(0, 10);
}

/** Password fields are NOT trimmed: a password may legitimately start or end with a space. */
const password = z.string().min(1, "Enter the mailbox password").max(500, "Password is too long");

const host = z
  .string({ error: "Enter the mail server address" })
  .trim()
  .toLowerCase()
  .min(3, "Enter the mail server address")
  .max(253)
  .regex(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/, "Enter a host name such as imap.example.com");

const port = z.coerce.number({ error: "Enter a port number" }).int("Enter a whole number").min(1, "Port must be 1-65535").max(65535, "Port must be 1-65535");

/** yyyy-mm-dd, a real date, not in the future. Stored as the start of that day in UTC. */
const syncFromDate = z
  .string({ error: "Choose the date to start syncing from" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
  .refine((value) => new Date(`${value}T00:00:00.000Z`).toISOString().startsWith(value), "Enter a valid date")
  .refine((value) => new Date(`${value}T00:00:00.000Z`).getTime() <= Date.now() + 86_400_000, "The date cannot be in the future")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const emailAccountBase = z.object({
  label: requiredText("Label", 100),
  host,
  port,
  security: z.enum(values(EmailSecurity), { error: "Choose SSL/TLS or STARTTLS" }),
  username: requiredText("Username", 254),
  folder: requiredText("Folder", 200),
  syncFromDate,
});

export const emailAccountCreateSchema = emailAccountBase.extend({ password });
/** A blank password on edit means "keep the stored one". */
export const emailAccountUpdateSchema = emailAccountBase.extend({
  id: z.uuid(),
  password: z.preprocess((value) => (value === "" ? undefined : value), password.optional()),
});
/** Test connection: the form as filled in. On an existing account a blank password means "use the stored one". */
export const emailAccountTestSchema = emailAccountBase.omit({ label: true, syncFromDate: true }).extend({
  id: z.preprocess((value) => (value === "" ? undefined : value), z.uuid().optional()),
  password: z.preprocess((value) => (value === "" ? undefined : value), password.optional()),
});
export const emailAccountStatusSchema = z.object({ id: z.uuid(), status: z.enum(RecordStatus) });
export const emailSyncSchema = z.object({ id: z.uuid() });

export type EmailAccountCreateInput = z.output<typeof emailAccountCreateSchema>;
export type EmailAccountUpdateInput = z.output<typeof emailAccountUpdateSchema>;
export type EmailAccountTestInput = z.output<typeof emailAccountTestSchema>;
export type EmailAccountStatusInput = z.output<typeof emailAccountStatusSchema>;

// ── triage ──────────────────────────────────────────────────────────────────────────────────────────────────────
export const emailIdSchema = z.object({ id: z.uuid() });
export const emailDismissSchema = z.object({ id: z.uuid(), reason: requiredText("Reason", 300) });

export type EmailDismissInput = z.output<typeof emailDismissSchema>;
