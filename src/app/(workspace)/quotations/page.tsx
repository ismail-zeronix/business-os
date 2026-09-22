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
import { QUOTATION_STATUS_LABEL, toOptions } from "@/lib/labels";
import { listCustomerOptions } from "@/modules/customers/queries";
import { NewQuotationForm } from "@/modules/quotations/components/new-quotation-form";
import { QuotationsTable } from "@/modules/quotations/components/quotations-table";
import { hasActiveQuotationFilters, parseQuotationFilters } from "@/modules/quotations/filters";
import { listQuotations } from "@/modules/quotations/queries";

export const metadata: Metadata = { title: "Quotations" };

export default async function QuotationsPage(props: PageProps<"/quotations">) {
  await requireActor();
  const searchParams = await props.searchParams;
  const params = parseQuotationFilters(searchParams);
  const [{ rows, total }, customers] = await Promise.all([listQuotations(params), listCustomerOptions()]);
  const filtered = hasActiveQuotationFilters(params);

  const newQuotation = (
    <FormDrawer
      trigger={
        <Button size="sm">
          <Plus aria-hidden /> New quotation
        </Button>
      }
      title="New quotation"
      description="Without an enquiry, for when you need to quote now. Then add lines, for example from a supplier who has just confirmed a price by phone."
    >
      <NewQuotationForm customers={customers} />
    </FormDrawer>
  );

  return (
    <>
      <PageHeader title="Quotations" subtitle="Prices for customers, made from an enquiry or started by hand." actions={newQuotation} />

      <Panel flush>
        <FilterBar clearHref="/quotations" hasActiveFilters={filtered}>
          <SearchInput placeholder="Search by number, customer, enquiry or item" />
          <FilterSelect param="status" allLabel="Draft and issued" options={toOptions(QUOTATION_STATUS_LABEL, ["DRAFT", "ISSUED", "SUPERSEDED"])} />
        </FilterBar>

        {rows.length === 0 ? (
          <TableShell>
            {filtered ? (
              <EmptyState
                title="No quotations match these filters"
                description="Try a different search, or clear the filters."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/quotations">Clear filters</Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No quotations yet"
                description="Start one with New quotation, or open an enquiry, confirm its requirements, choose a supplier for each, then use Create quotation."
                action={newQuotation}
              />
            )}
          </TableShell>
        ) : (
          <>
            <QuotationsTable rows={rows} />
            <Pagination pathname="/quotations" searchParams={searchParams} page={params.page} total={total} />
          </>
        )}
      </Panel>
    </>
  );
}
