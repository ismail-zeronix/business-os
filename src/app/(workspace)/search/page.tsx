import { requireActor } from "@/core/permissions/actor";
import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/application/page-canvas";
import { PageHeader } from "@/components/application/page-header";
import { EmptyState } from "@/components/application/states";
import { FilterBar } from "@/components/data-table/filter-bar";
import { SearchInput } from "@/components/data-table/search-input";
import { TableShell } from "@/components/data-table/table-shell";
import { Button } from "@/components/ui/button";
import { buildHref, firstParam } from "@/lib/search-params";
import { EvidenceDrawer } from "@/modules/evidence/components/evidence-drawer";
import { SearchResults } from "@/modules/search/components/search-results";
import { MAX_SEARCH_RESULTS, searchProcurement } from "@/modules/search/queries";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage(props: PageProps<"/search">) {
  await requireActor();
  const searchParams = await props.searchParams;
  const q = (firstParam(searchParams, "q") ?? "").trim();
  const { results, total, truncated } = await searchProcurement(q);
  const evidenceHref = (observationId: string) => buildHref("/search", searchParams, { evidence: observationId });

  return (
    <>
      <PageHeader title="Search" subtitle="Find a product by part number, model, alias or words, and see what suppliers have offered." />

      <Panel flush>
        <FilterBar clearHref="/search" hasActiveFilters={Boolean(q)}>
          <SearchInput placeholder="Part number, model, alias or words (e.g. 83A100SUAK, dell 5440)" className="w-[32rem]" />
          {q && results.length > 0 ? (
            <span className="num text-xs text-muted-foreground">
              {truncated ? `Showing the first ${MAX_SEARCH_RESULTS} of ${total} products. Add a word to narrow it.` : `${total} ${total === 1 ? "product" : "products"}`}
            </span>
          ) : null}
        </FilterBar>

        {!q ? (
          <TableShell>
            <EmptyState title="Search for a product" description="Enter a part number, model, alias or a few words. You will see each matching product with the latest price and stock every supplier has told us, and how old that is." />
          </TableShell>
        ) : results.length === 0 ? (
          <TableShell>
            <EmptyState
              title="No products match"
              description="Try fewer words, a part number, or an alias. A product must exist in Products before its supplier prices can appear here."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/products">Open Products</Link>
                </Button>
              }
            />
          </TableShell>
        ) : (
          <SearchResults results={results} evidenceHref={evidenceHref} />
        )}
      </Panel>

      <EvidenceDrawer observationId={firstParam(searchParams, "evidence")} closeHref={buildHref("/search", searchParams, { evidence: undefined })} />
    </>
  );
}
