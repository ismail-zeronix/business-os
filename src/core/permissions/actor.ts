import { unstable_rethrow, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { cache } from "react";
import { hashToken, SESSION_COOKIE } from "../auth/session";
import { db } from "../database/client";
import type { ServiceContext } from "../database/tx";
import { InvariantError, UnauthenticatedError } from "../errors";
import type { UserRole } from "../../generated/prisma/enums";

export type Actor = { id: string; email: string; name: string; role: UserRole };

/**
 * THE single place that decides "who is acting" (docs/decisions/0006-sign-in-and-roles.md).
 *  - With a valid sign-in session: that person.
 *  - Sign-in is only enforced once an admin has a password. Until then (a fresh install, before /setup) the application behaves as it always
 *    did: the development user (DEV_ACTOR_EMAIL) acts, with admin rights, and a banner says sign-in is not set up.
 * Pages call `requireActor()` (redirects to the sign-in screen); services take the actor in `ctx` from `getServiceContext()`.
 * Scripts with no browser use `getSystemContext()` (system-actor.ts).
 */

/** Sign-in is enforced once at least one active admin has a password. Per request, so a page does not ask twice. */
export const signInEnabled = cache(async (): Promise<boolean> => {
  return (await db.user.count({ where: { role: "ADMIN", status: "ACTIVE", passwordHash: { not: null } } })) > 0;
});

/** The person behind the session cookie, or null (no cookie, unknown or expired session, deactivated user). Never throws for a bad cookie. */
export const getSessionActor = cache(async (): Promise<Actor | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expiresAt: true, user: { select: { id: true, email: true, name: true, role: true, status: true } } },
  });
  if (!session || session.expiresAt.getTime() <= Date.now() || session.user.status !== "ACTIVE") return null;
  const { id, email, name, role } = session.user;
  return { id, email, name, role };
});

/** While sign-in is not set up: the seeded development user, treated as an admin. */
async function developmentActor(): Promise<Actor> {
  const email = (process.env.DEV_ACTOR_EMAIL ?? "dev@zeronix.local").trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") {
    throw new InvariantError(`Development user "${email}" was not found. Run "npm run db:seed" first.`);
  }
  return { id: user.id, email: user.email, name: user.name, role: "ADMIN" };
}

/** For services and actions. Throws (a plain "Please sign in again") when sign-in is on and there is no valid session. */
export async function getCurrentActor(): Promise<Actor> {
  const actor = await getSessionActor();
  if (actor) return actor;
  if (!(await signInEnabled())) return developmentActor();
  throw new UnauthenticatedError();
}

/** Context for a server action or page: the current actor and the shared database client. */
export async function getServiceContext(): Promise<ServiceContext> {
  return { actor: await getCurrentActor(), db };
}

/**
 * For pages, layouts and route handlers: the signed-in person, or a redirect to /login. Call it FIRST, before reading any data, because a
 * layout is not re-run on client navigation (only the page is), so each page has to check for itself.
 */
export const requireActor = cache(async (): Promise<Actor> => {
  const actor = await getSessionActor();
  if (actor) return actor;
  if (!(await signInEnabled())) return developmentActor();
  redirect("/login");
});

/** Like `requireActor`, and a Staff member is sent to a plain "only an admin" page. */
export async function requireAdmin(): Promise<Actor> {
  const actor = await requireActor();
  if (actor.role !== "ADMIN") redirect("/forbidden");
  return actor;
}

/** For a shell that must still draw when the database is down: the actor, or null. Real redirects (not signed in) still happen. */
export async function requireActorOrNull(): Promise<Actor | null> {
  try {
    return await requireActor();
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}
