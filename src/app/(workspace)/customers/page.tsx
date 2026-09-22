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
import { CustomerForm } from "@/modules/customers/components/customer-form";
import { CustomersTable } from "@/modules/customers/components/customers-table";
import { hasActiveCustomerFilters, parseCustomerFilters } from "@/modules/customers/filters";
import { listCustomers } from "@/modules/customers/queries";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage(props: PageProps<"/customers">) {
  await requireActor();
  const searchParams = await props.searchParams;
  const params = parseCustomerFilters(searchParams);
  const { rows, total } = await listCustomers(params);
  const filtered = hasActiveCustomerFilters(params);

  const addCustomer = (
    <FormDrawer
      trigger={
        <Button size="sm">
          <Plus aria-hidden /> Add customer
        </Button>
      }
      title="Add customer"
      description="Only the name is required. Anything you do not know can stay blank."
    >
      <CustomerForm />
    </FormDrawer>
  );

  return (
    <>
      <PageHeader title="Customers" subtitle="Who sends us requests, and the people behind each customer." actions={addCustomer} />

      <Panel flush>
      <FilterBar clearHref="/customers" hasActiveFilters={filtered}>
        <SearchInput placeholder="Search customers and contacts" />
        <FilterSelect param="status" allLabel="Active and inactive" options={toOptions(RECORD_STATUS_LABEL)} />
      </FilterBar>

      {rows.length === 0 ? (
        <TableShell>
          {filtered ? (
            <EmptyState
              title="No customers match these filters"
              description="Try a different search, or clear the filters."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/customers">Clear filters</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState title="No customers yet" description="Add a customer, or save the sender of an enquiry as a customer." action={addCustomer} />
          )}
        </TableShell>
      ) : (
        <>
          <CustomersTable rows={rows} />
          <Pagination pathname="/customers" searchParams={searchParams} page={params.page} total={total} />
        </>
      )}
      </Panel>
    </>
  );
}
