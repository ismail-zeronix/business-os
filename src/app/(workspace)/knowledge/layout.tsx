import { ErrorState } from "@/components/application/states";
import { getServiceContext, requireActor } from "@/core/permissions/actor";
import { DocTree } from "@/modules/knowledge/components/doc-tree";
import { TabBar } from "@/modules/knowledge/components/tab-bar";
import { listKnowledgeTree, type KnowledgeNode } from "@/modules/knowledge/service";

/**
 * Knowledge, laid out like a code editor: an explorer (folder tree of every markdown file) on the left and the open file filling the rest of
 * the height. It uses the whole area under the top navbar, so only the explorer and the file scroll.
 */
export default async function KnowledgeLayout({ children }: LayoutProps<"/knowledge">) {
  await requireActor();
  let tree: KnowledgeNode[] | null = null;
  try {
    tree = await listKnowledgeTree(await getServiceContext());
  } catch (error) {
    console.error("knowledge: could not list the pages", error);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside aria-label="Explorer" className="flex max-h-64 w-full shrink-0 flex-col border-b bg-zinc-50/70 md:max-h-none md:w-72 md:border-r md:border-b-0">
        <div className="flex h-9 shrink-0 items-center border-b px-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Explorer</div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {tree === null ? <ErrorState title="Could not read the knowledge pages" message="Try again in a moment." /> : <DocTree tree={tree} />}
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TabBar />
        {children}
      </div>
    </div>
  );
}
