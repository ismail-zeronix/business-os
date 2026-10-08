import Link from "next/link";
import path from "node:path";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/** A link inside a document: a relative link to another .md file opens it in the Knowledge screen; an external link opens in a new tab. */
function linkFor(currentPath: string): Components["a"] {
  return function DocLink({ href, children }) {
    if (!href) return <span>{children}</span>;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    }
    if (href.startsWith("#")) return <a href={href}>{children}</a>;
    const [file, hash] = href.split("#");
    if (/\.md$/i.test(file)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(currentPath), file));
      if (!target.startsWith("..")) {
        return <Link href={`/knowledge/${target.split("/").map(encodeURIComponent).join("/")}${hash ? `#${hash}` : ""}`}>{children}</Link>;
      }
    }
    return <span>{children}</span>; // a relative link to source code or an image: nothing to open here
  };
}

/** Styles for rendered markdown, scoped to this wrapper (no typography plugin in the project). Compact, per docs/design/UI_SYSTEM.md. */
const STYLES = [
  "text-sm leading-relaxed text-foreground/90 break-words",
  "[&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-foreground",
  "[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:pb-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground",
  "[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground",
  "[&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-sm [&_h4]:font-medium [&_h4]:text-foreground",
  "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
  "[&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]",
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_table]:my-3 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-[13px]",
  "[&_th]:border [&_th]:bg-surface [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top",
  "[&_hr]:my-4",
].join(" ");

/** Renders one markdown document. Raw HTML inside the markdown is not rendered (react-markdown's safe default). */
export function MarkdownView({ content, currentPath }: { content: string; currentPath: string }) {
  return (
    <div className={STYLES}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: linkFor(currentPath) }}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
