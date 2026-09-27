import { ConflictError, InvariantError, NotFoundError, ValidationError } from "../../core/errors";
import { inTransaction, type ServiceContext } from "../../core/database/tx";
import type { Prisma } from "../../generated/prisma/client";
import { writeAudit } from "../audit/service";
import { extractRequirements, requirementSourceText } from "../specs/extract";
import { requirementLabel, requirementValue } from "../specs/format";
import { parseCpu } from "../specs/normalize/cpu";
import { getAttribute, optionLabel, type AttributeSpec } from "../specs/registry";
import type { ProposedRequirement, RequirementOperator } from "../specs/types";
import type { RequirementAddInput, RequirementReextractInput, RequirementReplaceInput, RequirementRetractInput } from "./requirement.schemas";
import { enquiryScope, requireNotArchived, touchEnquiry } from "./shared";

/**
 * Structured specification requirements of an enquiry item. The parser proposes them (source PARSER) when the enquiry is created; a
 * person adds, changes or removes them while the item is PENDING. Rows are append-only: an edit RETRACTS the active row and writes a HUMAN
 * row, so the parser's value stays in history and the human value is the one in force (the database allows only retraction).
 * Everything is audited in the same transaction, scoped to the enquiry. Nothing here touches the item's own fields or its product link.
 */

type RequirementRow = Prisma.EnquiryRequirementGetPayload<object>;

/** The active requirement's values as plain data (numbers, not Decimals), for wording and diffs. */
function plain(row: Pick<RequirementRow, "attributeKey" | "operator" | "valueText" | "valueNum" | "valueNumMax" | "valueList" | "unit">) {
  return {
    attributeKey: row.attributeKey,
    operator: row.operator,
    valueText: row.valueText,
    valueNum: row.valueNum === null ? null : Number(row.valueNum),
    valueNumMax: row.valueNumMax === null ? null : Number(row.valueNumMax),
    valueList: row.valueList ?? [],
    unit: row.unit,
  };
}
const describeRow = (row: Parameters<typeof plain>[0]) => requirementValue(plain(row));

async function loadPendingItem(c: ServiceContext, itemId: string) {
  const item = await c.db.enquiryItem.findUnique({
    where: { id: itemId },
    select: { id: true, enquiryId: true, reviewStatus: true, sourceText: true, description: true, specText: true, enquiry: { select: { archivedAt: true } } },
  });
  if (!item) throw new NotFoundError("Requirement");
  requireNotArchived(item.enquiry);
  if (item.reviewStatus !== "PENDING") throw new InvariantError("This requirement is already reviewed. Reopen it to make changes.");
  return item;
}

async function loadActiveRequirement(c: ServiceContext, id: string) {
  const row = await c.db.enquiryRequirement.findUnique({ where: { id }, include: { enquiryItem: { select: { id: true, enquiryId: true, reviewStatus: true, enquiry: { select: { archivedAt: true } } } } } });
  if (!row) throw new NotFoundError("Specification requirement");
  if (row.retractedAt) throw new InvariantError("This specification requirement was already replaced or removed. Reload the page.");
  requireNotArchived(row.enquiryItem.enquiry);
  if (row.enquiryItem.reviewStatus !== "PENDING") throw new InvariantError("This requirement is already reviewed. Reopen it to make changes.");
  return row;
}

/** What a person typed -> the typed columns for the attribute. Throws a field-level ValidationError when it cannot be read. */
export function buildRequirementValue(
  spec: AttributeSpec,
  input: { operator: RequirementOperator; value: string | null; valueMax: string | null; valueList: string[] },
): Pick<ProposedRequirement, "valueText" | "valueNum" | "valueNumMax" | "valueList" | "unit" | "rawValue"> {
  if (!spec.operators.includes(input.operator)) throw new ValidationError(`${spec.label} cannot be compared that way.`, { operator: "Choose another comparison" });
  const empty = { valueText: null, valueNum: null, valueNumMax: null, valueList: [] as string[], unit: spec.unit };

  if (spec.kind === "NUMBER") {
    const parse = (raw: string | null, field: string) => {
      const value = Number((raw ?? "").replace(/,/g, ""));
      if (!raw || !Number.isFinite(value) || value <= 0) throw new ValidationError("Enter a number above zero.", { [field]: "Enter a number above zero" });
      return Math.round(value * 100) / 100;
    };
    const valueNum = parse(input.value, "value");
    const valueNumMax = input.operator === "BETWEEN" ? parse(input.valueMax, "valueMax") : null;
    if (valueNumMax !== null && valueNumMax < valueNum) throw new ValidationError("The upper value must not be below the lower value.", { valueMax: "Must be at least the lower value" });
    return { ...empty, valueNum, valueNumMax, rawValue: valueNumMax !== null ? `${valueNum}-${valueNumMax}${spec.unit ? ` ${spec.unit}` : ""}` : `${valueNum}${spec.unit ? ` ${spec.unit}` : ""}` };
  }

  if (spec.kind === "LIST") {
    const allowed = new Set(spec.options?.map((o) => o.value));
    const valueList = [...new Set(input.valueList)].filter((v) => allowed.has(v)).sort();
    if (valueList.length === 0) throw new ValidationError(`Choose at least one ${spec.label.toLowerCase()}.`, { valueList: "Choose at least one" });
    return { ...empty, valueList, rawValue: valueList.map((v) => optionLabel(spec, v)).join(", ") };
  }

  // TEXT: the CPU is read into its canonical form; every other text attribute is a choice from its list.
  const typed = input.value?.trim() ?? "";
  if (!typed) throw new ValidationError(`Enter the ${spec.label.toLowerCase()}.`, { value: "Required" });
  if (spec.key === "cpu") {
    const cpu = parseCpu(typed);
    if (!cpu) throw new ValidationError("That CPU could not be read. Try a form such as Core Ultra 7 256V, i7-1355U or Ryzen 7 7730U.", { value: "Not recognised as a CPU" });
    return { ...empty, valueText: cpu.value.canonical, rawValue: typed };
  }
  if (!spec.options?.some((o) => o.value === typed)) throw new ValidationError(`Choose one of the listed options.`, { value: "Choose from the list" });
  return { ...empty, valueText: typed, rawValue: optionLabel(spec, typed) };
}

const toCreateData = (itemId: string, actorId: string, source: "PARSER" | "HUMAN", proposal: ProposedRequirement): Prisma.EnquiryRequirementUncheckedCreateInput => ({
  enquiryItemId: itemId,
  attributeKey: proposal.attributeKey,
  operator: proposal.operator,
  importance: proposal.importance,
  rawValue: proposal.rawValue,
  valueText: proposal.valueText,
  valueNum: proposal.valueNum,
  valueNumMax: proposal.valueNumMax,
  valueList: proposal.valueList ?? [],
  unit: proposal.unit,
  confidence: proposal.confidence,
  source,
  createdById: actorId,
});

/** Writes the parser's proposals for a new item. Called while the enquiry is created, so it is part of that transaction and audit entry. */
export async function createParsedRequirements(c: ServiceContext, itemId: string, proposals: readonly ProposedRequirement[]): Promise<number> {
  if (proposals.length === 0) return 0;
  const result = await c.db.enquiryRequirement.createMany({ data: proposals.map((p) => toCreateData(itemId, c.actor.id, "PARSER", p)) });
  return result.count;
}

/** The parser's proposals for an item's current wording. */
export const proposeRequirementsForItem = (item: { sourceText: string; description: string | null; specText: string | null }) => extractRequirements(requirementSourceText(item));

// ───────────────────────────────────────── person's changes ─────────────────────────────────────────

export async function addRequirement(ctx: ServiceContext, input: RequirementAddInput) {
  return inTransaction(ctx, async (c) => {
    const item = await loadPendingItem(c, input.itemId);
    const spec = getAttribute(input.attributeKey);
    if (!spec) throw new ValidationError("Choose a specification.", { attributeKey: "Unknown specification" });

    const active = await c.db.enquiryRequirement.findFirst({ where: { enquiryItemId: item.id, attributeKey: spec.key, retractedAt: null }, select: { id: true } });
    if (active) throw new ConflictError(`This requirement already has a ${spec.label.toLowerCase()}. Edit it instead.`, { attributeKey: "Already has one" });

    const value = buildRequirementValue(spec, input);
    const created = await c.db.enquiryRequirement.create({ data: toCreateData(item.id, ctx.actor.id, "HUMAN", { attributeKey: spec.key, operator: input.operator, importance: input.importance, confidence: "HIGH", ...value }) });
    await writeAudit(c, {
      action: "enquiry_requirement.added",
      entityType: "EnquiryRequirement",
      entityId: created.id,
      scope: enquiryScope(item.enquiryId),
      details: { specification: spec.label, value: describeRow(created), importance: input.importance },
    });
    await touchEnquiry(c, item.enquiryId);
    return { id: created.id, enquiryId: item.enquiryId };
  });
}

/** A person's edit: the active row is retracted (kept in history) and a HUMAN row takes its place. */
export async function replaceRequirement(ctx: ServiceContext, input: RequirementReplaceInput) {
  return inTransaction(ctx, async (c) => {
    const old = await loadActiveRequirement(c, input.id);
    const spec = getAttribute(old.attributeKey);
    if (!spec) throw new ValidationError("This specification is no longer supported.", {});

    const value = buildRequirementValue(spec, input);
    await c.db.enquiryRequirement.update({ where: { id: old.id }, data: { retractedAt: new Date(), retractedById: ctx.actor.id, retractionReason: "Changed by a person" } });
    const created = await c.db.enquiryRequirement.create({ data: toCreateData(old.enquiryItemId, ctx.actor.id, "HUMAN", { attributeKey: spec.key, operator: input.operator, importance: input.importance, confidence: "HIGH", ...value }) });

    const details: Record<string, Prisma.InputJsonValue> = { specification: spec.label, value: { from: describeRow(old), to: describeRow(created) } };
    if (old.importance !== input.importance) details.importance = { from: old.importance, to: input.importance };
    await writeAudit(c, { action: "enquiry_requirement.replaced", entityType: "EnquiryRequirement", entityId: created.id, scope: enquiryScope(old.enquiryItem.enquiryId), details });
    await touchEnquiry(c, old.enquiryItem.enquiryId);
    return { id: created.id, enquiryId: old.enquiryItem.enquiryId };
  });
}

export async function retractRequirement(ctx: ServiceContext, input: RequirementRetractInput) {
  return inTransaction(ctx, async (c) => {
    const old = await loadActiveRequirement(c, input.id);
    await c.db.enquiryRequirement.update({ where: { id: old.id }, data: { retractedAt: new Date(), retractedById: ctx.actor.id, retractionReason: input.reason ?? "Removed by a person" } });
    await writeAudit(c, {
      action: "enquiry_requirement.retracted",
      entityType: "EnquiryRequirement",
      entityId: old.id,
      scope: enquiryScope(old.enquiryItem.enquiryId),
      details: { specification: requirementLabel(old.attributeKey), value: describeRow(old), ...(input.reason ? { reason: input.reason } : {}) },
    });
    await touchEnquiry(c, old.enquiryItem.enquiryId);
    return { id: old.id, enquiryId: old.enquiryItem.enquiryId };
  });
}

/**
 * Reads the item's wording again and proposes requirements. A specification a person has already set (HUMAN) is never touched; a parsed
 * one is replaced only when the new reading differs. A specification the text no longer shows is left alone: not finding it is not proof.
 */
export async function reextractRequirements(ctx: ServiceContext, input: RequirementReextractInput) {
  return inTransaction(ctx, async (c) => {
    const item = await loadPendingItem(c, input.itemId);
    const proposals = proposeRequirementsForItem(item);
    const active = await c.db.enquiryRequirement.findMany({ where: { enquiryItemId: item.id, retractedAt: null } });
    const byKey = new Map(active.map((r) => [r.attributeKey, r]));

    let added = 0;
    let updated = 0;
    for (const proposal of proposals) {
      const current = byKey.get(proposal.attributeKey);
      if (current?.source === "HUMAN") continue;
      if (current) {
        const same = describeRow(current) === requirementValue({ ...proposal, valueList: proposal.valueList ?? [] }) && current.importance === proposal.importance;
        if (same) continue;
        await c.db.enquiryRequirement.update({ where: { id: current.id }, data: { retractedAt: new Date(), retractedById: ctx.actor.id, retractionReason: "Read again from the text" } });
        updated++;
      } else added++;
      await c.db.enquiryRequirement.create({ data: toCreateData(item.id, ctx.actor.id, "PARSER", proposal) });
    }

    if (added || updated) {
      await writeAudit(c, { action: "enquiry_requirement.extracted", entityType: "EnquiryItem", entityId: item.id, scope: enquiryScope(item.enquiryId), details: { added, updated } });
      await touchEnquiry(c, item.enquiryId);
    }
    return { added, updated, enquiryId: item.enquiryId };
  });
}
