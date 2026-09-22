/**
 * Restores a backup into a NEW database. It never touches the live database.
 *
 *   npm run db:restore -- backups/zeronix_bi-2026-09-20-12-00-00.dump zeronix_bi_restored
 *
 * Safety: the target database must not exist, and it may not be the live database (ZI_DB_NAME). After restoring, inspect the copy
 * (for example with psql or Prisma Studio). To RECOVER the live database from a backup, follow the manual, deliberate steps in the
 * README ("Backups"): that replaces data and must never be automated.
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";

const container = process.env.ZI_DB_CONTAINER ?? "zeronix-bi-postgres";
const user = process.env.ZI_DB_USER ?? "zeronix_bi";
const live = process.env.ZI_DB_NAME ?? "zeronix_bi";

function docker(args: string[], stdinFile?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: [stdinFile ? "pipe" : "ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout!.on("data", (c) => (stdout += String(c)));
    child.stderr!.on("data", (c) => (stderr += String(c)));
    if (stdinFile) createReadStream(stdinFile).pipe(child.stdin!);
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function main() {
  const [file, target] = process.argv.slice(2);
  if (!file || !target) throw new Error("Usage: npm run db:restore -- <backup-file> <new-database-name>");
  if (!existsSync(file)) throw new Error(`Backup file not found: ${file}`);
  if (!/^[a-z][a-z0-9_]{2,62}$/.test(target)) throw new Error("The target name may only use lower-case letters, digits and underscores.");
  if (target === live) throw new Error(`Refusing: "${target}" is the live database. Restore into a new name; see the README to recover the live database.`);

  const exists = await docker(["exec", container, "psql", "-U", user, "-d", "postgres", "-Atc", `select 1 from pg_database where datname = '${target}'`]);
  if (exists.stdout.trim() === "1") throw new Error(`Database "${target}" already exists. Choose a new name; nothing was changed.`);

  const created = await docker(["exec", container, "psql", "-U", user, "-d", "postgres", "-c", `CREATE DATABASE ${target}`]);
  if (created.code !== 0) throw new Error(`Could not create "${target}": ${created.stderr.trim()}`);

  const restored = await docker(["exec", "-i", container, "pg_restore", "-U", user, "-d", target, "--no-owner", "--exit-on-error"], file);
  if (restored.code !== 0) throw new Error(`Restore failed (the new database "${target}" was left for inspection):\n${restored.stderr.trim()}`);

  const counts = await docker([
    "exec", container, "psql", "-U", user, "-d", target, "-Atc",
    "select 'suppliers='||(select count(*) from suppliers)||' products='||(select count(*) from products)||' broadcasts='||(select count(*) from broadcasts)||' price_observations='||(select count(*) from price_observations)||' audit_logs='||(select count(*) from audit_logs)",
  ]);
  console.log(`Restored into "${target}": ${counts.stdout.trim()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
