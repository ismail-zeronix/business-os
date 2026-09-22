/**
 * Syncs every ACTIVE email account (docs/plans/active/CURRENT.md section 10). Read-only with respect to the mailbox: nothing is marked
 * read, moved or deleted. Emails are stored as evidence for triage; no enquiry is ever created here.
 *
 *   npm run mail:sync                one pass, then exit
 *   npm run mail:sync -- --watch     repeat every MAIL_SYNC_INTERVAL_MINUTES (default 5) until stopped with Ctrl+C
 *
 * It logs one line per account (counts or a short sanitised error). It never logs credentials. The application does not need to be
 * running, but PostgreSQL does. Audit rows are attributed to the development user (DEV_ACTOR_EMAIL).
 */
import "dotenv/config";
import { db } from "../src/core/database/client";
import { getSystemContext } from "../src/core/permissions/system-actor";
import { syncAllActiveAccounts } from "../src/modules/email/sync.service";

const watch = process.argv.includes("--watch");
const intervalMinutes = Math.max(1, Number(process.env.MAIL_SYNC_INTERVAL_MINUTES) || 5);
let stopping = false;

const stamp = () => new Date().toISOString().replace("T", " ").slice(0, 19);

async function pass(): Promise<void> {
  try {
    const outcomes = await syncAllActiveAccounts(await getSystemContext());
    if (outcomes.length === 0) console.log(`[${stamp()}] no active email accounts`);
    for (const { label, result, error } of outcomes) {
      if (error) console.log(`[${stamp()}] ${label}: not synced (${error})`);
      else if (result?.error) console.log(`[${stamp()}] ${label}: ${result.ingested} new, stopped: ${result.error}`);
      else console.log(`[${stamp()}] ${label}: ${result?.ingested ?? 0} new, ${result?.skipped ?? 0} already stored${result?.remaining ? ", more waiting" : ""}`);
    }
  } catch (error) {
    // Only reached if the database or the actor lookup failed. Report plainly; a watch loop tries again next time.
    console.error(`[${stamp()}] sync could not run: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    process.once("SIGINT", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function main() {
  process.once("SIGINT", () => {
    stopping = true;
    console.log(`\n[${stamp()}] stopping after the current pass...`);
  });
  await pass();
  while (watch && !stopping) {
    console.log(`[${stamp()}] next sync in ${intervalMinutes} min (Ctrl+C to stop)`);
    await sleep(intervalMinutes * 60_000);
    if (!stopping) await pass();
  }
  await db.$disconnect();
}

main();
