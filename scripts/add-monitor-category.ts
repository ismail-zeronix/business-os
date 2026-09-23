import "dotenv/config";
import { db } from "../src/core/database/client";
import { createCategory } from "../src/modules/products/master-data.service";

async function main() {
  const actor = await db.user.findFirst({ where: { role: "ADMIN", status: "ACTIVE" } });
  if (!actor) throw new Error("No active admin user found to act as");
  const existing = await db.category.findFirst({ where: { normalizedName: "monitor" } });
  if (existing) {
    console.log(`"Monitor" already exists (id ${existing.id}), nothing to do.`);
  } else {
    const category = await createCategory({ actor: { id: actor.id, email: actor.email, name: actor.name, role: actor.role }, db }, { name: "Monitor" });
    console.log(`Created category "Monitor" (id ${category.id})`);
  }
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
