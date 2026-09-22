import { z } from "zod";
import { EmailSecurity, RecordStatus } from "../../generated/prisma/enums";
import { optionalEmail, optionalUuid, requiredText } from "../../core/validation/fields";

const values = <T extends string>(obj: Record<string, T>) => Object.values(obj) as [T, ...T[]];

/** Hostinger's outgoing mail server. Pre-filled in the form; every value stays editable. */
export const HOSTINGER_SMTP_DEFAULTS = { host: "smtp.hostinger.com", port: 465, security: "SSL_TLS" } as const;

/** Password fields are NOT trimmed: a password may legitimately start or end with a space. */
const password = z.string().min(1, "Enter the mailbox password").max(500, "Password is too long");

const host = z
  .string({ error: "Enter the mail server address" })
  .trim()
  .toLowerCase()
  .min(3, "Enter the mail server address")
  .max(253)
  .regex(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/, "Enter a host name such as smtp.example.com");

const port = z.coerce.number({ error: "Enter a port number" }).int("Enter a whole number").min(1, "Port must be 1-65535").max(65535, "Port must be 1-65535");

const profile = {
  label: requiredText("Label", 100),
  host,
  port,
  security: z.enum(values(EmailSecurity), { error: "Choose SSL/TLS or STARTTLS" }),
  fromName: requiredText("From name", 100),
  fromAddress: z.email("Enter a valid email address").max(254).transform((value) => value.toLowerCase()),
  replyTo: optionalEmail(),
  defaultBcc: optionalEmail(),
};

/**
 * A new outgoing account. The login is either typed (username and password) or copied, server-side, from an incoming mailbox the admin
 * already connected (`copyLoginFromAccountId`): the password is then never typed, shown or sent to the browser.
 */
export const smtpAccountCreateSchema = z
  .object({
    ...profile,
    username: z.preprocess((value) => (value === "" ? undefined : value), z.string().trim().max(254).optional()),
    password: z.preprocess((value) => (value === "" ? undefined : value), password.optional()),
    copyLoginFromAccountId: optionalUuid("Choose a valid mailbox"),
  })
  .superRefine((value, ctx) => {
    if (value.copyLoginFromAccountId) return;
    if (!value.username) ctx.addIssue({ code: "custom", path: ["username"], message: "Enter the username" });
    if (!value.password) ctx.addIssue({ code: "custom", path: ["password"], message: "Enter the mailbox password" });
  });

/** A blank password on edit means "keep the stored one". */
export const smtpAccountUpdateSchema = z.object({
  id: z.uuid(),
  ...profile,
  username: requiredText("Username", 254),
  password: z.preprocess((value) => (value === "" ? undefined : value), password.optional()),
});

export const smtpAccountTestSchema = z.object({ id: z.uuid(), to: z.email("Enter the address to send the test to").max(254) });
export const smtpAccountStatusSchema = z.object({ id: z.uuid(), status: z.enum(RecordStatus) });

export type SmtpAccountCreateInput = z.output<typeof smtpAccountCreateSchema>;
export type SmtpAccountUpdateInput = z.output<typeof smtpAccountUpdateSchema>;
export type SmtpAccountTestInput = z.output<typeof smtpAccountTestSchema>;
export type SmtpAccountStatusInput = z.output<typeof smtpAccountStatusSchema>;
