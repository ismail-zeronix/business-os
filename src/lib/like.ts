/**
 * Escapes user text for use inside a SQL LIKE / ILIKE pattern (Prisma's `contains`). Without this, a typed "%" or "_" acts as a wildcard
 * (so searching "%" matches everything) and a trailing "\" is an invalid pattern. PostgreSQL's default LIKE escape character is a backslash.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
