import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

/**
 * Builds a Prisma client for an explicit connection string. Used by the app singleton (client.ts), the seed script,
 * and the integration tests (which pass TEST_DATABASE_URL). Relative import on purpose so it also works outside Next/Vitest path aliases.
 */
export function createDbClient(connectionString: string): PrismaClient {
  if (!connectionString) {
    throw new Error("Database connection string is empty. Copy .env.example to .env and check DATABASE_URL.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export type { PrismaClient };
