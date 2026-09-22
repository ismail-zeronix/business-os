import { hashPassword, verifyPassword } from "../../core/auth/password";
import { hashToken, LOCK_MINUTES, MAX_FAILED_LOGINS, newSessionToken, sessionExpiry } from "../../core/auth/session";
import { db as sharedDb } from "../../core/database/client";
import { inTransaction, type Db, type ServiceContext } from "../../core/database/tx";
import { ConflictError, UnauthenticatedError, ValidationError } from "../../core/errors";
import { writeAudit } from "../audit/service";
import type { ChangePasswordInput, SetupInput, SignInInput } from "./schemas";

/**
 * Signing in, signing out, first-time setup and changing your own password. Sign-in has no actor yet, so these use the shared database
 * client directly. Every answer to a failed sign-in is the same sentence, whether the email exists or not.
 */

const BAD_CREDENTIALS = "Email or password is not correct, or the account is temporarily locked.";
/** Any 64-bit constant: it serialises first-time setup so two people cannot both become the admin. */
const SETUP_LOCK = 4815162342;

type SessionGrant = { token: string; expiresAt: Date };

/** Runs `work` in a transaction on `database`, or straight on it when it already is one (so the functions below can run inside a caller's transaction). */
function withTransaction<T>(database: Db, work: (tx: Parameters<Parameters<typeof sharedDb.$transaction>[0]>[0]) => Promise<T>, options?: { timeout: number }): Promise<T> {
  return "$transaction" in database ? database.$transaction(work, options) : work(database as Parameters<Parameters<typeof sharedDb.$transaction>[0]>[0]);
}

export async function signIn(input: Pick<SignInInput, "email" | "password">, db: Db = sharedDb): Promise<SessionGrant> {
  const now = new Date();
  const user = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, name: true, role: true, status: true, passwordHash: true, lockedUntil: true },
  });
  const usable = Boolean(user && user.status === "ACTIVE" && user.passwordHash);
  const locked = Boolean(user?.lockedUntil && user.lockedUntil > now);
  // The hashing work is always done, so the time a failure takes does not show whether the email exists or the account is locked.
  const correct = await verifyPassword(input.password, usable && !locked ? (user?.passwordHash ?? null) : null);

  if (!user || !usable || locked || !correct) {
    if (user && usable && !locked) await registerFailure(db, user.id);
    throw new UnauthenticatedError(BAD_CREDENTIALS);
  }

  const token = newSessionToken();
  const expiresAt = sessionExpiry(now);
  await withTransaction(db, async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now } });
    await tx.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: now } } }); // tidy up this person's ended sessions
    await tx.session.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt } });
    await writeAudit({ actor: { id: user.id, email: user.email, name: user.name, role: user.role }, db: tx }, { action: "user.signed_in", entityType: "User", entityId: user.id });
  });
  return { token, expiresAt };
}

/** A wrong password: count it, and lock the account after too many in a row. */
async function registerFailure(db: Db, userId: string): Promise<void> {
  const { failedLoginCount } = await db.user.update({ where: { id: userId }, data: { failedLoginCount: { increment: 1 } }, select: { failedLoginCount: true } });
  if (failedLoginCount >= MAX_FAILED_LOGINS) {
    await db.user.update({ where: { id: userId }, data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } });
  }
}

export async function signOut(token: string, db: Db = sharedDb): Promise<void> {
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/**
 * First-time setup: the existing (development) user becomes the admin, with a name, email and password, so every earlier record stays
 * attributed to the same person. Allowed only while no active admin has a password. Signs the person in.
 */
export async function setupFirstAdmin(input: Pick<SetupInput, "name" | "email" | "password">, db: Db = sharedDb): Promise<SessionGrant> {
  const hash = await hashPassword(input.password);
  const token = newSessionToken();
  const expiresAt = sessionExpiry();

  await withTransaction(
    db,
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SETUP_LOCK})`;
      if ((await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE", passwordHash: { not: null } } })) > 0) {
        throw new ConflictError("Sign-in is already set up. Please sign in.");
      }
      const first = await tx.user.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { id: true, email: true, name: true, role: true } });
      const clash = await tx.user.findUnique({ where: { email: input.email }, select: { id: true } });
      if (clash && clash.id !== first?.id) throw new ConflictError("Another user already has that email address.", { email: "Already in use" });

      const data = { name: input.name, email: input.email, passwordHash: hash, role: "ADMIN" as const, failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() };
      const user = first ? await tx.user.update({ where: { id: first.id }, data }) : await tx.user.create({ data });
      await tx.session.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt } });
      const actor = { id: user.id, email: user.email, name: user.name, role: user.role };
      await writeAudit({ actor, db: tx }, { action: first ? "user.updated" : "user.created", entityType: "User", entityId: user.id, details: { setup: "first admin", name: { from: first?.name ?? null, to: user.name }, email: { from: first?.email ?? null, to: user.email }, role: { from: first?.role ?? null, to: "ADMIN" } } });
      await writeAudit({ actor, db: tx }, { action: "user.signed_in", entityType: "User", entityId: user.id });
    },
    { timeout: 20_000 },
  );
  return { token, expiresAt };
}

/** Your own password: the current one is required. Your other sessions end; the one you are using stays. */
export async function changeOwnPassword(ctx: ServiceContext, input: Pick<ChangePasswordInput, "currentPassword" | "newPassword">, keepToken: string | null) {
  const me = await ctx.db.user.findUniqueOrThrow({ where: { id: ctx.actor.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(input.currentPassword, me.passwordHash))) {
    throw new ValidationError("That is not your current password.", { currentPassword: "Not correct" });
  }
  const hash = await hashPassword(input.newPassword);
  return inTransaction(ctx, async (c) => {
    await c.db.user.update({ where: { id: ctx.actor.id }, data: { passwordHash: hash } });
    await c.db.session.deleteMany({ where: { userId: ctx.actor.id, ...(keepToken ? { tokenHash: { not: hashToken(keepToken) } } : {}) } });
    await writeAudit(c, { action: "user.password_changed", entityType: "User", entityId: ctx.actor.id });
  });
}
