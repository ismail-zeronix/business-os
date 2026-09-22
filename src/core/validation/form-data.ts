/**
 * Turns FormData into a plain object for zod. A key that appears once becomes a string; a repeated key (multi-select checkboxes,
 * repeated hidden inputs) becomes an array. Files are not expected in this application; only string values are kept.
 */
export function formDataToObject(formData: FormData): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key).filter((value): value is string => typeof value === "string");
    if (values.length === 0) continue;
    result[key] = values.length === 1 ? values[0]! : values;
  }
  return result;
}
