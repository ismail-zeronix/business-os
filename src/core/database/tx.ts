import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import type { Actor } from "../permissions/actor";

/** The Prisma client or an open transaction. Services accept either so they compose. */
export type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Every mutating service is `fn(ctx, input)`. `actor` is who is acting (recorded on audit rows and created_by columns),
 * `db` is where to write. Authorization can later be added at this boundary without touching the UI.
 */
export type ServiceContext = { actor: Actor; db: Db };

/**
 * Runs `fn` inside a transaction. If `ctx.db` is already a transaction, `fn` simply joins it, so a service can be called
 * standalone or as part of a larger unit of work (e.g. confirming a broadcast item creates observations and audit rows atomically).
 */
export function inTransaction<T>(ctx: ServiceContext, fn: (ctx: ServiceContext) => Promise<T>): Promise<T> {
  if ("$transaction" in ctx.db) {
    return ctx.db.$transaction((tx) => fn({ ...ctx, db: tx }), { timeout: 15_000, maxWait: 5_000 });
  }
  return fn(ctx);
}
