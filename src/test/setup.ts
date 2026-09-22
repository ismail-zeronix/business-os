import "dotenv/config";

/**
 * Runs in every test file BEFORE it imports application modules. Points the application's database singleton at the test database,
 * so queries and services under test can never reach development data.
 */
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is not set.");

const dbName = decodeURIComponent(new URL(testUrl).pathname.slice(1));
if (!/^[a-z0-9_]+_test$/.test(dbName)) {
  throw new Error(`Refusing to run tests against "${dbName}": the test database name must end in "_test".`);
}

process.env.DATABASE_URL = testUrl;
process.env.DEV_ACTOR_EMAIL = "test-actor@zeronix.test";
