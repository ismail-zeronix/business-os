import { requireActor } from "@/core/permissions/actor";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/application/page-canvas";
import { PageHeader } from "@/components/application/page-header";
import { EmptyState } from "@/components/application/states";
import { FilterBar } from "@/components/data-table/filter-bar";
import { FilterSelect } from "@/components/data-table/filter-select";
import { Pagination } from "@/components/data-table/pagination";
import { SearchInput } from "@/components/data-table/search-input";
import { TableShell } from "@/components/data-table/table-shell";
import { FormDrawer } from "@/components/forms/form-drawer";
import { Button } from "@/components/ui/button";
import { RECORD_STATUS_LABEL, toOptions } from "@/lib/labels";
import { ProductForm } from "@/modules/products/components/product-form";
import { ProductsTable } from "@/modules/products/components/products-table";
import { hasActiveProductFilters, parseProductFilters } from "@/modules/products/filters";
import { listBrandOptions, listCategoryOptions } from "@/modules/products/master-data.queries";
import { searchProducts } from "@/modules/products/queries";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage(props: PageProps<"/products">) {
  await requireActor();
  const searchParams = await props.searchParams;
  const params = parseProductFilters(searchParams);
  const [{ rows, total }, brandOptions, categoryOptions] = await Promise.all([searchProducts(params), listBrandOptions(), listCategoryOptions()]);
  const filtered = hasActiveProductFilters(params);

  const addProduct = (
    <FormDrawer
      trigger={
        <Button size="sm">
          <Plus aria-hidden /> Add product
        </Button>
      }
      title="Add product"
      description="Only the name is required. Anything you do not know can stay blank."
    >
      <ProductForm brandOptions={brandOptions} categoryOptions={categoryOptions} />
    </FormDrawer>
  );

  return (
    <>
      <PageHeader title="Products" subtitle="Canonical products, their aliases, and what suppliers have offered." actions={addProduct} />

      <Panel flush>
      <FilterBar clearHref="/products" hasActiveFilters={filtered}>
        <SearchInput placeholder="Search name, model, part number, alias, brand" className="w-96" />
        <FilterSelect param="brand" allLabel="All brands" options={brandOptions} />
        <FilterSelect param="category" allLabel="All categories" options={categoryOptions} />
        <FilterSelect param="status" allLabel="Active and inactive" options={toOptions(RECORD_STATUS_LABEL)} />
        <FilterSelect param="temporary" allLabel="All products" options={[{ value: "1", label: "Temporary only" }]} />
      </FilterBar>

      {rows.length === 0 ? (
        <TableShell>
          {filtered ? (
            <EmptyState
              title="No products match"
              description="Try fewer words, a part number, or an alias. Or add the product."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/products">Clear filters</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState title="No products yet" description="Products appear here as you add them or create them while reviewing a supplier broadcast." action={addProduct} />
          )}
        </TableShell>
      ) : (
        <>
          <ProductsTable rows={rows} />
          <Pagination pathname="/products" searchParams={searchParams} page={params.page} total={total} />
        </>
      )}
      </Panel>
    </>
  );
}
