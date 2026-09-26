"use client";

import { ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { displayName } from "../display";
import type { KnowledgeNode } from "../service";

const hrefFor = (docPath: string) => `/knowledge/${docPath.split("/").map(encodeURIComponent).join("/")}`;

/** The folder paths that lead to the open document, so the tree starts opened on it. */
function ancestors(docPath: string): string[] {
  const parts = docPath.split("/").slice(0, -1);
  return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
}

function Node({ node, depth, active, open, toggle }: { node: KnowledgeNode; depth: number; active: string; open: Set<string>; toggle: (path: string) => void }) {
  const indent = { paddingLeft: `${depth * 12 + 8}px` };
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
          <span className="truncate">{displayName(node.name)}</span>
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
        <span className="truncate">{displayName(node.name)}</span>
      </button>
      {isOpen ? (
        <ul>
          {node.children.map((child) => (
            <Node key={child.path} node={child} depth={depth + 1} active={active} open={open} toggle={toggle} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** The knowledge explorer: a collapsible folder tree of every markdown file. Folders open on the current document; the rest stay closed. */
export function DocTree({ tree }: { tree: KnowledgeNode[] }) {
  const pathname = usePathname();
  const active = decodeURIComponent(pathname.replace(/^\/knowledge\/?/, ""));
  const [open, setOpen] = useState<Set<string>>(() => new Set(ancestors(active)));
  const toggle = (folder: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(folder)) next.add(folder);
      return next;
    });

  return (
    <nav aria-label="Knowledge pages">
      <ul className="space-y-0.5">
        {tree.map((node) => (
          <Node key={node.path} node={node} depth={0} active={active} open={open} toggle={toggle} />
        ))}
      </ul>
    </nav>
  );
}
