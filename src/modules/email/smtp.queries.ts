import { db } from "../../core/database/client";

/** Outgoing accounts for the Settings list. The encrypted password is never selected. */
export async function listSmtpAccounts() {
  return db.smtpAccount.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: { id: true, label: true, host: true, port: true, security: true, username: true, fromName: true, fromAddress: true, replyTo: true, defaultBcc: true, status: true, lastTestAt: true, lastTestStatus: true, lastTestError: true, createdAt: true },
  });
}

export type SmtpAccountRow = Awaited<ReturnType<typeof listSmtpAccounts>>[number];

/** The account emails are sent from, or null when none is set up. No secrets. */
export async function getActiveSmtpAccount() {
  return db.smtpAccount.findFirst({ where: { status: "ACTIVE" }, select: { id: true, label: true, fromName: true, fromAddress: true, replyTo: true, defaultBcc: true } });
}
