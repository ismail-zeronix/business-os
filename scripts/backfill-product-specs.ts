/**
 * One-time catch-up for products created before structured specifications existed (docs/plans/active/CURRENT.md, "Structured requirements",
 * phase 2). Reads every non-archived product's name and description and proposes: its model key, its structured attributes (source PARSER),
 * and, where the product has no category, the category its own broadcast lines named.
 *
 *   npm run specs:backfill                         DRY RUN (default): prints what it would write, writes nothing
 *   npm run specs:backfill -- --apply              writes model keys and attributes (additive; existing values are never overwritten)
 *   npm run specs:backfill -- --apply-categories   sets the category on products that have none, only when their lines agree on ONE category
 *
 * Nothing is deleted or overwritten. Each written product gets one audit row attributed to the development user (DEV_ACTOR_EMAIL).
 */
import "dotenv/config";
import { db } from "../src/core/database/client";
import { inTransaction } from "../src/core/database/tx";
import { getSystemContext } from "../src/core/permissions/system-actor";
import { normalizeName } from "../src/lib/normalize";
import { writeAudit } from "../src/modules/audit/service";
import { createParsedProductAttributes, proposeProductAttributes } from "../src/modules/products/attributes.service";
import { attributeValue } from "../src/modules/specs/format";
import { canonicalModelKey } from "../src/modules/specs/model-key";

const apply = process.argv.includes("--apply");
const applyCategories = process.argv.includes("--apply-categories");
const verbose = process.argv.includes("--verbose");

async function main() {
  const ctx = await getSystemContext();
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        model: true,
        modelKey: true,
        categoryId: true,
        attributes: { where: { retractedAt: null }, select: { attributeKey: true } },
        broadcastItems: { select: { categoryText: true } },
      },
    }),
    db.category.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, name: true, normalizedName: true } }),
  ]);
  const categoryByName = new Map(categories.map((c) => [c.normalizedName, c]));

  const perKey = new Map<string, number>();
  let withNewKey = 0;
  let withNewAttributes = 0;
  let attributeRows = 0;
  let categoryProposals = 0;
  let categoryAmbiguous = 0;
  let categoryNone = 0;
  let written = 0;

  for (const product of products) {
    const modelKey = product.modelKey ? null : canonicalModelKey(product.model);
    const have = new Set(product.attributes.map((a) => a.attributeKey));
    const proposals = proposeProductAttributes(product).filter((p) => !have.has(p.attributeKey));

    let category: { id: string; name: string } | null = null;
    if (!product.categoryId) {
      const named = [...new Set(product.broadcastItems.map((i) => (i.categoryText?.trim() ? normalizeName(i.categoryText) : null)).filter((v): v is string => Boolean(v)))];
      const resolved = [...new Set(named.map((n) => categoryByName.get(n)?.id).filter((v): v is string => Boolean(v)))];
      if (resolved.length === 1) category = categories.find((c) => c.id === resolved[0]) ?? null;
      else if (resolved.length > 1) categoryAmbiguous++;
      else categoryNone++;
    }

    if (modelKey) withNewKey++;
    if (proposals.length) withNewAttributes++;
    attributeRows += proposals.length;
    if (category) categoryProposals++;
    for (const p of proposals) perKey.set(p.attributeKey, (perKey.get(p.attributeKey) ?? 0) + 1);

    if (verbose && (modelKey || proposals.length || category)) {
      console.log(`${product.name.slice(0, 70)}\n    key=${modelKey ?? "(unchanged)"}  category=${category?.name ?? "-"}  ${proposals.map((p) => `${p.attributeKey}=${attributeValue(p)}`).join(" | ")}`);
    }

    if ((apply && (modelKey || proposals.length)) || (applyCategories && category)) {
      await inTransaction(ctx, async (c) => {
        if (apply && modelKey) await c.db.product.update({ where: { id: product.id }, data: { modelKey } });
        const count = apply ? await createParsedProductAttributes(c, product.id, proposals) : 0;
        if (apply && (modelKey || count)) {
          await writeAudit(c, { action: "product.specifications_read", entityType: "Product", entityId: product.id, details: { modelKey: { from: null, to: modelKey }, attributes: count, via: "backfill" } });
        }
        if (applyCategories && category) {
          await c.db.product.update({ where: { id: product.id }, data: { categoryId: category.id } });
          await writeAudit(c, { action: "product.updated", entityType: "Product", entityId: product.id, details: { category: { from: null, to: category.name }, via: "backfill" } });
        }
      });
      written++;
    }
  }

  console.log(`\n${apply || applyCategories ? "APPLIED" : "DRY RUN (nothing written)"}: ${products.length} products checked`);
  console.log(`  model key to set:            ${withNewKey}`);
  console.log(`  products gaining attributes: ${withNewAttributes} (${attributeRows} values)`);
  console.log(`  by attribute:                ${[...perKey.entries()].sort().map(([k, n]) => `${k} ${n}`).join(", ") || "none"}`);
  console.log(`  category to set:             ${categoryProposals} (ambiguous ${categoryAmbiguous}, none named ${categoryNone})`);
  if (apply || applyCategories) console.log(`  products written:            ${written}`);
  else console.log(`\nAdd --verbose to list every product. Write with --apply (model keys and attributes) and/or --apply-categories.`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
