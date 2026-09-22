import { db } from "../database/client";
import type { ServiceContext } from "../database/tx";
import { InvariantError } from "../errors";

/**
 * Who a script with no browser acts as (the mailbox sync). It is never a sign-in session, so scripts keep working whether or not anyone
 * is signed in. The user named by `DEV_ACTOR_EMAIL` if it exists; after first-time sign-in setup that account has taken over by a real
 * person's email, so otherwise the oldest active admin (the same account). This file imports nothing from Next.js so `tsx` scripts can use it.
 */
export async function getSystemContext(): Promise<ServiceContext> {
  const email = (process.env.DEV_ACTOR_EMAIL ?? "dev@zeronix.local").trim().toLowerCase();
  const named = await db.user.findUnique({ where: { email } });
  const user = named && named.status === "ACTIVE" ? named : await db.user.findFirst({ where: { role: "ADMIN", status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
  if (!user) {
    throw new InvariantError(`No system user: "${email}" was not found and there is no active admin. Run "npm run db:seed", or set DEV_ACTOR_EMAIL.`);
  }
  return { actor: { id: user.id, email: user.email, name: user.name, role: "ADMIN" }, db };
}
