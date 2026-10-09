import { requireActor } from "@/core/permissions/actor";
import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { Panel } from "@/components/application/page-canvas";
import { PageHeader } from "@/components/application/page-header";
import { EmptyState } from "@/components/application/states";
import { FilterBar } from "@/components/data-table/filter-bar";
import { FilterPill } from "@/components/data-table/filter-pill";
import { SearchInput } from "@/components/data-table/search-input";
import { TableShell } from "@/components/data-table/table-shell";
import { Button } from "@/components/ui/button";
import { STOCK_STATUS_LABEL, toOptions } from "@/lib/labels";
import { buildHref, firstParam } from "@/lib/search-params";
import { EvidenceDrawer } from "@/modules/evidence/components/evidence-drawer";
import { hasActiveSearchFilters, parseSearchFilters } from "@/modules/search/filters";
import { SearchResults } from "@/modules/search/components/search-results";
import { MAX_SEARCH_RESULTS, searchProcurement } from "@/modules/search/queries";
import { listBrandOptions, listCategoryOptions } from "@/modules/products/master-data.queries";
import { listSupplierOptions } from "@/modules/suppliers/queries";

export const metadata: Metadata = { title: "Search" };

const FRESHNESS_OPTIONS = [
  { value: "fresh", label: "Fresh (under 24h)" },
  { value: "recent", label: "Recent (under 7d)" },
  { value: "aging", label: "Aging (under 14d)" },
  { value: "stale", label: "Stale (14d+)" },
];

export default async function SearchPage(props: PageProps<"/search">) {
  await requireActor();
  const searchParams = await props.searchParams;
  const q = (firstParam(searchParams, "q") ?? "").trim();
  const filters = parseSearchFilters(searchParams);
  const { results, total, truncated } = await searchProcurement(q, filters);
  const evidenceHref = (observationId: string) => buildHref("/search", searchParams, { evidence: observationId });
  const clearFiltersHref = buildHref("/search", searchParams, { supplier: undefined, brand: undefined, category: undefined, stock: undefined, freshness: undefined });

  const [supplierOptions, brandOptions, categoryOptions] = results.length > 0 ? await Promise.all([listSupplierOptions(), listBrandOptions(), listCategoryOptions()]) : [[], [], []];

  return (
    <>
      <PageHeader title="Search" subtitle="Find a product by part number, model, alias or words, and see what suppliers have offered." />
      <Panel flush>
        <FilterBar clearHref="/search" hasActiveFilters={Boolean(q)}>
          <SearchInput placeholder="Part number, model, alias or words (e.g. 83A100SUAK, dell 5440)" className="w-[36rem]" inputClassName="h-11 text-base" />
          {q && results.length > 0 ? (
            <span className="num text-xs text-muted-foreground">
              {truncated ? `Showing the first ${MAX_SEARCH_RESULTS} of ${total} products. Add a word to narrow it.` : `${total} ${total === 1 ? "product" : "products"}`}
            </span>
          ) : null}
        </FilterBar>

        {q && results.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-4 py-3">
            <FilterPill param="supplier" label="Supplier" mode="single" options={supplierOptions} searchable />
            <FilterPill param="brand" label="Brand" mode="single" options={brandOptions} searchable />
            <FilterPill param="category" label="Category" mode="single" options={categoryOptions} searchable />
            <FilterPill param="stock" label="Stock" mode="single" options={toOptions(STOCK_STATUS_LABEL)} />
            <FilterPill param="freshness" label="Freshness" mode="single" options={FRESHNESS_OPTIONS} />
            {hasActiveSearchFilters(filters) ? (
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link href={clearFiltersHref}>
                  <X aria-hidden /> Clear filters
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}

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
