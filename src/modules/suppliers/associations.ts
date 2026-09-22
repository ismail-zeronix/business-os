import { ValidationError } from "../../core/errors";
import type { ServiceContext } from "../../core/database/tx";

/** Which ids to add and which to remove to turn `current` into `desired`. Order of `desired` is preserved for additions. */
export function diffIds(current: readonly string[], desired: readonly string[]) {
  const currentSet = new Set(current);
  const desiredSet = new Set(desired);
  return {
    toAdd: desired.filter((id) => !currentSet.has(id)),
    toRemove: current.filter((id) => !desiredSet.has(id)),
  };
}

/**
 * Validates a selection of brands: every id must exist, and an ARCHIVED brand may only stay if it was already linked
 * (it can't be newly assigned). Returns id/name pairs for audit details.
 */
export async function requireBrands(c: ServiceContext, ids: readonly string[], alreadyLinked: readonly string[]) {
  if (ids.length === 0) return [];
  const rows = await c.db.brand.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, status: true } });
  if (rows.length !== ids.length) throw new ValidationError("One or more selected brands no longer exist.");
  const blocked = rows.find((r) => r.status === "ARCHIVED" && !alreadyLinked.includes(r.id));
  if (blocked) throw new ValidationError(`Brand "${blocked.name}" is archived and cannot be newly assigned.`);
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

export async function requireCategories(c: ServiceContext, ids: readonly string[], alreadyLinked: readonly string[]) {
  if (ids.length === 0) return [];
  const rows = await c.db.category.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, status: true } });
  if (rows.length !== ids.length) throw new ValidationError("One or more selected categories no longer exist.");
  const blocked = rows.find((r) => r.status === "ARCHIVED" && !alreadyLinked.includes(r.id));
  if (blocked) throw new ValidationError(`Category "${blocked.name}" is archived and cannot be newly assigned.`);
  return rows.map((r) => ({ id: r.id, name: r.name }));
}
