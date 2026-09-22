/**
 * Backs up the project database to backups/<db>-<timestamp>.dump (PostgreSQL custom format, compressed).
 *
 *   npm run db:backup              write a backup and keep the newest 14
 *   npm run db:backup -- --keep 30 keep the newest 30
 *
 * READ-ONLY with respect to the database: it runs pg_dump inside the Docker container and streams the result to a file on this machine.
 * The backups/ folder is git-ignored. Backups contain real business data: treat them like the database itself.
 * Restore: see scripts/db-restore.ts and the README ("Backups").
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const container = process.env.ZI_DB_CONTAINER ?? "zeronix-bi-postgres";
const user = process.env.ZI_DB_USER ?? "zeronix_bi";
const database = process.env.ZI_DB_NAME ?? "zeronix_bi";
const BACKUP_DIR = "backups";

function argKeep(): number {
  const index = process.argv.indexOf("--keep");
  const value = index >= 0 ? Number(process.argv[index + 1]) : 14;
  return Number.isInteger(value) && value >= 1 ? value : 14;
}

function run(args: string[], input?: string, output?: string): Promise<{ code: number; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] });
    let stderr = "";
    let stdout = "";
    child.stderr!.on("data", (chunk) => (stderr += String(chunk)));
    if (output) child.stdout!.pipe(createWriteStream(output));
    else child.stdout!.on("data", (chunk) => (stdout += String(chunk)));
    if (input) createReadStream(input).pipe(child.stdin!);
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stderr, stdout }));
  });
}

async function main() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const file = path.join(BACKUP_DIR, `${database}-${stamp}.dump`);

  const dump = await run(["exec", container, "pg_dump", "-U", user, "-d", database, "-Fc", "--no-owner"], undefined, file);
  if (dump.code !== 0) {
    rmSync(file, { force: true });
    throw new Error(`pg_dump failed. Is the database running (npm run db:up)?\n${dump.stderr.trim()}`);
  }

  // Prove the archive is readable: list its table of contents.
  const listing = await run(["exec", "-i", container, "pg_restore", "--list"], file);
  if (listing.code !== 0) {
    throw new Error(`The backup was written but could not be read back, so it may be corrupt: ${file}\n${listing.stderr.trim()}`);
  }
  const objects = listing.stdout.split("\n").filter((line) => line && !line.startsWith(";")).length;
  console.log(`Backup written: ${file} (${(statSync(file).size / 1024).toFixed(0)} KB, ${objects} objects, verified readable)`);

  // Keep the newest N backups of this database; never touch anything that does not match our own naming pattern.
  const keep = argKeep();
  const mine = readdirSync(BACKUP_DIR)
    .filter((name) => new RegExp(`^${database}-\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2}\\.dump$`).test(name))
    .sort()
    .reverse();
  for (const old of mine.slice(keep)) {
    rmSync(path.join(BACKUP_DIR, old));
    console.log(`Removed old backup: ${old}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
