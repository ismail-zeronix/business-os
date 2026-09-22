import type { ServiceContext } from "../database/tx";
import { ForbiddenError } from "../errors";

/**
 * Role checks that are pure logic (no Next.js), so any service can use them. The two roles: ADMIN (everything, plus users, mailbox
 * connections and brand / category settings) and STAFF (all daily work). See docs/decisions/0006-sign-in-and-roles.md.
 */

/** The service-boundary check for admin-only actions. */
export function assertAdmin(ctx: ServiceContext): void {
  if (ctx.actor.role !== "ADMIN") throw new ForbiddenError();
}
