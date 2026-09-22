import { db } from "../../core/database/client";

/** Everyone, for the admin's Users screen. The password hash is read only to say "has a password" and is never returned. */
export async function listUsers() {
  const rows = await db.user.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true, createdAt: true, lockedUntil: true, passwordHash: true },
  });
  return rows.map(({ passwordHash, ...user }) => ({ ...user, hasPassword: passwordHash !== null }));
}

export type UserRow = Awaited<ReturnType<typeof listUsers>>[number];

/** One person's saved email signature, or null when they have none. */
export async function getOwnSignature(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { emailSignature: true } });
  return user?.emailSignature ?? null;
}
