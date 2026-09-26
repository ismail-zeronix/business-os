import type { Metadata } from "next";
import { connection } from "next/server";
import { EmptyState } from "@/components/application/states";
import { NotFoundError } from "@/core/errors";
import { getServiceContext, requireActor } from "@/core/permissions/actor";
import { firstParam } from "@/lib/search-params";
import { EditorPane } from "@/modules/knowledge/components/editor-pane";
import { readKnowledgePage } from "@/modules/knowledge/service";

export async function generateMetadata(props: PageProps<"/knowledge/[...path]">): Promise<Metadata> {
  const { path } = await props.params;
  return { title: `${path[path.length - 1]} · Knowledge` };
}

/** One markdown page in the editor-style pane. A missing, invalid or non-markdown path shows a plain "not found" (the service refuses it). */
export default async function KnowledgeFilePage(props: PageProps<"/knowledge/[...path]">) {
  await requireActor();
  await connection(); // the files change while the app runs: never prerender them
  const [{ path }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const view = firstParam(searchParams, "view") === "source" ? "source" : "preview";

  const doc = await readKnowledgePage(await getServiceContext(), path).catch((error: unknown) => {
    if (error instanceof NotFoundError) return error;
    throw error;
  });

  if (doc instanceof NotFoundError) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center bg-background">
        <EmptyState title="Page not found" description={doc.message} />
      </div>
    );
  }
  return <EditorPane doc={doc} view={view} />;
}
