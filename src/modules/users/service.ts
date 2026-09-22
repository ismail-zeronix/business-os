import { hashPassword } from "../../core/auth/password";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import { ConflictError, InvariantError, NotFoundError, uniqueViolation } from "../../core/errors";
import { assertAdmin } from "../../core/permissions/roles";
import { diffFields, hasChanges } from "../../lib/diff";
import { writeAudit } from "../audit/service";
import type { UserCreateInput, UserPasswordResetInput, UserStatusInput, UserUpdateInput } from "./schemas";

/**
 * User management: admin only (checked here, at the service boundary, as well as on the screens). Users are never deleted: a person
 * who leaves is deactivated and keeps their history. There is always at least one active admin (checked here, and refused by the database).
 */

const EMAIL_TAKEN = "Another user already has that email address.";

async function loadUser(c: ServiceContext, id: string) {
  const user = await c.db.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, status: true } });
  if (!user) throw new NotFoundError("User");
  return user;
}

/** True when `user` is an active admin and nobody else is: they must not be demoted or deactivated. */
async function isLastActiveAdmin(c: ServiceContext, user: { id: string; role: string; status: string }): Promise<boolean> {
  if (user.role !== "ADMIN" || user.status !== "ACTIVE") return false;
  return (await c.db.user.count({ where: { id: { not: user.id }, role: "ADMIN", status: "ACTIVE" } })) === 0;
}

export async function createUser(ctx: ServiceContext, input: UserCreateInput) {
  assertAdmin(ctx);
  const passwordHash = await hashPassword(input.password);
  return inTransaction(ctx, async (c) => {
    const user = await c.db.user
      .create({ data: { name: input.name, email: input.email, role: input.role, passwordHash } })
      .catch((error: unknown) => {
        if (uniqueViolation(error)) throw new ConflictError(EMAIL_TAKEN, { email: "Already in use" });
        throw error;
      });
    await writeAudit(c, { action: "user.created", entityType: "User", entityId: user.id, details: { name: user.name, email: user.email, role: user.role } });
    return { id: user.id };
  });
}

export async function updateUser(ctx: ServiceContext, input: UserUpdateInput) {
  assertAdmin(ctx);
  return inTransaction(ctx, async (c) => {
    const before = await loadUser(c, input.id);
    if (input.role !== before.role) {
      if (before.id === ctx.actor.id) throw new InvariantError("You cannot change your own role. Ask another admin.");
      if (input.role !== "ADMIN" && (await isLastActiveAdmin(c, before))) throw new InvariantError("This is the last active admin. Make someone else an admin first.");
    }
    const changes = diffFields(before, { name: input.name, email: input.email, role: input.role }, ["name", "email", "role"]);
    if (!hasChanges(changes)) return { id: before.id };

    await c.db.user.update({ where: { id: before.id }, data: { name: input.name, email: input.email, role: input.role } }).catch((error: unknown) => {
      if (uniqueViolation(error)) throw new ConflictError(EMAIL_TAKEN, { email: "Already in use" });
      throw error;
    });
    await writeAudit(c, { action: "user.updated", entityType: "User", entityId: before.id, details: changes });
    return { id: before.id };
  });
}

/** An admin sets a new password for someone else. That person's sessions end, and a locked account is unlocked. */
export async function resetUserPassword(ctx: ServiceContext, input: UserPasswordResetInput) {
  assertAdmin(ctx);
  const passwordHash = await hashPassword(input.password);
  return inTransaction(ctx, async (c) => {
    const user = await loadUser(c, input.id);
    await c.db.user.update({ where: { id: user.id }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } });
    await c.db.session.deleteMany({ where: { userId: user.id } });
    await writeAudit(c, { action: "user.password_reset", entityType: "User", entityId: user.id, details: { user: user.email } });
    return { id: user.id };
  });
}

export async function setUserStatus(ctx: ServiceContext, input: UserStatusInput) {
  assertAdmin(ctx);
  return inTransaction(ctx, async (c) => {
    const user = await loadUser(c, input.id);
    if (user.status === input.status) return { id: user.id };
    if (input.status === "INACTIVE") {
      if (user.id === ctx.actor.id) throw new InvariantError("You cannot deactivate yourself. Ask another admin.");
      if (await isLastActiveAdmin(c, user)) throw new InvariantError("This is the last active admin. Make someone else an admin first.");
    }
    await c.db.user.update({ where: { id: user.id }, data: { status: input.status } });
    if (input.status === "INACTIVE") await c.db.session.deleteMany({ where: { userId: user.id } });
    await writeAudit(c, { action: "user.status_changed", entityType: "User", entityId: user.id, details: { status: { from: user.status, to: input.status }, user: user.email } });
    return { id: user.id };
  });
}
