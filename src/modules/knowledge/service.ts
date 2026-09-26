import { promises as fs } from "node:fs";
import path from "node:path";
import type { ServiceContext } from "@/core/database/tx";
import { NotFoundError } from "@/core/errors";
import { KNOWLEDGE_DIR, resolvePageFile } from "./paths";

/**
 * Read-only access to the Zeronix knowledge base: the markdown files in the `knowledge/` folder (what the company is, its services, the
 * sales team's work, and the instructions any AI module must follow). The files on disk are the source of truth (they live in git);
 * nothing is copied to the database. Every signed-in user may read it. Writing (new file / folder / edit) is a later slice and would be
 * added here, admin only and audited.
 */

export type KnowledgeNode = { type: "folder"; name: string; path: string; children: KnowledgeNode[] } | { type: "file"; name: string; path: string };
export type KnowledgePage = { path: string; name: string; content: string; modifiedAt: Date };

const MAX_BYTES = 1_000_000;
const repoRoot = () => process.cwd();
const isMarkdown = (name: string) => /\.md$/i.test(name);
const byName = (a: KnowledgeNode, b: KnowledgeNode) => a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" });
const isReadme = (node: KnowledgeNode) => node.name.toLowerCase() === "readme.md";

async function walk(dir: string, urlPrefix: string): Promise<KnowledgeNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodes: KnowledgeNode[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const urlPath = urlPrefix ? `${urlPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const children = await walk(path.join(dir, entry.name), urlPath);
      if (children.length > 0) nodes.push({ type: "folder", name: entry.name, path: urlPath, children });
    } else if (entry.isFile() && isMarkdown(entry.name)) {
      nodes.push({ type: "file", name: entry.name, path: urlPath });
    }
  }
  const folders = nodes.filter((n) => n.type === "folder").sort(byName);
  const files = nodes.filter((n) => n.type === "file").sort(byName);
  return [...files.filter(isReadme), ...folders, ...files.filter((n) => !isReadme(n))];
}

/** Every markdown page as a folder tree (a README first, then folders, then files; empty folders are left out). */
export async function listKnowledgeTree(ctx: ServiceContext): Promise<KnowledgeNode[]> {
  void ctx; // any signed-in actor may read; the context is here so a permission rule can be added without touching the pages
  return walk(path.join(repoRoot(), KNOWLEDGE_DIR), "").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
}

/** One page by its URL segments. NotFoundError for anything that is not a markdown file inside the knowledge folder. */
export async function readKnowledgePage(ctx: ServiceContext, segments: string[]): Promise<KnowledgePage> {
  void ctx;
  const file = resolvePageFile(segments, repoRoot());
  if (!file) throw new NotFoundError("Page");
  const stat = await fs.stat(file).catch(() => null);
  if (!stat || !stat.isFile()) throw new NotFoundError("Page");
  if (stat.size > MAX_BYTES) throw new NotFoundError("Page", "This page is too large to show here.");
  return { path: segments.join("/"), name: path.basename(file), content: await fs.readFile(file, "utf8"), modifiedAt: stat.mtime };
}
