import "dotenv/config";
import { db } from "../src/core/database/client";
import type { Prisma } from "../src/generated/prisma/client";

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean) {
  if (ok) {
    passed++;
    console.log(`OK   ${label}`);
  } else {
    failed++;
    console.log(`FAIL ${label}`);
  }
}

class Rollback extends Error {}

/**
 * Runs `fn` expecting it to throw (a CHECK-constraint violation). A real DB error aborts the whole enclosing Postgres
 * transaction (SQLSTATE 25P02: every later statement fails until rollback), so each such check runs inside its own
 * SAVEPOINT and rolls back only to that point on failure — the transaction recovers and later checks can still run.
 */
async function expectReject(tx: Prisma.TransactionClient, label: string, fn: () => Promise<unknown>) {
  await tx.$executeRawUnsafe("SAVEPOINT check_point");
  let threw = false;
  try {
    await fn();
  } catch {
    threw = true;
  }
  await tx.$executeRawUnsafe(threw ? "ROLLBACK TO SAVEPOINT check_point" : "RELEASE SAVEPOINT check_point");
  check(label, threw);
}

async function main() {
  try {
    await db.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({ where: { status: "ACTIVE" } });
      const actorUser = await tx.user.findFirst({ where: { status: "ACTIVE" } });
      const evidence = await tx.evidenceSource.findFirst();
      if (!supplier || !actorUser || !evidence) throw new Error("Fixture data missing (need at least one active supplier, active user, and evidence source)");

      const product = await tx.product.create({ data: { name: "TEST Warranty Check Product", normalizedModel: "TESTWARRANTY1", isTemporary: true } });

      // warranty_months > 0 is enforced
      await expectReject(tx, "price_observations rejects warranty_months = 0", () =>
        tx.priceObservation.create({
          data: { productId: product.id, supplierId: supplier.id, amount: "100", currencyCode: "AED", observedAt: new Date(), evidenceSourceId: evidence.id, createdById: actorUser.id, warrantyMonths: 0 },
        }),
      );

      // A positive value is accepted and stored with a type
      const observation = await tx.priceObservation.create({
        data: { productId: product.id, supplierId: supplier.id, amount: "100", currencyCode: "AED", observedAt: new Date(), evidenceSourceId: evidence.id, createdById: actorUser.id, warrantyMonths: 36, warrantyType: "ON_SITE" },
      });
      check("price_observations accepts warranty_months=36, warranty_type=ON_SITE", observation.warrantyMonths === 36 && observation.warrantyType === "ON_SITE");

      // NULL warranty (never stated) is still fine, same as before this migration
      const observation2 = await tx.priceObservation.create({
        data: { productId: product.id, supplierId: supplier.id, amount: "50", currencyCode: "AED", observedAt: new Date(), evidenceSourceId: evidence.id, createdById: actorUser.id },
      });
      check("price_observations still accepts NULL warranty (unknown stays unknown)", observation2.warrantyMonths === null && observation2.warrantyType === null);

      // broadcast_items category_text is free text, no FK
      const broadcast = await tx.broadcast.create({ data: { evidenceSourceId: (await tx.evidenceSource.create({ data: { kind: "SUPPLIER_BROADCAST", channel: "MANUAL_PASTE", rawText: "TEST warranty check", contentHash: "test-warranty-check-hash", observedAt: new Date(), createdById: actorUser.id } })).id, supplierId: supplier.id, createdById: actorUser.id } });
      const item = await tx.broadcastItem.create({ data: { broadcastId: broadcast.id, position: 1, sourceText: "TEST", origin: "MANUAL", categoryText: "Monitor", warrantyMonths: 12, warrantyType: "CARRY_IN" } });
      check("broadcast_items stores category_text and warranty fields", item.categoryText === "Monitor" && item.warrantyMonths === 12 && item.warrantyType === "CARRY_IN");

      await expectReject(tx, "broadcast_items rejects a negative warranty_months", () => tx.broadcastItem.update({ where: { id: item.id }, data: { warrantyMonths: -1 } }));

      throw new Rollback("rollback");
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await db.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
