/**
 * Field-level change detection for audit details. Produces `{ field: { from, to } }` containing ONLY the fields that changed.
 * Values are made JSON-safe (Decimal -> string, Date -> ISO string) and null/undefined are treated as the same "unknown".
 */

export type FieldChange = { from: string | number | boolean | null; to: string | number | boolean | null };

function toComparable(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value); // Prisma.Decimal and other objects with a meaningful toString()
}

export function diffFields<T extends object>(before: T, after: { [K in keyof T]?: unknown }, fields: readonly (keyof T)[]): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};
  for (const field of fields) {
    if (!(field in after)) continue;
    const from = toComparable(before[field]);
    const to = toComparable(after[field]);
    if (from !== to) changes[String(field)] = { from, to };
  }
  return changes;
}

export function hasChanges(changes: Record<string, FieldChange>): boolean {
  return Object.keys(changes).length > 0;
}
