import path from "node:path";
import { z } from "zod";

/** The folder at the repo root that holds the knowledge base. Nothing outside it can be opened. */
export const KNOWLEDGE_DIR = "knowledge";

const MARKDOWN = /\.md$/i;

/** One URL segment of a page path: a plain name, never `.`, `..`, a separator or a drive letter. */
const segmentSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((s) => s !== "." && s !== ".." && !/[\\/\0:]/.test(s), "Invalid path.");

/** A page path as URL segments (relative to the knowledge folder): only .md files, a bounded depth. */
export const pagePathSchema = z
  .array(segmentSchema)
  .min(1)
  .max(8)
  .refine((segments) => MARKDOWN.test(segments[segments.length - 1]), "Only markdown files can be opened.");

/**
 * Turns URL segments into an absolute file path, or null when the request is not a markdown file inside the knowledge folder. Pure (no
 * disk access): the containment check is the security boundary, so it is kept here where it can be tested on its own.
 */
export function resolvePageFile(segments: string[], repoRoot: string): string | null {
  const parsed = pagePathSchema.safeParse(segments);
  if (!parsed.success) return null;

  const root = path.resolve(repoRoot, KNOWLEDGE_DIR);
  const file = path.resolve(root, ...parsed.data);
  const relative = path.relative(root, file);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? file : null;
}
