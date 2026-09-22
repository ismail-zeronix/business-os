import { db } from "../core/database/client";
import type { ServiceContext } from "../core/database/tx";

/** All test data is clearly labelled TEST. Nothing here is a real supplier, product or price. */
export const testDb = db;

/** Empties every table (except Prisma's migration history). Guarded: only ever runs against a database named "*_test". */
export async function resetDatabase(): Promise<void> {
  const [{ current_database }] = await db.$queryRaw<{ current_database: string }[]>`select current_database()`;
  if (!/_test$/.test(current_database)) throw new Error(`Refusing to truncate "${current_database}": not a test database.`);

  const tables = await db.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  // TRUNCATE is not blocked by the row-level append-only triggers, which is what makes cleanup possible.
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

/** A service context acting as a TEST user. Audit rows need a real user (FK), so it is created here. */
export async function createTestContext(): Promise<ServiceContext> {
  const user = await db.user.create({ data: { email: "test-actor@zeronix.test", name: "TEST Actor" } });
  return { actor: { id: user.id, email: user.email, name: user.name, role: "ADMIN" }, db };
}

/** Reference data used by several tests. */
export async function createBrand(name: string, status: "ACTIVE" | "ARCHIVED" = "ACTIVE") {
  return db.brand.create({ data: { name, normalizedName: name.toLowerCase(), status } });
}

export async function createCategory(name: string, status: "ACTIVE" | "ARCHIVED" = "ACTIVE") {
  return db.category.create({ data: { name, normalizedName: name.toLowerCase(), status } });
}
