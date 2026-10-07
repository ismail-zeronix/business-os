import { requireActor } from "@/core/permissions/actor";
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
import { Button } from "@/components/ui/button";
import { INVOICE_STATUS_LABEL, toOptions } from "@/lib/labels";
import { InvoicesTable } from "@/modules/invoices/components/invoices-table";
import { hasActiveInvoiceFilters, parseInvoiceFilters } from "@/modules/invoices/filters";
import { listInvoices } from "@/modules/invoices/queries";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage(props: PageProps<"/invoices">) {
  const actor = await requireActor();
  const searchParams = await props.searchParams;
  const params = parseInvoiceFilters(searchParams);
  const { rows, total } = await listInvoices(params, actor);
  const filtered = hasActiveInvoiceFilters(params);

  return (
    <>
      <PageHeader title="Invoices" subtitle="Billed from an issued quotation. Convert a quotation to invoice it." />

      <Panel flush>
        <FilterBar clearHref="/invoices" hasActiveFilters={filtered}>
          <SearchInput placeholder="Search invoices and customers" />
          <FilterSelect param="status" allLabel="Every status" options={toOptions(INVOICE_STATUS_LABEL)} />
        </FilterBar>

        {rows.length === 0 ? (
          <TableShell>
            {filtered ? (
              <EmptyState
                title="No invoices match these filters"
                description="Try a different search, or clear the filters."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/invoices">Clear filters</Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No invoices yet" description="Issue a quotation, then convert it to an invoice from its page." />
            )}
          </TableShell>
        ) : (
          <>
            <InvoicesTable rows={rows} />
            <Pagination pathname="/invoices" searchParams={searchParams} page={params.page} total={total} />
          </>
        )}
      </Panel>
    </>
  );
}
