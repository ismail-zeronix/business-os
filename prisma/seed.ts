/**
 * Development seed. Idempotent: safe to run repeatedly, never overwrites rows that already exist.
 *
 * Seeds REFERENCE DATA ONLY: one development user, common brands, common categories.
 * It deliberately creates NO suppliers, products, prices or stock: inventing business facts would violate
 * the "never fabricate" rule (CLAUDE.md). Tests create their own clearly labelled TEST data in a separate database.
 */
import "dotenv/config";
import { createDbClient } from "../src/core/database/factory";
import { normalizeName } from "../src/lib/normalize";

const BRANDS = ["Dell", "HP", "Lenovo", "HPE", "Cisco", "Ubiquiti"];
const CATEGORIES = ["Laptop", "Desktop", "Workstation", "Server", "Networking", "Storage", "Printer", "CCTV"];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");

  const db = createDbClient(url);
  try {
    // The development user exists only on a fresh database. Once sign-in has been set up (docs/decisions/0006-sign-in-and-roles.md) that
    // account has been taken over by a real person, so the seed must not add a second, password-less one.
    if ((await db.user.count()) === 0) {
      const email = (process.env.DEV_ACTOR_EMAIL ?? "dev@zeronix.local").trim().toLowerCase();
      await db.user.create({ data: { email, name: "Development User" } });
    }

    for (const name of BRANDS) {
      await db.brand.upsert({
        where: { normalizedName: normalizeName(name) },
        update: {},
        create: { name, normalizedName: normalizeName(name) },
      });
    }

    for (const name of CATEGORIES) {
      await db.category.upsert({
        where: { normalizedName: normalizeName(name) },
        update: {},
        create: { name, normalizedName: normalizeName(name) },
      });
    }

    const [users, brands, categories] = await Promise.all([db.user.count(), db.brand.count(), db.category.count()]);
    console.log(`Seed complete: ${users} user(s), ${brands} brand(s), ${categories} category(ies).`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
