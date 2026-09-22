import { ConflictError, InvariantError, NotFoundError, uniqueViolation } from "../../core/errors";
import { assertAdmin } from "../../core/permissions/roles";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { encryptSecret, isSecretKeyConfigured } from "../../core/security/secret-box";
import { diffFields } from "../../lib/diff";
import { writeAudit } from "../audit/service";
import type { EmailAccountCreateInput, EmailAccountStatusInput, EmailAccountUpdateInput } from "./schemas";

/**
 * Mailbox account management. SECURITY (docs/decisions/0005-email-account-secrets.md): the password is encrypted before it is stored,
 * is never returned by any query here, and never appears in audit details, errors or logs. Audit records only THAT a password changed.
 */

/** host|username|folder, lower-cased where mail systems ignore case. Enforces "this mailbox is already connected". */
export const accountKey = (input: { host: string; username: string; folder: string }) => [input.host.toLowerCase(), input.username.toLowerCase(), input.folder].join("|");

const requireKey = () => {
  if (!isSecretKeyConfigured()) throw new InvariantError("APP_SECRET_KEY is not set, so passwords cannot be stored safely. Add it to .env (see .env.example) and restart.");
};

const DUPLICATE = "This mailbox is already connected.";

/** Fields whose changes are audited. `password` is deliberately not one of them. */
const ACCOUNT_FIELDS = ["label", "host", "port", "security", "username", "folder", "syncFromDate"] as const;

export async function createEmailAccount(ctx: ServiceContext, input: EmailAccountCreateInput) {
  assertAdmin(ctx);
  requireKey();
  const { password, ...profile } = input;
  try {
    return await inTransaction(ctx, async (c) => {
      const normalizedKey = accountKey(profile);
      if (await c.db.emailAccount.findUnique({ where: { normalizedKey }, select: { id: true } })) throw new ConflictError(DUPLICATE, { username: "Already connected" });

      const account = await c.db.emailAccount.create({
        data: { ...profile, normalizedKey, passwordEncrypted: encryptSecret(password), createdById: ctx.actor.id },
        select: { id: true, label: true },
      });
      await writeAudit(c, {
        action: "email_account.created",
        entityType: "EmailAccount",
        entityId: account.id,
        details: { label: profile.label, host: profile.host, port: profile.port, security: profile.security, username: profile.username, folder: profile.folder },
      });
      return account;
    });
  } catch (error) {
    if (uniqueViolation(error)) throw new ConflictError(DUPLICATE, { username: "Already connected" });
    throw error;
  }
}

export async function updateEmailAccount(ctx: ServiceContext, input: EmailAccountUpdateInput) {
  assertAdmin(ctx);
  const { id, password, ...profile } = input;
  if (password !== undefined) requireKey();
  try {
    return await inTransaction(ctx, async (c) => {
      // Explicit select: the encrypted password is never loaded here.
      const existing = await c.db.emailAccount.findUnique({
        where: { id },
        select: { id: true, label: true, host: true, port: true, security: true, username: true, folder: true, syncFromDate: true },
      });
      if (!existing) throw new NotFoundError("Email account");

      const normalizedKey = accountKey(profile);
      const clash = await c.db.emailAccount.findUnique({ where: { normalizedKey }, select: { id: true } });
      if (clash && clash.id !== id) throw new ConflictError(DUPLICATE, { username: "Already connected" });

      const changes = diffFields(existing, profile, ACCOUNT_FIELDS);
      const pointsElsewhere = "host" in changes || "username" in changes || "folder" in changes;
      const passwordChanged = password !== undefined;
      if (Object.keys(changes).length === 0 && !passwordChanged) return { id };

      await c.db.emailAccount.update({
        where: { id },
        data: {
          ...profile,
          normalizedKey,
          ...(passwordChanged ? { passwordEncrypted: encryptSecret(password) } : {}),
          // A different mailbox or folder has different UIDs: start again from the sync-from date (duplicates are skipped by Message-ID).
          ...(pointsElsewhere ? { uidValidity: null, lastUid: null } : {}),
        },
        select: { id: true },
      });
      if (Object.keys(changes).length > 0) await writeAudit(c, { action: "email_account.updated", entityType: "EmailAccount", entityId: id, details: changes });
      if (passwordChanged) await writeAudit(c, { action: "email_account.password_changed", entityType: "EmailAccount", entityId: id });
      return { id };
    });
  } catch (error) {
    if (uniqueViolation(error)) throw new ConflictError(DUPLICATE, { username: "Already connected" });
    throw error;
  }
}

/** Deactivate (stop syncing, keep everything), archive or restore. Ingested emails are never deleted. */
export async function setEmailAccountStatus(ctx: ServiceContext, input: EmailAccountStatusInput) {
  assertAdmin(ctx);
  return inTransaction(ctx, async (c) => {
    const existing = await c.db.emailAccount.findUnique({ where: { id: input.id }, select: { id: true, status: true } });
    if (!existing) throw new NotFoundError("Email account");
    if (existing.status === input.status) return existing;
    await c.db.emailAccount.update({ where: { id: input.id }, data: { status: input.status }, select: { id: true } });
    await writeAudit(c, {
      action: "email_account.status_changed",
      entityType: "EmailAccount",
      entityId: input.id,
      details: { status: { from: existing.status, to: input.status } },
    });
    return existing;
  });
}
