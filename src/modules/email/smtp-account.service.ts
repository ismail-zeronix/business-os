import { ConflictError, InvariantError, NotFoundError, uniqueViolation } from "../../core/errors";
import { assertAdmin } from "../../core/permissions/roles";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { decryptSecret, encryptSecret, isSecretKeyConfigured } from "../../core/security/secret-box";
import { diffFields, hasChanges } from "../../lib/diff";
import { writeAudit } from "../audit/service";
import { sendSmtpMail } from "./smtp";
import type { SmtpAccountCreateInput, SmtpAccountStatusInput, SmtpAccountTestInput, SmtpAccountUpdateInput } from "./smtp.schemas";

/**
 * Outgoing mailbox management. Admin only. SECURITY (docs/decisions/0005-email-account-secrets.md): the password is encrypted before it is
 * stored, is never returned by any query, and never appears in audit details, errors or logs; audit records only THAT a password changed.
 * One account is active at a time (the database enforces it): activating one deactivates the current one.
 */

const requireKey = () => {
  if (!isSecretKeyConfigured()) throw new InvariantError("APP_SECRET_KEY is not set, so passwords cannot be stored safely. Add it to .env (see .env.example) and restart.");
};

/** Fields whose changes are audited. `password` is deliberately not one of them. */
const FIELDS = ["label", "host", "port", "security", "username", "fromName", "fromAddress", "replyTo", "defaultBcc"] as const;

/** Makes room for `keepId` to be the active account. */
async function deactivateOthers(c: ServiceContext, keepId: string | null) {
  const others = await c.db.smtpAccount.findMany({ where: { status: "ACTIVE", ...(keepId ? { id: { not: keepId } } : {}) }, select: { id: true, label: true } });
  for (const other of others) {
    await c.db.smtpAccount.update({ where: { id: other.id }, data: { status: "INACTIVE" } });
    await writeAudit(c, { action: "smtp_account.status_changed", entityType: "SmtpAccount", entityId: other.id, details: { status: { from: "ACTIVE", to: "INACTIVE" }, reason: "another account was activated" } });
  }
}

export async function createSmtpAccount(ctx: ServiceContext, input: SmtpAccountCreateInput) {
  assertAdmin(ctx);
  requireKey();
  const { copyLoginFromAccountId, password, username, ...profile } = input;
  try {
    return await inTransaction(ctx, async (c) => {
      let login: { username: string; passwordEncrypted: string };
      if (copyLoginFromAccountId) {
        // The encrypted password is copied as it is: it is never decrypted, shown or sent to the browser.
        const source = await c.db.emailAccount.findUnique({ where: { id: copyLoginFromAccountId }, select: { username: true, passwordEncrypted: true } });
        if (!source) throw new NotFoundError("Mailbox");
        login = { username: source.username, passwordEncrypted: source.passwordEncrypted };
      } else {
        login = { username: username as string, passwordEncrypted: encryptSecret(password as string) };
      }

      await deactivateOthers(c, null);
      const account = await c.db.smtpAccount.create({ data: { ...profile, ...login, createdById: ctx.actor.id }, select: { id: true, label: true } });
      await writeAudit(c, {
        action: "smtp_account.created",
        entityType: "SmtpAccount",
        entityId: account.id,
        details: { label: profile.label, host: profile.host, port: profile.port, security: profile.security, username: login.username, from: profile.fromAddress, loginCopiedFromIncomingMailbox: Boolean(copyLoginFromAccountId) },
      });
      return account;
    });
  } catch (error) {
    if (uniqueViolation(error)) throw new ConflictError("Another outgoing account is already active. Try again.");
    throw error;
  }
}

export async function updateSmtpAccount(ctx: ServiceContext, input: SmtpAccountUpdateInput) {
  assertAdmin(ctx);
  const { id, password, ...profile } = input;
  if (password !== undefined) requireKey();
  return inTransaction(ctx, async (c) => {
    // Explicit select: the encrypted password is never loaded here.
    const existing = await c.db.smtpAccount.findUnique({ where: { id }, select: { id: true, label: true, host: true, port: true, security: true, username: true, fromName: true, fromAddress: true, replyTo: true, defaultBcc: true } });
    if (!existing) throw new NotFoundError("Outgoing account");
    const changes = diffFields(existing, profile, FIELDS);
    if (!hasChanges(changes) && password === undefined) return { id };

    await c.db.smtpAccount.update({ where: { id }, data: { ...profile, ...(password !== undefined ? { passwordEncrypted: encryptSecret(password) } : {}) } });
    if (hasChanges(changes)) await writeAudit(c, { action: "smtp_account.updated", entityType: "SmtpAccount", entityId: id, details: changes });
    if (password !== undefined) await writeAudit(c, { action: "smtp_account.password_changed", entityType: "SmtpAccount", entityId: id });
    return { id };
  });
}

export async function setSmtpAccountStatus(ctx: ServiceContext, input: SmtpAccountStatusInput) {
  assertAdmin(ctx);
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.smtpAccount.findUnique({ where: { id: input.id }, select: { id: true, status: true } });
    if (!existing) throw new NotFoundError("Outgoing account");
    if (existing.status === input.status) return { id: existing.id };
    if (input.status === "ACTIVE") await deactivateOthers(c, existing.id);
    await c.db.smtpAccount.update({ where: { id: existing.id }, data: { status: input.status } });
    await writeAudit(c, { action: "smtp_account.status_changed", entityType: "SmtpAccount", entityId: existing.id, details: { status: { from: existing.status, to: input.status } } });
    return { id: existing.id };
  });
}

/** Sends a short test message to an address the admin types, and records how it went. Nothing else is sent. */
export async function testSmtpAccount(ctx: ServiceContext, input: SmtpAccountTestInput) {
  assertAdmin(ctx);
  requireKey();
  const account = await ctx.db.smtpAccount.findUnique({ where: { id: input.id } });
  if (!account) throw new NotFoundError("Outgoing account");

  const result = await sendSmtpMail(
    { host: account.host, port: account.port, security: account.security, username: account.username, password: decryptSecret(account.passwordEncrypted) },
    {
      from: `"${account.fromName.replace(/"/g, "")}" <${account.fromAddress}>`,
      replyTo: account.replyTo,
      to: [input.to],
      cc: [],
      bcc: [],
      subject: "Test message from Business OS",
      text: `This is a test message from Business OS, sent from the outgoing account "${account.label}".\n\nIf you can read this, quotations can be emailed from this account.`,
      attachment: null,
    },
  );

  await inTransaction(ctx, async (c) => {
    await c.db.smtpAccount.update({ where: { id: account.id }, data: { lastTestAt: new Date(), lastTestStatus: result.ok ? "OK" : "ERROR", lastTestError: result.ok ? null : result.message } });
    await writeAudit(c, { action: "smtp_account.tested", entityType: "SmtpAccount", entityId: account.id, details: { to: input.to, result: result.ok ? "sent" : result.message } });
  });
  return result.ok ? { ok: true as const } : { ok: false as const, message: result.message };
}
