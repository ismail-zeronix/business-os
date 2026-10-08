import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { displayName } from "../display";
import type { KnowledgePage } from "../service";
import { MarkdownView } from "./markdown-view";

export type DocView = "preview" | "source";

const hrefFor = (docPath: string, view: DocView) => `/knowledge/${docPath.split("/").map(encodeURIComponent).join("/")}${view === "source" ? "?view=source" : ""}`;

/** The raw markdown with line numbers, like the text of an editor. Long lines scroll sideways instead of wrapping so numbers stay aligned. */
function SourceView({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  return (
    <div className="flex min-w-max font-mono text-[12.5px] leading-6">
      <div aria-hidden className="sticky left-0 shrink-0 bg-background py-3 pr-3 pl-4 text-right text-muted-foreground/60 select-none">
        {lines.map((_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <pre className="flex-1 py-3 pr-6 pl-3 whitespace-pre text-foreground/90">{content}</pre>
    </div>
  );
}

/**
 * The right-hand side of the Knowledge screen, laid out like a code editor (read only): a path breadcrumb with a Preview / Source switch,
 * the content, and a status bar. The open-tabs strip above this pane is `TabBar`, in the layout. Fills the height beside the explorer;
 * only the content scrolls.
 */
export function EditorPane({ doc, view }: { doc: KnowledgePage; view: DocView }) {
  const segments = doc.path.split("/");
  const lineCount = doc.content.split("\n").length;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b px-3">
        <nav aria-label="File path" className="flex min-w-0 items-center gap-0.5 overflow-hidden text-xs text-muted-foreground">
          {segments.map((segment, i) => (
            <span key={`${i}-${segment}`} className="flex min-w-0 items-center gap-0.5">
              {i > 0 ? <ChevronRight className="size-3 shrink-0" strokeWidth={1.5} aria-hidden /> : null}
              <span className={cn("truncate", i === segments.length - 1 && "text-foreground")}>{displayName(segment)}</span>
            </span>
          ))}
        </nav>
        <div className="flex shrink-0 rounded-md border p-0.5 text-xs" role="group" aria-label="View">
          {(["preview", "source"] as const).map((option) => (
            <Link
              key={option}
              href={hrefFor(doc.path, option)}
              aria-current={view === option ? "true" : undefined}
              className={cn("rounded px-2.5 py-0.5 capitalize transition-colors", view === option ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {option}
            </Link>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {view === "source" ? (
          <SourceView content={doc.content} />
        ) : (
          <div className="mx-auto max-w-3xl px-6 py-5">
            <MarkdownView content={doc.content} currentPath={doc.path} />
          </div>
        )}
      </div>

      <div className="flex h-6 shrink-0 items-center gap-4 border-t bg-surface px-3 text-[11px] text-muted-foreground">
        <span>Markdown</span>
        <span>{lineCount} lines</span>
        <span>Read only</span>
        <span className="ml-auto truncate">Updated {formatDateTime(doc.modifiedAt)}</span>
      </div>
    </div>
  );
}
