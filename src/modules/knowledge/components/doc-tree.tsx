"use client";

import { ChevronRight, FileText, Folder, FolderOpen, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { displayName } from "../display";
import type { KnowledgeNode } from "../service";

const hrefFor = (docPath: string) => `/knowledge/${docPath.split("/").map(encodeURIComponent).join("/")}`;

/** The folder paths that lead to the open document, so the tree starts opened on it. */
function ancestors(docPath: string): string[] {
  const parts = docPath.split("/").slice(0, -1);
  return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
}

/** `name` with every case-insensitive occurrence of `query` wrapped for a soft highlight. No-op when `query` is empty. */
function Highlighted({ name, query }: { name: string; query: string }) {
  if (!query) return <>{name}</>;
  const parts = name.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-brand/15 text-foreground">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** Every node whose display name matches `query`, or a folder with at least one matching descendant (kept whole if the folder itself matches). */
function filterTree(nodes: KnowledgeNode[], query: string): KnowledgeNode[] {
  const result: KnowledgeNode[] = [];
  for (const node of nodes) {
    const matchesSelf = displayName(node.name).toLowerCase().includes(query);
    if (node.type === "file") {
      if (matchesSelf) result.push(node);
      continue;
    }
    const children = matchesSelf ? node.children : filterTree(node.children, query);
    if (matchesSelf || children.length > 0) result.push({ ...node, children });
  }
  return result;
}

function folderPaths(nodes: KnowledgeNode[]): string[] {
  return nodes.flatMap((node) => (node.type === "folder" ? [node.path, ...folderPaths(node.children)] : []));
}

function Node({ node, depth, active, open, toggle, query }: { node: KnowledgeNode; depth: number; active: string; open: Set<string>; toggle: (path: string) => void; query: string }) {
  const indent = { paddingLeft: `${depth * 12 + 8}px` };
  const label = displayName(node.name);
  if (node.type === "file") {
    const isActive = node.path === active;
    return (
      <li>
        <Link
          href={hrefFor(node.path)}
          aria-current={isActive ? "page" : undefined}
          style={indent}
          className={cn(
            "flex h-7 items-center gap-2 rounded-md pr-2 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
            isActive ? "bg-zinc-100 font-medium text-foreground" : "text-foreground/70 hover:bg-zinc-50 hover:text-foreground",
          )}
        >
          <FileText className={cn("size-3.5 shrink-0", isActive && "text-brand")} strokeWidth={1.5} aria-hidden />
          <span className="truncate">
            <Highlighted name={label} query={query} />
          </span>
        </Link>
      </li>
    );
  }
  const isOpen = open.has(node.path);
  const FolderIcon = isOpen ? FolderOpen : Folder;
  return (
    <li>
      <button
        type="button"
        onClick={() => toggle(node.path)}
        aria-expanded={isOpen}
        style={indent}
        className="flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left text-[13px] font-medium text-foreground/80 outline-none transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <ChevronRight className={cn("size-3 shrink-0 transition-transform", isOpen && "rotate-90")} strokeWidth={1.5} aria-hidden />
        <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        <span className="truncate">
          <Highlighted name={label} query={query} />
        </span>
      </button>
      {isOpen ? (
        <ul>
          {node.children.map((child) => (
            <Node key={child.path} node={child} depth={depth + 1} active={active} open={open} toggle={toggle} query={query} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * The knowledge explorer: a search box, then a collapsible folder tree of every markdown file. Folders open on the current document; the
 * rest stay closed. Typing filters by page name (matching folders auto-expand); "/" from anywhere in the explorer focuses the search box.
 */
export function DocTree({ tree }: { tree: KnowledgeNode[] }) {
  const pathname = usePathname();
  const active = decodeURIComponent(pathname.replace(/^\/knowledge\/?/, ""));
  const [open, setOpen] = useState<Set<string>>(() => new Set(ancestors(active)));
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const toggle = (folder: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(folder)) next.add(folder);
      return next;
    });

  const trimmed = query.trim().toLowerCase();
  const filtered = useMemo(() => (trimmed ? filterTree(tree, trimmed) : tree), [tree, trimmed]);
  const effectiveOpen = useMemo(() => (trimmed ? new Set(folderPaths(filtered)) : open), [trimmed, filtered, open]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex h-7 shrink-0 items-center gap-1.5 rounded-md border bg-background px-2 focus-within:ring-2 focus-within:ring-ring/60">
        <Search className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pages…"
          aria-label="Search knowledge pages"
          className="h-full w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-zinc-100 hover:text-foreground">
            <X className="size-3.5" strokeWidth={1.5} aria-hidden />
          </button>
        ) : null}
      </div>

      {trimmed && filtered.length === 0 ? (
        <p className="px-2 py-3 text-xs text-muted-foreground">No pages match &ldquo;{query.trim()}&rdquo;.</p>
      ) : (
        <nav aria-label="Knowledge pages" className="min-h-0 flex-1">
          <ul className="space-y-0.5">
            {filtered.map((node) => (
              <Node key={node.path} node={node} depth={0} active={active} open={effectiveOpen} toggle={toggle} query={trimmed} />
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
