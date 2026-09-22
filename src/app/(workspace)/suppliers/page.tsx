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
import { RECORD_STATUS_LABEL, SUPPLIER_TYPE_LABEL, toOptions } from "@/lib/labels";
import { listBrandOptions, listCategoryOptions } from "@/modules/products/master-data.queries";
import { SupplierForm } from "@/modules/suppliers/components/supplier-form";
import { SuppliersTable } from "@/modules/suppliers/components/suppliers-table";
import { hasActiveSupplierFilters, parseSupplierFilters } from "@/modules/suppliers/filters";
import { listSuppliers } from "@/modules/suppliers/queries";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage(props: PageProps<"/suppliers">) {
  await requireActor();
  const searchParams = await props.searchParams;
  const params = parseSupplierFilters(searchParams);
  const [{ rows, total }, brandOptions, categoryOptions] = await Promise.all([listSuppliers(params), listBrandOptions(), listCategoryOptions()]);
  const filtered = hasActiveSupplierFilters(params);

  const addSupplier = (
    <FormDrawer
      trigger={
        <Button size="sm">
          <Plus aria-hidden /> Add supplier
        </Button>
      }
      title="Add supplier"
      description="Only the name is required. Anything you do not know can stay blank."
    >
      <SupplierForm brandOptions={brandOptions} categoryOptions={categoryOptions} />
    </FormDrawer>
  );

  return (
    <>
      <PageHeader title="Suppliers" subtitle="Procurement capability: who supplies what, on which terms." actions={addSupplier} />

      <Panel flush>
      <FilterBar clearHref="/suppliers" hasActiveFilters={filtered}>
        <SearchInput placeholder="Search suppliers, contacts, brands" />
        <FilterSelect param="status" allLabel="Active and inactive" options={toOptions(RECORD_STATUS_LABEL)} />
        <FilterSelect param="type" allLabel="All types" options={toOptions(SUPPLIER_TYPE_LABEL)} />
        <FilterSelect param="brand" allLabel="All brands" options={brandOptions} />
        <FilterSelect param="category" allLabel="All categories" options={categoryOptions} />
      </FilterBar>

      {rows.length === 0 ? (
        <TableShell>
          {filtered ? (
            <EmptyState
              title="No suppliers match these filters"
              description="Try a different search, or clear the filters."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/suppliers">Clear filters</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState title="No suppliers yet" description="Add your first supplier to start recording contacts and broadcasts." action={addSupplier} />
          )}
        </TableShell>
      ) : (
        <>
          <SuppliersTable rows={rows} />
          <Pagination pathname="/suppliers" searchParams={searchParams} page={params.page} total={total} />
        </>
      )}
      </Panel>
    </>
  );
}
