import "dotenv/config";
import { execSync } from "node:child_process";
import { Client } from "pg";

/**
 * Runs once before the test run. Ensures the separate test database exists and is migrated.
 * SAFETY: refuses to do anything unless TEST_DATABASE_URL points at a database whose name ends in "_test",
 * so a misconfiguration can never touch development data.
 */
export default async function globalSetup() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error("TEST_DATABASE_URL is not set. Copy .env.example to .env and start the database (npm run db:up).");

  const url = new URL(testUrl);
  const dbName = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-z0-9_]+_test$/.test(dbName)) {
    throw new Error(`Refusing to run tests: TEST_DATABASE_URL must name a database ending in "_test" (got "${dbName}").`);
  }

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  try {
    await admin.connect();
  } catch (error) {
    throw new Error(`Cannot reach PostgreSQL for tests. Is it running? Try "npm run db:up". (${error instanceof Error ? error.message : error})`);
  }
  try {
    const exists = await admin.query("select 1 from pg_database where datname = $1", [dbName]);
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`); // dbName is validated by the regex above
  } finally {
    await admin.end();
  }

  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: testUrl }, stdio: "pipe" });
}
