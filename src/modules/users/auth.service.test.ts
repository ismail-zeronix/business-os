import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/core/auth/password";
import { hashToken, MAX_FAILED_LOGINS } from "@/core/auth/session";
import type { ServiceContext } from "@/core/database/tx";
import { ConflictError, ForbiddenError, InvariantError, NotFoundError, UnauthenticatedError, ValidationError } from "@/core/errors";
import { createTestContext, resetDatabase, testDb } from "@/test/helpers";
import { changeOwnPassword, setupFirstAdmin, signIn, signOut } from "./auth.service";
import { createUser, resetUserPassword, setUserStatus, updateUser } from "./service";
import { changePasswordSchema, setupSchema, signInSchema, userCreateSchema } from "./schemas";

const PASSWORD = "TEST-correct-horse-1";
const BAD = "Email or password is not correct, or the account is temporarily locked.";

let admin: ServiceContext;

beforeEach(async () => {
  await resetDatabase();
  admin = await createTestContext();
  // The helper's user is a STAFF row by default; make it the real admin its context claims to be.
  await testDb.user.update({ where: { id: admin.actor.id }, data: { role: "ADMIN" } });
});

async function person(over: { email?: string; role?: "ADMIN" | "STAFF"; status?: "ACTIVE" | "INACTIVE"; password?: string | null } = {}) {
  return testDb.user.create({
    data: {
      email: over.email ?? "staff@example.test",
      name: "TEST Person",
      role: over.role ?? "STAFF",
      status: over.status ?? "ACTIVE",
      passwordHash: over.password === null ? null : await hashPassword(over.password ?? PASSWORD),
    },
  });
}
const asStaff = (u: { id: string; email: string; name: string }): ServiceContext => ({ actor: { ...u, role: "STAFF" }, db: admin.db });

describe("schemas", () => {
  it("normalises the sign-in email and does not length-check an old password", () => {
    expect(signInSchema.parse({ email: "  Staff@Example.TEST ", password: "short" })).toMatchObject({ email: "staff@example.test", password: "short" });
    expect(signInSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@x.test", password: "" }).success).toBe(false);
  });
  it("needs a new password of at least 10 characters that is not the email, typed twice the same", () => {
    const base = { name: "TEST", email: "a@x.test", password: "0123456789", confirmPassword: "0123456789" };
    expect(setupSchema.safeParse(base).success).toBe(true);
    expect(setupSchema.safeParse({ ...base, password: "short", confirmPassword: "short" }).success).toBe(false);
    expect(setupSchema.safeParse({ ...base, confirmPassword: "different-1" }).success).toBe(false);
    expect(setupSchema.safeParse({ ...base, email: "abcdefghij@x.test", password: "ABCDEFGHIJ@X.TEST", confirmPassword: "ABCDEFGHIJ@X.TEST" }).success).toBe(false);
    expect(userCreateSchema.safeParse({ name: "T", email: "abcdefghij", role: "STAFF", password: "abcdefghij" }).success).toBe(false);
  });
  it("refuses a change to the same password, and a password over 200 characters", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "same-password-1", newPassword: "same-password-1", confirmPassword: "same-password-1" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "a".repeat(201), confirmPassword: "a".repeat(201) }).success).toBe(false);
  });
});

describe("signIn", () => {
  it("stores only the hash of the session token, for 7 days, and audits", async () => {
    const user = await person();
    const { token, expiresAt } = await signIn({ email: "staff@example.test", password: PASSWORD });
    const sessions = await testDb.session.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.tokenHash).toBe(hashToken(token));
    expect(sessions[0]!.tokenHash).not.toBe(token);
    expect(Math.round((expiresAt.getTime() - Date.now()) / 86_400_000)).toBe(7);
    expect(await testDb.auditLog.count({ where: { action: "user.signed_in", entityId: user.id } })).toBe(1);
    expect((await testDb.user.findUniqueOrThrow({ where: { id: user.id } })).lastLoginAt).not.toBeNull();
  });

  it("gives the same message for an unknown email, a wrong password, an inactive account and one with no password", async () => {
    await person();
    await person({ email: "off@example.test", status: "INACTIVE" });
    await person({ email: "nopass@example.test", password: null });
    const attempts = [
      { email: "nobody@example.test", password: PASSWORD },
      { email: "staff@example.test", password: "wrong" },
      { email: "off@example.test", password: PASSWORD },
      { email: "nopass@example.test", password: PASSWORD },
    ];
    for (const attempt of attempts) {
      const error = await signIn(attempt).catch((e) => e);
      expect(error).toBeInstanceOf(UnauthenticatedError);
      expect(error.message).toBe(BAD);
    }
    expect(await testDb.session.count()).toBe(0);
  });

  it("locks the account after 5 wrong passwords in a row, even for the right password, until the lock passes", async () => {
    const user = await person();
    for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) await signIn({ email: "staff@example.test", password: "wrong" }).catch(() => undefined);
    const locked = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(locked.lockedUntil).not.toBeNull();
    expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    await expect(signIn({ email: "staff@example.test", password: PASSWORD })).rejects.toThrow(BAD);
    expect(await testDb.session.count()).toBe(0);

    await testDb.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    await expect(signIn({ email: "staff@example.test", password: PASSWORD })).resolves.toHaveProperty("token");
    expect(await testDb.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ failedLoginCount: 0, lockedUntil: null });
  });

  it("a right password resets the failure count", async () => {
    const user = await person();
    await signIn({ email: "staff@example.test", password: "wrong" }).catch(() => undefined);
    await signIn({ email: "staff@example.test", password: "wrong" }).catch(() => undefined);
    expect((await testDb.user.findUniqueOrThrow({ where: { id: user.id } })).failedLoginCount).toBe(2);
    await signIn({ email: "staff@example.test", password: PASSWORD });
    expect((await testDb.user.findUniqueOrThrow({ where: { id: user.id } })).failedLoginCount).toBe(0);
  });

  it("removes only this person's already-ended sessions when they sign in", async () => {
    const user = await person();
    const other = await person({ email: "other@example.test" });
    await testDb.session.create({ data: { userId: user.id, tokenHash: "old", expiresAt: new Date(Date.now() - 1000) } });
    await testDb.session.create({ data: { userId: other.id, tokenHash: "other-old", expiresAt: new Date(Date.now() - 1000) } });
    await signIn({ email: "staff@example.test", password: PASSWORD });
    expect(await testDb.session.findFirst({ where: { tokenHash: "old" } })).toBeNull();
    expect(await testDb.session.findFirst({ where: { tokenHash: "other-old" } })).not.toBeNull();
  });

  it("signOut ends only that session", async () => {
    await person();
    const a = await signIn({ email: "staff@example.test", password: PASSWORD });
    const b = await signIn({ email: "staff@example.test", password: PASSWORD });
    await signOut(a.token);
    const remaining = await testDb.session.findMany();
    expect(remaining.map((s) => s.tokenHash)).toEqual([hashToken(b.token)]);
  });
});

describe("setupFirstAdmin", () => {
  const input = { name: "TEST Owner", email: "owner@example.test", password: "TEST-owner-password-1" };

  it("takes over the existing first user, keeps their id, and signs them in", async () => {
    const grant = await setupFirstAdmin(input);
    const users = await testDb.user.findMany();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ id: admin.actor.id, name: "TEST Owner", email: "owner@example.test", role: "ADMIN" });
    expect(users[0]!.passwordHash).toMatch(/^scrypt\$/);
    expect((await testDb.session.findFirstOrThrow()).tokenHash).toBe(hashToken(grant.token));
    await expect(signIn({ email: input.email, password: input.password })).resolves.toHaveProperty("token");
  });

  it("refuses a second run once an admin has a password", async () => {
    await setupFirstAdmin(input);
    await expect(setupFirstAdmin({ ...input, email: "attacker@example.test" })).rejects.toBeInstanceOf(ConflictError);
    expect(await testDb.user.count()).toBe(1);
  });

  it("refuses an email that belongs to another user", async () => {
    await person({ email: "taken@example.test", role: "STAFF" });
    await expect(setupFirstAdmin({ ...input, email: "taken@example.test" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("creates the admin when there are no users at all", async () => {
    await testDb.user.deleteMany();
    await setupFirstAdmin(input);
    expect(await testDb.user.findMany()).toMatchObject([{ email: "owner@example.test", role: "ADMIN" }]);
  });

  it("only one of two simultaneous setups wins", async () => {
    const results = await Promise.allSettled([setupFirstAdmin(input), setupFirstAdmin({ ...input, email: "second@example.test" })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await testDb.user.count({ where: { role: "ADMIN", passwordHash: { not: null } } })).toBe(1);
  });
});

describe("setupFirstAdmin with a setup code", () => {
  const input = { name: "TEST Owner", email: "owner@example.test", password: "TEST-owner-password-1" };
  afterEach(() => vi.unstubAllEnvs());

  it("refuses a missing or wrong code, and changes nothing", async () => {
    vi.stubEnv("SETUP_TOKEN", "TEST-setup-code");
    await expect(setupFirstAdmin(input)).rejects.toBeInstanceOf(ValidationError);
    await expect(setupFirstAdmin({ ...input, setupToken: "wrong" })).rejects.toMatchObject({ fieldErrors: { setupToken: "Not correct" } });
    expect(await testDb.user.findMany()).toMatchObject([{ id: admin.actor.id, passwordHash: null }]);
    expect(await testDb.session.count()).toBe(0);
  });

  it("accepts the right code", async () => {
    vi.stubEnv("SETUP_TOKEN", "TEST-setup-code");
    await expect(setupFirstAdmin({ ...input, setupToken: "TEST-setup-code" })).resolves.toHaveProperty("token");
    expect((await testDb.user.findUniqueOrThrow({ where: { id: admin.actor.id } })).passwordHash).toMatch(/^scrypt\$/);
  });
});

describe("changeOwnPassword", () => {
  it("needs the current password, and changes the hash", async () => {
    const user = await person();
    const ctx = asStaff(user);
    await expect(changeOwnPassword(ctx, { currentPassword: "wrong", newPassword: "TEST-new-password-2" }, null)).rejects.toBeInstanceOf(ValidationError);
    await changeOwnPassword(ctx, { currentPassword: PASSWORD, newPassword: "TEST-new-password-2" }, null);
    await expect(signIn({ email: "staff@example.test", password: PASSWORD })).rejects.toThrow(BAD);
    await expect(signIn({ email: "staff@example.test", password: "TEST-new-password-2" })).resolves.toHaveProperty("token");
  });

  it("ends the other sessions but keeps the one in use", async () => {
    const user = await person();
    const mine = await signIn({ email: "staff@example.test", password: PASSWORD });
    await signIn({ email: "staff@example.test", password: PASSWORD });
    await changeOwnPassword(asStaff(user), { currentPassword: PASSWORD, newPassword: "TEST-new-password-2" }, mine.token);
    expect((await testDb.session.findMany({ where: { userId: user.id } })).map((s) => s.tokenHash)).toEqual([hashToken(mine.token)]);
  });

  it("audits that it changed, never the password", async () => {
    const user = await person();
    await changeOwnPassword(asStaff(user), { currentPassword: PASSWORD, newPassword: "TEST-new-password-2" }, null);
    const audits = JSON.stringify(await testDb.auditLog.findMany());
    expect(audits).toContain("user.password_changed");
    expect(audits).not.toContain("TEST-new-password-2");
    expect(audits).not.toContain(PASSWORD);
  });
});

describe("user management", () => {
  const newUser = (over: Record<string, unknown> = {}) => userCreateSchema.parse({ name: "TEST New", email: "new@example.test", role: "STAFF", password: "TEST-initial-password", ...over });

  it("every operation is admin only", async () => {
    const staff = asStaff(await person());
    const target = await person({ email: "target@example.test" });
    await expect(createUser(staff, newUser())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateUser(staff, { id: target.id, name: "x", email: "target@example.test", role: "ADMIN" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(resetUserPassword(staff, { id: target.id, password: "TEST-reset-password" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setUserStatus(staff, { id: target.id, status: "INACTIVE" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("creates a user with a hashed password, and refuses a duplicate email", async () => {
    const { id } = await createUser(admin, newUser());
    const created = await testDb.user.findUniqueOrThrow({ where: { id } });
    expect(created.passwordHash).toMatch(/^scrypt\$/);
    await expect(createUser(admin, newUser())).rejects.toMatchObject({ fieldErrors: { email: "Already in use" } });
    expect(JSON.stringify(await testDb.auditLog.findMany())).not.toContain("TEST-initial-password");
  });

  it("cannot demote or deactivate the last active admin, and cannot change one's own role or deactivate oneself", async () => {
    await expect(updateUser(admin, { id: admin.actor.id, name: "x", email: admin.actor.email, role: "STAFF" })).rejects.toBeInstanceOf(InvariantError);
    await expect(setUserStatus(admin, { id: admin.actor.id, status: "INACTIVE" })).rejects.toBeInstanceOf(InvariantError);

    const second = await person({ email: "second@example.test", role: "ADMIN" });
    // With two admins, a demotion of the other is allowed; demoting the very last one is refused by the service.
    await expect(updateUser(admin, { id: second.id, name: "x", email: "second@example.test", role: "STAFF" })).resolves.toBeTruthy();
    const secondCtx: ServiceContext = { actor: { id: second.id, email: second.email, name: second.name, role: "STAFF" }, db: admin.db };
    await expect(setUserStatus(secondCtx, { id: admin.actor.id, status: "INACTIVE" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("deactivating a person ends their sessions, and they cannot sign in until reactivated", async () => {
    await person();
    const grant = await signIn({ email: "staff@example.test", password: PASSWORD });
    const target = await testDb.user.findUniqueOrThrow({ where: { email: "staff@example.test" } });
    await setUserStatus(admin, { id: target.id, status: "INACTIVE" });
    expect(await testDb.session.count({ where: { userId: target.id } })).toBe(0);
    expect(grant.token).toBeTruthy();
    await expect(signIn({ email: "staff@example.test", password: PASSWORD })).rejects.toThrow(BAD);
    await setUserStatus(admin, { id: target.id, status: "ACTIVE" });
    await expect(signIn({ email: "staff@example.test", password: PASSWORD })).resolves.toHaveProperty("token");
  });

  it("an admin reset ends the person's sessions, unlocks them, and sets the new password", async () => {
    const target = await person();
    for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) await signIn({ email: "staff@example.test", password: "wrong" }).catch(() => undefined);
    await testDb.session.create({ data: { userId: target.id, tokenHash: "live", expiresAt: new Date(Date.now() + 100_000) } });
    await resetUserPassword(admin, { id: target.id, password: "TEST-reset-password" });
    expect(await testDb.session.count({ where: { userId: target.id } })).toBe(0);
    expect(await testDb.user.findUniqueOrThrow({ where: { id: target.id } })).toMatchObject({ failedLoginCount: 0, lockedUntil: null });
    await expect(signIn({ email: "staff@example.test", password: "TEST-reset-password" })).resolves.toHaveProperty("token");
  });

  it("an unknown user is not found", async () => {
    await expect(setUserStatus(admin, { id: "01a0db65-5ba7-75e3-a993-a458968ec3b7", status: "INACTIVE" })).rejects.toBeInstanceOf(NotFoundError);
  });
});
