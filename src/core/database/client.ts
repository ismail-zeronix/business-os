import { createDbClient, type PrismaClient } from "./factory";

// One client per server process. In development the module is re-evaluated on hot reload, so the instance is cached on globalThis.
const globalForDb = globalThis as unknown as { __zeronixDb?: PrismaClient };

export const db: PrismaClient = globalForDb.__zeronixDb ?? createDbClient(process.env.DATABASE_URL ?? "");

if (process.env.NODE_ENV !== "production") {
  globalForDb.__zeronixDb = db;
}
